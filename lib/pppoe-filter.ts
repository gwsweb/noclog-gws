export type LogLevel = "error" | "success" | "warning" | "info" | "disconnect";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  user?: string;
  ip?: string;
  iface?: string;
  service?: string;
}

const PPPOE_PATTERNS = [
  /pppoe/i,
  /ppp\d*/i,
  /logged\s+in/i,
  /logged\s+out/i,
  /authentication\s+failed/i,
  /authentication/i,
  /invalid\s+password/i,
  /disconnected/i,
  /terminated/i,
  /timeout/i,
  /radius/i,
  /duplicate\s+session/i,
  /session\s+established/i,
  /discovery/i,
  /pap\s+auth/i,
  /chap\s+auth/i,
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

// ONLY these two interfaces are shown
const ALLOWED_IFACES = ["ether7", "vlan2027-1", "vlan2027-2-wadile-lixnet"];

const IFACE_MAP: Record<string, string> = {
  "ether7":                    "ETH7",
  "vlan2027-1":                "VLAN2027-1",
  "vlan2027-2-wadile-lixnet":  "VLAN2027-2",
};

export function isPPPoELog(message: string): boolean {
  const lower = message.toLowerCase();
  if (IGNORE_PATTERNS.some((p) => p.test(lower))) return false;
  if (!PPPOE_PATTERNS.some((p) => p.test(lower))) return false;

  // Must be from an allowed interface
  const ifaceRaw = extractIfaceRaw(lower);
  if (!ifaceRaw) return false;
  return ALLOWED_IFACES.some(a => ifaceRaw.includes(a));
}

function extractIfaceRaw(msg: string): string | null {
  // <pppoe-ether7>: or <ether7>: patterns
  const m1 = msg.match(/<([^>]+)>/);
  if (m1) return m1[1].replace(/^pppoe-/, "");
  // pppoe-ether7: pattern
  const m2 = msg.match(/pppoe-(\S+?)[:>\s]/);
  if (m2) return m2[1];
  return null;
}

export function classifyLog(message: string): LogLevel {
  const lower = message.toLowerCase();
  if (/auth.*fail|authentication failed|invalid.pass|wrong.pass|login.failed/i.test(lower))
    return "error";
  if (/logged\s+in|session.established|connection established/i.test(lower))
    return "success";
  if (/logged\s+out|disconnected|terminated/i.test(lower))
    return "disconnect";
  if (/timeout|duplicate.session|radius|discovery/i.test(lower))
    return "warning";
  return "info";
}

function resolveIfaceLabel(raw: string): string {
  const lower = raw.toLowerCase().replace(/^pppoe-/, "");
  return IFACE_MAP[lower] ?? raw.toUpperCase();
}

const USER_RE = /user[:\s]+["']?([^\s"',<>]+)/i;
const IP_RE   = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/;

export function parseLogEntry(raw: string): LogEntry {
  const level      = classifyLog(raw);
  const ifaceRaw   = extractIfaceRaw(raw.toLowerCase());
  const iface      = ifaceRaw ? resolveIfaceLabel(ifaceRaw) : undefined;
  const userMatch  = raw.match(USER_RE);
  const ipMatch    = raw.match(IP_RE);

  return {
    id:      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts:      Date.now(),
    level,
    message: raw.trim(),
    user:    userMatch?.[1],
    ip:      ipMatch?.[1],
    iface,
  };
}
