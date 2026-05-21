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

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour12: false }) +
    "." + String(d.getMilliseconds()).padStart(3, "0");
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const POLL_INTERVAL = 3000; // ms
const MAX_DISPLAY = 200;

export default function NOCDashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [pollStatus, setPollStatus] = useState<"live" | "error" | "idle">("idle");
  const [stats, setStats] = useState({ total: 0, errors: 0, success: 0, disconn: 0 });

  const logEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestTsRef = useRef<number>(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const updateStats = useCallback((entries: LogEntry[]) => {
    setStats({
      total:   entries.length,
      errors:  entries.filter(e => e.level === "error").length,
      success: entries.filter(e => e.level === "success").length,
      disconn: entries.filter(e => e.level === "disconnect").length,
    });
  }, []);

  const fetchLogs = useCallback(async () => {
    if (pausedRef.current) return;
    try {
      const since = latestTsRef.current;
      const url = since > 0
        ? `/api/logs?limit=${MAX_DISPLAY}&since=${since}`
        : `/api/logs?limit=${MAX_DISPLAY}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) { setPollStatus("error"); return; }
      const data: { logs: LogEntry[] } = await res.json();

      if (data.logs && data.logs.length > 0) {
        setLogs(prev => {
          // Merge: new logs come in newest-first from Redis LRANGE
          // We want oldest-first display, so reverse
          const incoming = [...data.logs].reverse();
          const existingIds = new Set(prev.map(e => e.id));
          const newEntries = incoming.filter(e => !existingIds.has(e.id));
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

  // Initial full load
  useEffect(() => {
    const loadAll = async () => {
      try {
        const res = await fetch(`/api/logs?limit=${MAX_DISPLAY}`);
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

  // Polling
  useEffect(() => {
    const timer = setInterval(fetchLogs, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchLogs]);

  // Auto scroll
  useEffect(() => {
    if (autoScroll && !paused) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll, paused]);

  // Detect manual scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(atBottom);
  };

  const clearLogs = () => {
    setLogs([]);
    latestTsRef.current = 0;
    setStats({ total: 0, errors: 0, success: 0, disconn: 0 });
  };

  const filteredLogs = logs.filter(log => {
    const matchLevel = levelFilter === "all" || log.level === levelFilter;
    const matchSearch = search === "" ||
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.user?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (log.ip?.includes(search) ?? false);
    return matchLevel && matchSearch;
  });

  const sinceText = lastUpdate > 0
    ? `${Math.round((Date.now() - lastUpdate) / 1000)}s ago`
    : "waiting...";

  return (
    <div className="flex flex-col h-screen bg-[#0a0c0f] text-[#c8d4e0] font-sans overflow-hidden">

      {/* ─── TOP BAR ─── */}
      <header className="flex-none border-b border-[#1e2530] bg-[#0f1216]">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-[0.2em] text-[#4a8abf] uppercase">
                NOC Portal
              </span>
              <span className="text-[10px] text-[#4a5a6a] tracking-widest font-mono uppercase">
                MikroTik PPPoE Monitor
              </span>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono">
              <StatBadge label="TOTAL" value={stats.total} color="text-[#4a8abf]" />
              <StatBadge label="CONN"  value={stats.success} color="text-green-400" />
              <StatBadge label="FAIL"  value={stats.errors} color="text-red-400" />
              <StatBadge label="DISC"  value={stats.disconn} color="text-orange-400" />
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

            <span className="text-[10px] text-[#4a5a6a] font-mono hidden md:inline">
              Updated {sinceText}
            </span>
          </div>
        </div>

        {/* ─── CONTROLS BAR ─── */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-[#1e2530] flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a5a6a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search user, IP, message..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#141820] border border-[#1e2530] rounded text-[11px] font-mono pl-8 pr-3 py-1.5 text-[#c8d4e0] placeholder-[#2a3545] focus:outline-none focus:border-[#3b6088] transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4a5a6a] hover:text-[#c8d4e0]">
                ✕
              </button>
            )}
          </div>

          {/* Level filter */}
          <div className="flex gap-1">
            {(["all", "error", "success", "disconnect", "warning", "info"] as const).map(lvl => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors uppercase tracking-wider ${
                  levelFilter === lvl
                    ? lvl === "all"      ? "bg-[#1e2d3d] border-[#3b6088] text-[#4a8abf]"
                    : lvl === "error"    ? "bg-red-900/30 border-red-700 text-red-400"
                    : lvl === "success"  ? "bg-green-900/30 border-green-700 text-green-400"
                    : lvl === "disconnect" ? "bg-orange-900/30 border-orange-700 text-orange-400"
                    : lvl === "warning"  ? "bg-yellow-900/30 border-yellow-700 text-yellow-400"
                    : "bg-blue-900/30 border-blue-700 text-blue-400"
                    : "bg-transparent border-[#1e2530] text-[#4a5a6a] hover:border-[#2a3545] hover:text-[#6a8a9a]"
                }`}
              >
                {lvl === "disconnect" ? "disc" : lvl}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 ml-auto">
            {/* Pause/Resume */}
            <button
              onClick={() => setPaused(p => !p)}
              className={`flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded border transition-colors uppercase tracking-wider ${
                paused
                  ? "bg-yellow-900/30 border-yellow-700 text-yellow-400"
                  : "bg-[#141820] border-[#1e2530] text-[#4a5a6a] hover:border-[#2a3545]"
              }`}
            >
              {paused ? (
                <><PlayIcon /> RESUME</>
              ) : (
                <><PauseIcon /> PAUSE</>
              )}
            </button>

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(a => !a)}
              className={`text-[10px] font-mono px-3 py-1.5 rounded border transition-colors uppercase tracking-wider ${
                autoScroll
                  ? "bg-[#1e2d3d] border-[#3b6088] text-[#4a8abf]"
                  : "bg-[#141820] border-[#1e2530] text-[#4a5a6a]"
              }`}
              title="Toggle auto-scroll"
            >
              ↓ AUTO
            </button>

            {/* Clear */}
            <button
              onClick={clearLogs}
              className="text-[10px] font-mono px-3 py-1.5 rounded border border-[#1e2530] bg-[#141820] text-[#4a5a6a] hover:border-red-900 hover:text-red-500 transition-colors uppercase tracking-wider"
            >
              CLEAR
            </button>
          </div>
        </div>
      </header>

      {/* ─── COLUMN HEADERS ─── */}
      <div className="flex-none flex items-center gap-0 px-4 py-1 bg-[#0d1017] border-b border-[#1e2530] text-[10px] font-mono text-[#2a3545] uppercase tracking-widest">
        <span className="w-[88px]">Time</span>
        <span className="w-[80px]">Level</span>
        <span className="w-[110px] hidden sm:block">Interface</span>
        <span className="w-[130px] hidden md:block">User</span>
        <span className="w-[110px] hidden lg:block">IP Address</span>
        <span className="flex-1">Message</span>
      </div>

      {/* ─── LOG VIEWPORT ─── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#2a3545]">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-mono">No logs received</p>
              <p className="text-[11px] mt-1 text-[#1e2530]">
                {search || levelFilter !== "all"
                  ? "No results match your filter"
                  : "Waiting for MikroTik PPPoE events..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#111519]">
            {filteredLogs.map((log, i) => (
              <LogRow key={log.id} log={log} isNew={i >= filteredLogs.length - 5} />
            ))}
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {/* ─── FOOTER STATUS BAR ─── */}
      <footer className="flex-none flex items-center justify-between px-4 py-1.5 bg-[#0d1017] border-t border-[#1e2530] text-[10px] font-mono text-[#2a3545]">
        <span>
          {filteredLogs.length !== logs.length
            ? `Showing ${filteredLogs.length} of ${logs.length} logs`
            : `${logs.length} logs in memory`}
          {" · "}Max 200 · Rolling cache
        </span>
        <span className="hidden sm:inline">
          Poll every {POLL_INTERVAL / 1000}s · {new Date().toLocaleDateString("en-GB")}
        </span>
        <span className="text-[#1e2530]">NOC Portal v1.0</span>
      </footer>
    </div>
  );
}

