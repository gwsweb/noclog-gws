"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type LogLevel = "error" | "success" | "warning" | "info" | "disconnect";

interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  user?: string;
  ip?: string;
  iface?: string;
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  error:      "AUTH FAIL",
  success:    "CONNECTED",
  disconnect: "DISCONN  ",
  warning:    "WARNING  ",
  info:       "INFO     ",
};

const LEVEL_CLASS: Record<LogLevel, string> = {
  error:      "log-error",
  success:    "log-success",
  disconnect: "log-disconnect",
  warning:    "log-warning",
  info:       "log-info",
};

const IFACE_COLORS: Record<string, string> = {
  "ETH7":       "text-yellow-400",
  "VLAN2027-1": "text-orange-400",
  "VLAN2027-2": "text-pink-400",
};

function ifaceColor(iface?: string) {
  return IFACE_COLORS[iface ?? ""] ?? "text-[#3a5068]";
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour12: false }) +
    "." + String(d.getMilliseconds()).padStart(3, "0");
}

// Only show these two levels — everything else is hidden
const VISIBLE_LEVELS: LogLevel[] = ["error", "success"];

const POLL_INTERVAL = 3000;
const MAX_DISPLAY   = 200;

export default function NOCDashboard() {
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [paused, setPaused]           = useState(false);
  const [search, setSearch]           = useState("");

  const [autoScroll, setAutoScroll]   = useState(true);
  const [lastUpdate, setLastUpdate]   = useState<number>(0);
  const [pollStatus, setPollStatus]   = useState<"live" | "error" | "idle">("idle");
  const [stats, setStats] = useState({ total: 0, errors: 0, success: 0, eth7: 0, vlan: 0 });

  const logEndRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestTsRef  = useRef<number>(0);
  const pausedRef    = useRef(paused);
  pausedRef.current  = paused;

  const updateStats = useCallback((entries: LogEntry[]) => {
    const visible = entries.filter(e => VISIBLE_LEVELS.includes(e.level));
    setStats({
      total:   visible.length,
      errors:  visible.filter(e => e.level === "error").length,
      success: visible.filter(e => e.level === "success").length,
      eth7:    visible.filter(e => e.iface === "ETH7").length,
      vlan:    visible.filter(e => e.iface?.startsWith("VLAN2027")).length,
    });
  }, []);

  const fetchLogs = useCallback(async () => {
    if (pausedRef.current) return;
    try {
      const since = latestTsRef.current;
      const url   = since > 0
        ? `/api/logs?limit=${MAX_DISPLAY}&since=${since}`
        : `/api/logs?limit=${MAX_DISPLAY}`;
      const res  = await fetch(url, { cache: "no-store" });
      if (!res.ok) { setPollStatus("error"); return; }
      const data: { logs: LogEntry[] } = await res.json();
      if (data.logs?.length > 0) {
        setLogs(prev => {
          const incoming    = [...data.logs].reverse();
          const existingIds = new Set(prev.map(e => e.id));
          const newEntries  = incoming.filter(e => !existingIds.has(e.id));
          if (newEntries.length === 0) return prev;
          const merged = [...prev, ...newEntries].slice(-MAX_DISPLAY);
          latestTsRef.current = Math.max(...merged.map(e => e.ts));
          updateStats(merged);
          return merged;
        });
        setLastUpdate(Date.now());
        setPollStatus("live");
      } else {
        setPollStatus("live");
      }
    } catch {
      setPollStatus("error");
    }
  }, [updateStats]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const res  = await fetch(`/api/logs?limit=${MAX_DISPLAY}`);
        if (!res.ok) return;
        const data: { logs: LogEntry[] } = await res.json();
        if (data.logs?.length > 0) {
          const ordered = [...data.logs].reverse();
          setLogs(ordered);
          latestTsRef.current = Math.max(...ordered.map(e => e.ts));
          updateStats(ordered);
          setLastUpdate(Date.now());
          setPollStatus("live");
        }
      } catch { /* silent */ }
    };
    loadAll();
  }, [updateStats]);

  useEffect(() => {
    const timer = setInterval(fetchLogs, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchLogs]);

  useEffect(() => {
    if (autoScroll && !paused)
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll, paused]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const clearLogs = () => {
    setLogs([]);
    latestTsRef.current = 0;
    setStats({ total: 0, errors: 0, success: 0, eth7: 0, vlan: 0 });
  };

  // Filter: only AUTH FAIL + CONNECTED, then apply search + iface
  const filteredLogs = logs.filter(log => {
    if (!VISIBLE_LEVELS.includes(log.level)) return false;
    const matchSearch = search === "" ||
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.user?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (log.ip?.includes(search) ?? false);
    return matchSearch;
  });

  const sinceText = lastUpdate > 0
    ? `${Math.round((Date.now() - lastUpdate) / 1000)}s ago`
    : "waiting...";

  return (
    <div className="flex flex-col h-screen bg-[#0a0c0f] text-[#c8d4e0] font-sans overflow-hidden">

      {/* ─── TOP BAR ─── */}
      <header className="flex-none border-b border-[#1e2530] bg-[#0f1216]">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-[0.2em] text-[#3a7abf] uppercase">GWS Datacenters · NOC</span>
              <span className="text-[10px] text-[#4a5a6a] tracking-widest font-mono uppercase">
                PPPoE Auth Monitor · ETH7 &amp; VLAN2027
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono">
              <StatBadge label="TOTAL"     value={stats.total}   color="text-[#4a8abf]" />
              <StatBadge label="AUTH FAIL" value={stats.errors}  color="text-red-400" />
              <StatBadge label="CONNECTED" value={stats.success} color="text-green-400" />
              <span className="text-[#1e2530]">|</span>
              <StatBadge label="ETH7"      value={stats.eth7}    color="text-yellow-400" />
              <StatBadge label="VLAN2027"  value={stats.vlan}    color="text-orange-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${
                pollStatus === "live" ? "bg-green-400" :
                pollStatus === "error" ? "bg-red-400" : "bg-yellow-400"
              }`} />
              <span className={`text-[10px] font-mono hidden sm:inline ${
                pollStatus === "live" ? "text-green-400" :
                pollStatus === "error" ? "text-red-400" : "text-yellow-400"
              }`}>
                {pollStatus === "live" ? "LIVE" : pollStatus === "error" ? "ERR" : "IDLE"}
              </span>
            </div>
            <span className="text-[10px] text-[#4a5a6a] font-mono hidden md:inline">{sinceText}</span>
          </div>
        </div>

        {/* ─── CONTROLS ─── */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-[#1e2530] flex-wrap">

          {/* Search */}
          <div className="relative min-w-[150px] max-w-xs flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a5a6a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search user, IP, message..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#141820] border border-[#1e2530] rounded text-[11px] font-mono pl-8 pr-3 py-1.5 text-[#c8d4e0] placeholder-[#2a3545] focus:outline-none focus:border-[#3b6088] transition-colors"
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4a5a6a] hover:text-[#c8d4e0]">✕</button>}
          </div>

          {/* Level indicator pills — read only, not filters */}
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] font-mono text-[#2a3545] uppercase tracking-wider">Showing:</span>
            <span className="text-[10px] font-mono px-2 py-1 rounded border bg-red-900/20 border-red-800 text-red-400 uppercase tracking-wider">Auth Fail</span>
            <span className="text-[10px] font-mono px-2 py-1 rounded border bg-green-900/20 border-green-800 text-green-400 uppercase tracking-wider">Connected</span>
          </div>



          <div className="flex gap-1.5 ml-auto">
            <button onClick={() => setPaused(p => !p)}
              className={`flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded border transition-colors uppercase tracking-wider ${
                paused ? "bg-yellow-900/30 border-yellow-700 text-yellow-400"
                       : "bg-[#141820] border-[#1e2530] text-[#4a5a6a] hover:border-[#2a3545]"
              }`}>
              {paused ? <><PlayIcon /> RESUME</> : <><PauseIcon /> PAUSE</>}
            </button>
            <button onClick={() => setAutoScroll(a => !a)}
              className={`text-[10px] font-mono px-3 py-1.5 rounded border transition-colors uppercase tracking-wider ${
                autoScroll ? "bg-[#1e2d3d] border-[#3b6088] text-[#4a8abf]"
                           : "bg-[#141820] border-[#1e2530] text-[#4a5a6a]"
              }`}>
              ↓ AUTO
            </button>
            <button onClick={clearLogs}
              className="text-[10px] font-mono px-3 py-1.5 rounded border border-[#1e2530] bg-[#141820] text-[#4a5a6a] hover:border-red-900 hover:text-red-500 transition-colors uppercase tracking-wider">
              CLEAR
            </button>
          </div>
        </div>
      </header>

      {/* ─── COLUMN HEADERS ─── */}
      <div className="flex-none flex items-center px-4 py-1 bg-[#0d1017] border-b border-[#1e2530] text-[10px] font-mono text-[#2a3545] uppercase tracking-widest">
        <span className="w-[86px]">Time</span>
        <span className="w-[78px]">Status</span>
        <span className="w-[100px] hidden sm:block">Port</span>
        <span className="w-[130px] hidden md:block">User</span>
        <span className="w-[110px] hidden lg:block">IP Address</span>
        <span className="flex-1">Message</span>
      </div>

      {/* ─── LOG VIEWPORT ─── */}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#2a3545]">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-mono">No events yet</p>
              <p className="text-[11px] mt-1 text-[#1e2530]">
                {search ? "No results match your search" : "Waiting for auth / connect events..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#0d1017]">
            {filteredLogs.map((log, i) => (
              <LogRow key={log.id} log={log} isNew={i >= filteredLogs.length - 5} />
            ))}
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {/* ─── FOOTER ─── */}
      <footer className="flex-none flex items-center justify-between px-4 py-1.5 bg-[#0d1017] border-t border-[#1e2530] text-[10px] font-mono text-[#2a3545]">
        <span>{filteredLogs.length} events · Auth Fail + Connected only · Max 200</span>
        <span className="hidden sm:inline">Poll {POLL_INTERVAL/1000}s · {new Date().toLocaleDateString("en-GB")}</span>
        <span className="text-[#1a2530]">Innocodes · GWS Datacenters</span>
      </footer>
    </div>
  );
}

function LogRow({ log, isNew }: { log: LogEntry; isNew: boolean }) {
  return (
    <div className={`flex items-center px-4 py-[3px] text-[11px] font-mono hover:bg-white/[0.02] transition-colors cursor-default ${LEVEL_CLASS[log.level]} ${isNew ? "log-new" : ""}`}>
      <span className="w-[86px] shrink-0 text-[#3a5a6a] select-all">{fmtTime(log.ts)}</span>
      <span className="w-[78px] shrink-0 font-semibold text-[10px] tracking-wider log-level">{LEVEL_LABEL[log.level]}</span>
      <span className={`w-[100px] shrink-0 hidden sm:block font-semibold text-[10px] truncate ${ifaceColor(log.iface)}`}>
        {log.iface ?? "—"}
      </span>
      <span className="w-[130px] shrink-0 text-[#5a8a6a] hidden md:block truncate">{log.user ?? "—"}</span>
      <span className="w-[110px] shrink-0 text-[#3a5a7a] hidden lg:block">{log.level === "success" ? "—" : (log.ip ?? "—")}</span>
      <span className="flex-1 text-[#8a9aaa] truncate min-w-0">{log.message}</span>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#2a3545]">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
function PauseIcon() {
  return <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
}
function PlayIcon() {
  return <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;
}
