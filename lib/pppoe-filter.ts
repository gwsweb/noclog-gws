export type LogLevel = "error" | "success" | "warning" | "info" | "disconnect";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  user?: string;
  ip?: string;
  iface?: string;
}

export function isPPPoELog(message: string): boolean {
  const lower = message.toLowerCase();
  if (/firewall|hotspot|dhcp|ospf|bgp|snmp|ipsec|ovpn/i.test(lower)) return false;
  return /pppoe|ppp|logged in|logged out|authentication|password|radius|disconnect|duplicate|discovery|session|terminated|connection established/i.test(lower);
}

export function classifyLog(message: string): LogLevel {
  const lower = message.toLowerCase();
  if (/auth.*fail|authentication failed|invalid.pass|wrong.pass|login.failed/i.test(lower))
    return "error";
  if (/logged\s+in|session.established|connection established|connected|pppoe.*connect/i.test(lower))
    return "success";
  if (/logged\s+out|disconnected|terminated/i.test(lower))
    return "disconnect";
  if (/timeout|duplicate|radius|discovery/i.test(lower))
    return "warning";
  return "info";
}

const USER_RE  = /user[:\s]+["']?([^\s"',<>]+)/i;
const IP_RE    = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/;
const IFACE_RE = /<([^>]+)>|pppoe-(\S+?)[:>\s]/i;

export function parseLogEntry(raw: string): LogEntry {
  const level      = classifyLog(raw);
  const userMatch  = raw.match(USER_RE);
  const ipMatch    = raw.match(IP_RE);
  const ifaceMatch = raw.match(IFACE_RE);
  const ifaceRaw   = ifaceMatch?.[1] ?? ifaceMatch?.[2];

  return {
    id:      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts:      Date.now(),
    level,
    message: raw.trim(),
    user:    userMatch?.[1],
    ip:      ipMatch?.[1],
    iface:   ifaceRaw?.replace(/^pppoe-/i, "").toUpperCase(),
  };
}
