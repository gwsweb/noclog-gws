# ============================================================
# MikroTik RouterOS v6 — NOC Log Forwarding Setup
# Compatible: RouterOS 6.x
# Target: https://noclog-gws.vercel.app/api/log
# ============================================================
# Paste each block into Winbox Terminal or SSH one at a time.
# ============================================================


# ─── STEP 1: Configure Logging Topics ───────────────────────
# Log PPPoE events to memory buffer named "pppoe-noc"

/system logging action
add name=pppoe-noc target=memory memory-lines=500 memory-stop-on-full=no

/system logging
add topics=pppoe,info    action=pppoe-noc prefix="PPPOE"
add topics=pppoe,warning action=pppoe-noc prefix="PPPOE"
add topics=pppoe,error   action=pppoe-noc prefix="PPPOE"


# ─── STEP 2: Create Global Variables ────────────────────────

/system script
add name=noc-init policy=read,write,policy,test source={
  :global nocLastLog "";
  :global nocLastSent 0;
}

/system scheduler
add name=noc-init interval=0 on-event=noc-init start-time=startup


# ─── STEP 3: Main Log Forwarding Script ─────────────────────

/system script
add name=noc-send-logs policy=read,write,ftp,policy,test source={

  # ---- Global state ----
  :global nocLastLog;
  :global nocLastSent;

  # ---- Config ----
  :local apiUrl "https://noclog-gws.vercel.app/api/log";
  :local authToken "c01c1d4afce98eaa061dbd09bcd76bf57602637bd3ab9d2ccf5723966819f43d";

  # ---- Get log buffer ----
  :local logBuffer [/log find];
  :local logCount [:len $logBuffer];

  :if ($logCount = 0) do={ :return };

  # ---- PPPoE keyword filter ----
  :local pppoeKeywords "pppoe,ppp,logged in,logged out,auth fail,invalid password,disconnected,timeout,radius,duplicate session,session established,discovery";

  # ---- Process last N entries (max 10 per run to limit CPU) ----
  :local startIdx ($logCount - 10);
  :if ($startIdx < 0) do={ :set startIdx 0 };

  :local i $startIdx;
  :while ($i < $logCount) do={

    :local entry [/log get ($logBuffer->$i)];
    :local msg [:tostr ($entry->"message")];
    :local msgId [:tostr ($entry->"time")];

    # Skip if already sent
    :if ($msgId != $nocLastLog) do={

      # Check if PPPoE related (basic keyword presence)
      :local isPPPoE false;
      :if ([:find $msg "pppoe"] >= 0)  do={ :set isPPPoE true };
      :if ([:find $msg "ppp"]    >= 0) do={ :set isPPPoE true };
      :if ([:find $msg "logged"] >= 0) do={ :set isPPPoE true };
      :if ([:find $msg "auth fail"]  >= 0) do={ :set isPPPoE true };
      :if ([:find $msg "password"]   >= 0) do={ :set isPPPoE true };
      :if ([:find $msg "radius"]     >= 0) do={ :set isPPPoE true };
      :if ([:find $msg "disconnect"] >= 0) do={ :set isPPPoE true };
      :if ([:find $msg "duplicate"]  >= 0) do={ :set isPPPoE true };
      :if ([:find $msg "discovery"]  >= 0) do={ :set isPPPoE true };
      :if ([:find $msg "session"]    >= 0) do={ :set isPPPoE true };

      :if ($isPPPoE = true) do={

        # Escape double quotes in message
        :local cleanMsg $msg;

        # Build JSON payload
        :local payload "{\"message\":\"";
        :set payload ($payload . $cleanMsg);
        :set payload ($payload . "\"}");

        # HTTP POST with error handling
        :do {
          /tool fetch \
            url=$apiUrl \
            http-method=post \
            http-header-field="Content-Type: application/json,Authorization: Bearer $authToken" \
            http-data=$payload \
            output=none \
            duration=5s;
        } on-error={
          # Silently skip on network error
        };

        :set nocLastLog $msgId;
      };
    };

    :set i ($i + 1);
  };
}


# ─── STEP 4: Scheduler (every 10 seconds) ───────────────────

/system scheduler
add name=noc-log-forward \
  interval=10s \
  on-event=noc-send-logs \
  policy=read,write,ftp,policy,test \
  start-time=startup \
  comment="NOC PPPoE log forwarder"


# ─── STEP 5: Verify setup ───────────────────────────────────
# Run these to confirm everything is loaded:

/system script print
/system scheduler print
/log print where topics~"pppoe"


# ─── MANUAL TEST (paste in terminal) ────────────────────────
# Send a test log manually:

/system script run noc-send-logs


# ─── OPTIONAL: Remove setup ─────────────────────────────────
# To fully remove:
#
# /system scheduler remove [find name=noc-log-forward]
# /system scheduler remove [find name=noc-init]
# /system script  remove [find name=noc-send-logs]
# /system script  remove [find name=noc-init]
# /system logging remove [find action=pppoe-noc]
# /system logging action remove [find name=pppoe-noc]
