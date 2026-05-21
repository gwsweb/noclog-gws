# NOC Log Portal — MikroTik PPPoE Monitor

A professional realtime NOC dashboard for MikroTik PPPoE logs.
Built with Next.js 14, Tailwind CSS, Vercel Serverless, and Upstash Redis.

**Live URL format:** `https://noclog-gws.vercel.app`

---

## Architecture

```
MikroTik RouterOS v6
  └─ /tool fetch HTTPS POST every 10s
       └─ Vercel Serverless: /api/log
            └─ Upstash Redis (rolling 200 logs)
                 └─ Next.js Frontend polls /api/logs every 3s
                      └─ Browser Dashboard
```

---

## Prerequisites

- GitHub account (free)
- Vercel account (free) — vercel.com
- Upstash account (free) — upstash.com
- MikroTik RouterOS v6 with internet access

---

## Step 1 — GitHub Repository

1. Go to https://github.com/new
2. Create a new **public** repository named `noclog-gws`
3. **Do NOT** initialize with README (we'll push our own)
4. Copy the repository URL (e.g. `https://github.com/yourusername/noclog-gws.git`)

### Upload project files

Option A — GitHub Web UI:
- Drag and drop all project files into the repository

Option B — Git CLI:
```bash
cd noclog
git init
git add .
git commit -m "Initial NOC portal"
git branch -M main
git remote add origin https://github.com/yourusername/noclog-gws.git
git push -u origin main
```

---

## Step 2 — Upstash Redis Database

1. Go to https://console.upstash.com
2. Click **"Create Database"**
3. Settings:
   - Name: `noclog`
   - Region: choose closest to your location
   - Type: **Regional** (free tier)
   - Enable: TLS ✓
4. Click **Create**
5. In the database dashboard, copy:
   - **UPSTASH_REDIS_REST_URL** (starts with `https://`)
   - **UPSTASH_REDIS_REST_TOKEN** (long string)

---

## Step 3 — Vercel Deployment

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Authorize GitHub if prompted
4. Select your `noclog-gws` repository
5. Framework: **Next.js** (auto-detected)
6. Click **"Environment Variables"** and add:

| Variable | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Your Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash REST token |
| `AUTH_TOKEN` | `c01c1d4afce98eaa061dbd09bcd76bf57602637bd3ab9d2ccf5723966819f43d` |

7. Click **Deploy**
8. Wait ~2 minutes for build to complete
9. Your URL will be: `https://noclog-gws.vercel.app` (or similar)

> **Note:** If the name `noclog-gws` is taken, Vercel appends a suffix. Update the MikroTik script URL accordingly.

---

## Step 4 — Test the API

### Health check (GET):
```
https://your-url.vercel.app/api/log
```
Should return: `{"status":"ok","service":"NOC Log Ingest"}`

### Send a test log (POST):
```bash
curl -X POST https://your-url.vercel.app/api/log \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer c01c1d4afce98eaa061dbd09bcd76bf57602637bd3ab9d2ccf5723966819f43d" \
  -d '{"message":"pppoe user1 logged in from 192.168.1.10"}'
```

Should return: `{"ok":true,"stored":1}`

### View logs:
```
https://your-url.vercel.app/api/logs
```

---

## Step 5 — MikroTik RouterOS v6 Setup

Open Winbox → Terminal (or SSH into your MikroTik).

### Paste in this order:

#### 1. Set up logging action and topics
```
/system logging action add name=pppoe-noc target=memory memory-lines=500 memory-stop-on-full=no
/system logging add topics=pppoe,info    action=pppoe-noc prefix="PPPOE"
/system logging add topics=pppoe,warning action=pppoe-noc prefix="PPPOE"
/system logging add topics=pppoe,error   action=pppoe-noc prefix="PPPOE"
```

#### 2. Create init script (sets global variables on boot)
```
/system script add name=noc-init policy=read,write,policy,test source={
  :global nocLastLog "";
  :global nocLastSent 0;
}
/system scheduler add name=noc-init interval=0 on-event=noc-init start-time=startup
```

#### 3. Create main forwarding script
See `mikrotik/setup-commands.rsc` for the full script.
Copy the **STEP 3** block exactly and paste into terminal.

> **Important:** Update `apiUrl` if your Vercel URL differs from `https://noclog-gws.vercel.app/api/log`

#### 4. Create scheduler
```
/system scheduler add name=noc-log-forward interval=10s on-event=noc-send-logs policy=read,write,ftp,policy,test start-time=startup
```

#### 5. Run manual test
```
/system script run noc-send-logs
```

---

## Step 6 — Verify End-to-End

1. Open your Vercel URL in browser
2. Run the MikroTik script manually: `/system script run noc-send-logs`
3. Logs should appear in the dashboard within ~3 seconds
4. Generate test PPPoE events:
   - Connect/disconnect a PPPoE client
   - Try wrong password login

---

## Troubleshooting

### Dashboard shows "No logs received"
- Check MikroTik has internet: `/ping 8.8.8.8`
- Check `/log print` for PPPoE entries
- Run the script manually and check for errors
- Verify AUTH_TOKEN matches in Vercel env and MikroTik script

### API returns 401
- AUTH_TOKEN mismatch. Double-check Vercel environment variable.

### API returns 429
- Rate limit hit. Default is 60 requests/minute per IP.

### Logs not PPPoE-filtered
- Check your `/system logging` topics include `pppoe`
- Verify your log messages contain keywords like "pppoe", "logged in", etc.

### Vercel build fails
- Check all files are committed to GitHub
- Verify package.json has correct dependencies
- Check Vercel build logs for TypeScript errors

---

## Project Structure

```
noclog/
├── app/
│   ├── page.tsx              # Main NOC dashboard UI
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Styles + log color classes
│   └── api/
│       ├── log/route.ts      # POST endpoint (MikroTik → here)
│       └── logs/route.ts     # GET endpoint (frontend polls here)
├── lib/
│   ├── redis.ts              # Upstash Redis client
│   └── pppoe-filter.ts       # PPPoE detection + log classification
├── middleware.ts             # Security headers
├── mikrotik/
│   └── setup-commands.rsc   # RouterOS v6 commands
├── .env.example              # Environment variable template
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Security Notes

- The `AUTH_TOKEN` validates all ingest requests
- Rate limiting: 60 POSTs/minute per IP
- Logs are **never permanently stored** — Redis list, max 200 entries, 2-hour TTL
- No user authentication on the dashboard (internal NOC use)
- To add dashboard auth, consider Vercel's built-in password protection (Pro) or add a simple cookie check

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | ✓ | Upstash database REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✓ | Upstash database REST token |
| `AUTH_TOKEN` | ✓ | Bearer token for MikroTik ingest |
| `RATE_LIMIT_PER_MIN` | optional | Max requests/min per IP (default: 60) |

---

## Free Tier Limits

| Service | Free Tier |
|---|---|
| Vercel | 100GB bandwidth, 100hrs serverless/month |
| Upstash Redis | 10,000 commands/day, 256MB |
| GitHub | Unlimited public repos |

For a typical ISP NOC (polling every 3s + MikroTik every 10s):
- ~29,000 Upstash reads/day (well under 10k limit per database — consider upgrading if heavy)
- Minimal Vercel bandwidth

> **Tip:** To reduce Upstash usage, increase the frontend poll interval in `app/page.tsx` (`POLL_INTERVAL`) from 3000ms to 5000ms or 10000ms.
