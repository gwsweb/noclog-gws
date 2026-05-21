export type LogLevel = "error" | "success" | "warning" | "info" | "disconnect";

export interface LogEntry {
  id: string;
  ts: number;          // unix ms
  level: LogLevel;
  message: string;
  user?: string;
  ip?: string;
  iface?: string;
  raw: string;
}

// Keywords that indicate a PPPoE-related log
const PPPOE_PATTERNS = [
  /pppoe/i,
  /ppp\d+/i,
  /logged\s+in/i,
  /logged\s+out/i,
  /authentication\s+fail/i,
  /auth\s+fail/i,
  /invalid\s+password/i,
  /disconnected/i,
  /timeout/i,
  /radius\s+reply/i,
  /duplicate\s+session/i,
  /session\s+established/i,
  /discovery/i,
  /pap\s+auth/i,
  /chap\s+auth/i,
  /lcp/i,
  /ipcp/i,
];

const IGNORE_PATTERNS = [
  /firewall/i,
  /hotspot/i,
  /dhcp/i,
  /ospf/i,
  /bgp/i,
  /snmp/i,
  /ipsec/i,
  /l2tp/i,
  /ovpn/i,
];

export function isPPPoELog(message: string): boolean {
  const lower = message.toLowerCase();
  if (IGNORE_PATTERNS.some((p) => p.test(lower))) return false;
  return PPPOE_PATTERNS.some((p) => p.test(lower));
}

export function classifyLog(message: string): LogLevel {
  const lower = message.toLowerCase();

  if (
    /auth.*fail|invalid.pass|wrong.pass|failed.auth|login.failed|pap.*fail|chap.*fail/i.test(lower)
  )
    return "error";

  if (
    /logged\s+in|session.established|pppoe.connected|connected|login.success/i.test(lower)
  )
    return "success";

  if (
    /logged\s+out|disconnected|terminated|pppoe.disconnected|session.ended/i.test(lower)
  )
    return "disconnect";

  if (/timeout|duplicate.session|radius.reply|discovery/i.test(lower))
    return "warning";

  return "info";
}

const USER_RE = /user[:\s]+["']?([^\s"',]+)/i;
const IP_RE = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/;
const IFACE_RE = /\b(pppoe?-?\w*|ppp\d+)\b/i;

export function parseLogEntry(raw: string): LogEntry {
  const level = classifyLog(raw);
  const userMatch = raw.match(USER_RE);
  const ipMatch = raw.match(IP_RE);
  const ifaceMatch = raw.match(IFACE_RE);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    level,
    message: raw.trim(),
    user: userMatch?.[1],
    ip: ipMatch?.[1],
    iface: ifaceMatch?.[1],
    raw,
  };
}