/* ─── SUB-COMPONENTS ─── */

function LogRow({ log, isNew }: { log: LogEntry; isNew: boolean }) {
  return (
    <div className={`flex items-center gap-0 px-4 py-[3px] text-[11px] font-mono hover:bg-white/[0.02] transition-colors cursor-default ${LEVEL_CLASS[log.level]} ${isNew ? "log-new" : ""}`}>
      {/* Time */}
      <span className="w-[88px] shrink-0 text-[#3a5a6a] select-all">
        {fmtTime(log.ts)}
      </span>
      {/* Level */}
      <span className={`w-[80px] shrink-0 font-semibold text-[10px] tracking-wider log-level`}>
        {LEVEL_LABEL[log.level]}
      </span>
      {/* Interface */}
      <span className="w-[110px] shrink-0 text-[#3a5068] hidden sm:block truncate">
        {log.iface ?? "—"}
      </span>
      {/* User */}
      <span className="w-[130px] shrink-0 text-[#5a8a6a] hidden md:block truncate">
        {log.user ?? "—"}
      </span>
      {/* IP */}
      <span className="w-[110px] shrink-0 text-[#3a5a7a] hidden lg:block">
        {log.ip ?? "—"}
      </span>
      {/* Message */}
      <span className="flex-1 text-[#8a9aaa] truncate min-w-0">
        {log.message}
      </span>
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
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
