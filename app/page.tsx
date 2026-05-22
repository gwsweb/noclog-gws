"use client";

import { useState } from "react";
import NOCDashboard from "@/components/NOCDashboard";

export default function Home() {
  const [entered, setEntered] = useState(false);

  if (entered) return <NOCDashboard />;

  return (
    <div className="min-h-screen bg-[#0a0c0f] flex flex-col items-center justify-center relative overflow-hidden">

      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(30,37,48,0.4) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(30,37,48,0.4) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(30,80,140,0.07) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10 px-6 text-center">

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl border border-[#1e2530] bg-[#0f1216]"
            style={{ boxShadow: "0 0 40px rgba(30,80,140,0.15)" }}>
            <svg className="w-8 h-8 text-[#3a7abf]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-mono tracking-[0.3em] text-[#3a7abf] uppercase mb-1">GWS Datacenters</p>
            <h1 className="text-3xl font-semibold text-[#d0dce8] tracking-tight">NOC Monitoring System</h1>
            <p className="text-[#4a5a6a] text-sm mt-2 font-mono">MikroTik PPPoE · Realtime Event Dashboard</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Authentication Monitor",
            "Live Connection Tracking",
            "PoP Updates",
            "Realtime Updates",
          ].map(f => (
            <span key={f}
              className="text-[10px] font-mono tracking-wider text-[#3a6a8a] border border-[#1e2530] bg-[#0f1216] px-3 py-1 rounded-full uppercase">
              {f}
            </span>
          ))}
        </div>

        <button
          onClick={() => setEntered(true)}
          className="group relative flex items-center gap-3 px-8 py-4 rounded-xl border border-[#2a4060] bg-[#0f1a28] text-[#c8d4e0] font-mono text-sm tracking-wider uppercase transition-all duration-200 hover:border-[#3a7abf] hover:bg-[#0f2035]"
          style={{ boxShadow: "0 0 30px rgba(30,80,140,0.1)" }}
        >
          <svg className="w-4 h-4 text-[#3a7abf]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Open NOC Dashboard
          <svg className="w-4 h-4 text-[#3a7abf] transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="flex items-center gap-2 text-[11px] font-mono text-[#2a4a5a]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
          System Online · Polling every 3s
        </div>

      </div>

      <div className="absolute bottom-6 flex flex-col items-center gap-1">
        <p className="text-[10px] font-mono text-[#1e2a35] tracking-widest uppercase">
          Designed &amp; Developed by
        </p>
        <p className="text-[11px] font-mono tracking-[0.25em] text-[#2a4a6a] uppercase font-semibold">
          Innocodes
        </p>
      </div>

    </div>
  );
}
