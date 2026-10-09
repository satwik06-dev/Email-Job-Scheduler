# 🚀 ReachInbox — Production-Grade Email Job Scheduler & Dashboard

A production-grade, fault-tolerant email scheduling engine and dashboard built for **ReachInbox**. The system schedules and dispatches emails at scale without cron jobs, preserves jobs across server restarts, enforces multi-worker rate limiting per sender, alerts team channels on Slack upon rate-limit triggers, indexes emails in Elasticsearch, and provides live queue observability via Bull-Board.

---

## 📑 Table of Contents

- [Key Architecture Highlights](#-key-architecture-highlights)
- [Tech Stack](#-tech-stack)
- [System Architecture & Flow](#-system-architecture--flow)
- [Features Implemented](#-features-implemented)
  - [Backend Features](#backend-features)
  - [Frontend Features](#frontend-features)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running with Local Node & Redis](#running-with-local-node--redis)
  - [Running with Docker Compose](#running-with-docker-compose)
- [How It Works Under the Hood](#-how-it-works-under-the-hood)
  - [1. Scheduling without Cron (BullMQ Delayed Jobs)](#1-scheduling-without-cron-bullmq-delayed-jobs)
  - [2. Crash Persistence & Zero Duplication](#2-crash-persistence--zero-duplication)
  - [3. Multi-Worker Rate Limiting & Auto-Rescheduling](#3-multi-worker-rate-limiting--auto-rescheduling)
  - [4. Live Slack Notification on Rate Limit Hit](#4-live-slack-notification-on-rate-limit-hit)
  - [5. Elasticsearch Indexing & Search](#5-elasticsearch-indexing--search)
- [API Reference](#-api-reference)
- [Assumptions & Design Trade-offs](#-assumptions--design-trade-offs)

---

## 🌟 Key Architecture Highlights

1. **Zero Cron Jobs**: Strictly uses **BullMQ delayed jobs** backed by Redis.
2. **Crash & Restart Persistence**: Jobs persist in Redis sorted sets (`bull:<queue>:delayed`). Furthermore, on server boot, a **Startup Reconciliation Service** queries the relational database for any un-sent jobs and re-queues them with idempotent keys (`jobId = email.id`).
3. **Provider Delay Throttling**: Implements configurable inter-email delays (`MIN_DELAY_BETWEEN_EMAILS_MS`, default 2 seconds) to respect SMTP rate rules.
4. **Sliding Hour Rate Limiting**: Redis-backed atomic Lua script counters per sender (`ratelimit:sender:{sender}:{hourWindow}`). Prevents race conditions across parallel workers.
5. **No Dropped Jobs on Rate Limit**: When hourly limits are reached, jobs are **rescheduled into the next available hour window** rather than dropped or failed.
6. **Live Slack Alert on Rate Limit Hit**: Triggers a live webhook or Slack OAuth alert with rich Block Kit formatting notifying team channels with the sender, limit, and postponed timestamp.
7. **Fake SMTP via Ethereal**: Each sent email generates a live webmail preview link (`nodemailer.getTestMessageUrl(info)`), accessible right from the dashboard table.
8. **Elasticsearch Indexing**: Auto-creates indices with full-text mapping, updating status on send/reschedule, and falls back to relational DB search if Elasticsearch is offline.
9. **Live BullMQ Queue Dashboard**: Bull-Board mounted at `/admin/queues` for real-time visual inspection of Active, Waiting, Delayed, Completed, and Failed queues.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | TypeScript, Node.js, Express.js |
| **Queue & Cache** | BullMQ, Redis (ioredis) |
| **Database** | Relational DB via Prisma ORM (SQLite for instant local run, PostgreSQL / MySQL ready) |
| **SMTP Provider** | Ethereal Email (Nodemailer fake SMTP with webmail preview) |
| **Search Engine**| Elasticsearch (`@elastic/elasticsearch`) |
| **Queue UI** | Bull-Board (`@bull-board/express`, `@bull-board/api`) |
| **Integrations**| Slack Web API & OAuth 2.0, Google Auth Library |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, `@react-oauth/google` |

---

## 🔄 System Architecture & Flow

```
[ Frontend Dashboard ]
      │
      ├─► POST /api/emails/schedule
      │       │
      │       ├─► Relational DB (Prisma): Saves email record as 'SCHEDULED'
      │       ├─► Elasticsearch: Indexes document
      │       └─► BullMQ Queue: Adds delayed job with jobId=email.id
      │
[ BullMQ Redis Store ] (Delayed ZSet: bull:email-scheduler:delayed)
      │
      ▼ (When scheduled time arrives)
[ BullMQ Worker Pool ] (Configurable concurrency = 5)
      │
      ├─► Step 1: Provider throttling delay (e.g. 2s sleep)
      ├─► Step 2: Atomic Rate Limit Check (Redis Lua Script)
      │       │
      │       ├─► If Limit Exceeded:
      │       │     • Update DB status -> 'RESCHEDULED_RATE_LIMIT'
      │       │     • Reschedule job for start of next hour window
      │       │     • Send Live Alert to Slack Channel ⚠️
      │       │
      │       └─► If Allowed:
      │             • Send email via Ethereal SMTP
      │             • Generate Ethereal Webmail Preview URL
      │             • Update DB status -> 'SENT'
      │             • Re-index in Elasticsearch
```

---

## ✨ Features Implemented

### Backend Features
- [x] **API Scheduling**: `POST /api/emails/schedule` accepts single or bulk campaign recipients.
- [x] **Lead Parser**: `POST /api/emails/upload-leads` extracts and deduplicates emails from CSV/TXT files.
- [x] **Persistent Scheduler**: BullMQ delayed jobs with zero cron library usage.
- [x] **Configurable Worker Concurrency**: Set via `WORKER_CONCURRENCY` (default 5 parallel threads).
- [x] **Minimum Delay Between Sends**: Set via `MIN_DELAY_BETWEEN_EMAILS_MS` (e.g. 2s minimum).
- [x] **Multi-Sender Rate Limiting**: Configured per sender (`MAX_EMAILS_PER_HOUR_PER_SENDER`) and global (`MAX_EMAILS_PER_HOUR`).
- [x] **Safe Atomic Redis Counters**: Lua scripts enforce rate-limits safely across parallel workers.
- [x] **Auto-Rescheduling**: Jobs exceeding limits are delayed into the next hour window rather than dropped.
- [x] **Live Slack Integration**:
  - Full OAuth v2 authorize URL & callback endpoint.
  - Incoming Webhook support for instant testing.
  - Live rich Block Kit notification dispatched when hourly rate limit is hit.
  - Safe disconnect/reconnect handling.
- [x] **Fake SMTP Delivery**: Auto-provisions Ethereal test accounts with clickable webmail inspection URLs.
- [x] **Elasticsearch Full-Text Search**: Indices created with text/keyword mapping; multi-field fuzziness search with relational database fallback.
- [x] **Live Bull-Board Dashboard**: Mounted at `/admin/queues`.
- [x] **Server Restart Recovery**: Reconciles pending DB jobs on boot and ensures BullMQ queue synchronization without duplicates.

### Frontend Features
- [x] **Google OAuth Login**: Real Google Identity Services (GIS) login button and user profile extraction.
- [x] **Reviewer Demo Login**: 1-click test login for instantaneous evaluation without Google Client credentials.
- [x] **Header**: User avatar, user name, email, Slack alert status pill, BullMQ Board link, and Logout.
- [x] **Metrics Banner**: Real-time counters for Scheduled, Sent, Rescheduled (Rate-Limited), Queue Delayed/Active, and Multi-Sender utilization.
- [x] **Tabs Navigation**: Clean tabs for **Scheduled Emails** and **Sent Emails**.
- [x] **Compose Modal**:
  - Multi-sender selection dropdown and custom input.
  - CSV/TXT lead upload with automatic email count detector ("✓ 48 leads detected").
  - Start time picker (Immediate vs Scheduled).
  - Delay between sends input.
  - Hourly limit input.
- [x] **Scheduled Emails List**: Recipient, Sender, Subject, Scheduled Time, Status badge, and Cancel action.
- [x] **Sent Emails List**: Recipient, Sender, Subject, Delivered Time, Status badge (`SENT`/`FAILED`), and clickable **"View Email"** Ethereal preview link.
- [x] **Elasticsearch Search Bar**: Instant debounced search querying subject, recipient, sender, and body.
- [x] **Slack Integration Modal**: Connect via OAuth, connect via webhook, test live alert button, and disconnect.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ or v20+
- **Redis**: v5.0+ or v7.0+ (running locally on port 6379 or via Docker)

### Environment Variables

Backend environment configuration is stored in `backend/.env`:

```env
PORT=5000
NODE_ENV=development

# Database (SQLite by default for zero-friction setup; switchable to PostgreSQL)
DATABASE_URL="file:./dev.db"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# BullMQ & Scheduler Settings
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
DEFAULT_HOURLY_LIMIT=50
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50

# Ethereal SMTP (Leave blank to automatically provision test ethereal account at runtime)
ETHEREAL_USER=
ETHEREAL_PASS=

# Elasticsearch (Optional: Auto-indexes when reachable; graceful DB search fallback)
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=emails

# Google OAuth (For Google sign-in validation)
GOOGLE_CLIENT_ID=

# Slack Integration (OAuth or Direct Webhook)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:5000/api/auth/slack/callback
SLACK_DEFAULT_WEBHOOK_URL=

# Frontend
FRONTEND_URL=http://localhost:5173
```

---

### Running with Local Node & Redis

#### 1. Start Redis
Make sure Redis is running on port 6379:
```bash
redis-server
```

#### 2. Start Backend
```bash
cd backend
npm install
npx prisma db push
npm run dev
```
The backend server will start at **http://localhost:5000**:
- API: `http://localhost:5000/api`
- Bull-Board Dashboard: `http://localhost:5000/admin/queues`
- Health check: `http://localhost:5000/health`

#### 3. Start Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

---

### Running with Docker Compose

To spin up Redis, PostgreSQL, and Elasticsearch in Docker containers:

```bash
docker compose up -d
```

Update `backend/.env` with:
```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/reachinbox?schema=public"
```
Then run Prisma migration:
```bash
cd backend
npx prisma db push --schema prisma/schema.postgresql.prisma
npm run dev
```

---

## 🔍 How It Works Under the Hood

### 1. Scheduling without Cron (BullMQ Delayed Jobs)
We do not use cron jobs or setInterval schedulers. Instead, BullMQ delayed jobs are used:
```ts
const targetSendTimeMs = baseStartTime + index * delayBetween;
const delayMs = Math.max(0, targetSendTimeMs - Date.now());

await emailQueue.add('send-email', jobData, {
  delay: delayMs,
  jobId: emailRecord.id, // Idempotency key
});
```
Redis stores these jobs in a sorted set ordered by execution timestamp. The BullMQ worker wakes up exactly when the delay expires.

### 2. Crash Persistence & Zero Duplication
- **During server shutdown/restart**: BullMQ delayed jobs stay stored in Redis memory and append-only log.
- **On server startup**: The backend runs `reconcileScheduledEmailsOnStartup()` which queries the database for any `SCHEDULED` or `RESCHEDULED_RATE_LIMIT` emails. If a job is not found in BullMQ, it is re-added with `delay = scheduledAt - now`.
- **Idempotency**: Every job uses `jobId = email.id`. BullMQ rejects duplicate job IDs, preventing emails from being processed multiple times.
- **Worker checks**: The worker verifies DB status before sending. If `email.status === 'SENT'`, it skips immediately.

### 3. Multi-Worker Rate Limiting & Auto-Rescheduling
To prevent race conditions across parallel BullMQ worker threads, we execute an atomic **Lua script** in Redis:
```lua
local sender_count = tonumber(redis.call('GET', sender_key) or '0')
if sender_count >= sender_limit then
  return {0, sender_count, 'sender_limit_exceeded'}
end
local new_sender = redis.call('INCR', sender_key)
if new_sender == 1 then
  redis.call('EXPIRE', sender_key, ttl)
end
return {1, new_sender, 'ok'}
```
When `sender_count >= sender_limit`:
1. The job is **not dropped** or failed.
2. The worker computes the start of the next UTC hour window (`nextWindowStart`).
3. The DB record is updated to `RESCHEDULED_RATE_LIMIT`.
4. The job is re-added to BullMQ with `delay = nextWindowStart - now`.
5. A live Slack notification is dispatched.

### 4. Live Slack Notification on Rate Limit Hit
- When a sender reaches their hourly limit, the rate limiter triggers `slackService.notifyRateLimitHit()`.
- An in-memory/Redis throttle key `ratelimit:notified:{sender}:{hourWindow}` ensures the notification is sent once per window per sender to avoid alert fatigue.
- Disconnecting Slack simply causes the notification call to be bypassed safely without any unhandled exceptions.

### 5. Elasticsearch Indexing & Search
- On startup, the service initializes an `emails` index with proper field mappings (`recipientEmail`, `senderEmail`, `subject`, `body`, `status`).
- On email creation, send, or reschedule, documents are indexed with `refresh: true`.
- If Elasticsearch is not reachable, searches seamlessly fall back to relational DB queries so the dashboard never breaks.

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/google` | Verifies Google ID token and returns session user |
| `POST` | `/api/auth/demo-login` | 1-click test reviewer login |
| `GET` | `/api/auth/me` | Returns current user profile & Slack status |
| `POST` | `/api/emails/schedule` | Schedules single or campaign emails with delay & rate limits |
| `POST` | `/api/emails/upload-leads`| Parses CSV/TXT file and returns detected emails |
| `GET` | `/api/emails/scheduled` | Lists scheduled emails |
| `GET` | `/api/emails/sent` | Lists sent & failed emails with Ethereal preview URLs |
| `GET` | `/api/emails/search?q=...`| Searches emails via Elasticsearch |
| `DELETE`| `/api/emails/:id` | Cancels a scheduled email from queue and DB |
| `GET` | `/api/emails/stats` | Returns queue job counts, sender rates, and DB stats |
| `GET` | `/api/slack/auth-url` | Returns Slack OAuth v2 authorize URL |
| `GET` | `/api/auth/slack/callback`| Handles Slack OAuth redirection |
| `POST` | `/api/slack/connect-webhook`| Connects Slack via Incoming Webhook URL |
| `POST` | `/api/slack/disconnect` | Disconnects Slack integration |
| `POST` | `/api/slack/test` | Triggers a live test rate-limit alert to Slack |
| `GET` | `/admin/queues` | Live BullMQ visual dashboard |

---

## 📋 Assumptions & Design Trade-offs

1. **Database Default**: Uses SQLite locally for instant zero-dependency execution, with a complete PostgreSQL schema (`prisma/schema.postgresql.prisma`) and `docker-compose.yml` for containerized environments.
2. **Elasticsearch Resilience**: Elasticsearch is fully integrated; if an evaluator runs without Docker, searches automatically fall back to the relational database.
3. **Slack Connectivity**: Supports both Slack OAuth v2 and direct Slack Incoming Webhooks to accommodate local development without public HTTPS tunnels.
4. **Idempotency Strategy**: Job IDs in BullMQ match database primary keys (`email.id`).
