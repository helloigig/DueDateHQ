# DueDateHQ — Backend Design & Implementation

> Full backend architecture: stack, data model, APIs, jobs, auth, deployment, phased rollout.
> Pairs with PRD §5/§7, [STATE-NOTIFICATION-IMPLEMENTATION.md](./STATE-NOTIFICATION-IMPLEMENTATION.md), and the design handoffs (UI).

---

## 0 · TL;DR

A boring, cheap, reliable multi-tenant SaaS backend:

- **Stack:** Node.js (TypeScript) · Postgres · Hono on Fly.io · Supabase Auth + Storage · Resend · Cloudflare Workers (scrapers) · Gemini/Claude (LLM)
- **Multi-tenant** via `firm_id` on every row + Postgres Row-Level Security
- **~8 core tables** + ~5 operational tables — all in one Postgres DB
- **APIs:** REST + tRPC for the web app (type-safe with React frontend)
- **No sharding, no microservices, no event bus.** One Postgres + one API + one worker until 10k firms.

The whole thing can be operated by one part-time engineer once stable. That's the target.

---

## 1 · Stack choices (with rationale)

| Layer | Choice | Why this, not X |
|---|---|---|
| **Language** | TypeScript | Same language as frontend; one mental model |
| **API runtime** | Hono on Fly.io (2 regions: US-East + US-West) | Simpler than Cloudflare Workers for stateful connections; better than Node on Render for cold starts |
| **API style** | tRPC for auth'd app routes · REST for public + webhooks | tRPC = end-to-end type safety with React; REST where we need OpenAPI/cURL (public `/changes` API, billing webhooks) |
| **Database** | Supabase Postgres (managed) | Built-in auth, RLS, realtime, file storage — avoids gluing 4 vendors together. Migrate to self-hosted Postgres at ~1k paying firms if cost pressures. |
| **Auth** | Supabase Auth (email/password + magic-link + OAuth) | Cheap, standard, has JWT built-in. Migrate to WorkOS or Clerk if enterprise SSO becomes urgent (Phase 2 Team tier). |
| **File storage** | Supabase Storage | Firm logos, PDF exports (temp), CSV import archives. S3-compatible. |
| **Email** | Resend + React Email | CAN-SPAM primitives built in, great developer DX |
| **LLM** | Gemini 1.5 Flash (primary) + Claude Haiku (fallback) | Cheap, fast structured JSON. See notification doc §4. |
| **Scrapers** | Cloudflare Workers + Durable Objects (per-state cron) | Cheap ($5/month at MVP volume) + edge runtime + isolated state per state |
| **Background jobs** | BullMQ on Fly.io (shared Redis via Upstash) | Simple, reliable, great observability |
| **Observability** | Axiom (logs) + Sentry (errors) | Ship-and-forget, structured logs |
| **Public `/changes`** | Next.js on Vercel (reads from Supabase read-through) | SSR + ISR for SEO; separate bundle from app |
| **Payments** | Stripe (Phase 2, gated to Team tier) | Standard — not MVP work |

### Why not…

- **Not Supabase Edge Functions for API:** timeouts + vendor lock-in. Hono on Fly.io keeps us portable.
- **Not microservices:** 6k customers × 100 clients = ~600k client records. Single Postgres handles this comfortably. Microservices are premature optimization.
- **Not event bus (Kafka, RabbitMQ):** we have maybe 10 event types. Postgres NOTIFY/LISTEN or a BullMQ queue is enough.
- **Not GraphQL:** tRPC gives type safety with less ceremony. GraphQL makes sense for public APIs (Phase 4).

---

## 2 · System architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER                               │
│  React SPA (Vite, existing)        Next.js marketing site        │
│  - Dashboard                        - /changes public page       │
│  - Client mgmt                      - Signup / marketing         │
│  - Announcement detail              - Blog                       │
└──────────────┬─────────────────────────────┬─────────────────────┘
               │                             │
               │ tRPC + HTTPS                │ HTTPS (read-only API)
               ▼                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     API TIER (Fly.io, 2 regions)                 │
│  Hono app                                                        │
│  ├─ /trpc/*           tRPC procedures (auth'd app routes)        │
│  ├─ /api/v1/*         REST (public /changes data, webhooks)      │
│  ├─ /auth/*           Supabase JWT validation                    │
│  └─ /webhooks/*       Stripe, Resend, inbound email              │
└──────────────┬───────────────────────────────────────────────────┘
               │
         ┌─────┴─────┬──────────────┬─────────────┐
         ▼           ▼              ▼             ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
   │ Postgres │ │ Supabase │ │  Redis   │  │  Resend  │
   │(Supabase)│ │  Storage │ │ (Upstash)│  │  (Email) │
   └──────────┘ └──────────┘ └────┬─────┘  └──────────┘
                                  │
                                  ▼
                          ┌──────────────┐
                          │ BullMQ jobs  │   Fly.io worker
                          │  (Fly.io)    │
                          └──────┬───────┘
                                 │
              ┌──────────────────┼─────────────────────┐
              ▼                  ▼                     ▼
       ┌────────────┐     ┌────────────┐        ┌────────────┐
       │ Scheduled  │     │  Reminder  │        │ Escalation │
       │ rollover   │     │  dispatch  │        │  engine    │
       └────────────┘     └────────────┘        └────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    EDGE TIER (Cloudflare Workers)                │
│  Scrapers — one Durable Object per state, cron every 15 min      │
│  → writes new announcements to Postgres via internal API         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│  Gemini 1.5 Flash · Claude Haiku · Resend · Stripe · Axiom      │
└──────────────────────────────────────────────────────────────────┘
```

### Request lifecycle (typical)

1. User loads dashboard → React SPA hits `GET /trpc/dashboard.getTriage`
2. API validates Supabase JWT → extracts `user_id`, `firm_id`
3. Query Postgres with RLS (`firm_id` auto-injected)
4. Return serialized response
5. React renders

### Announcement detection lifecycle

1. Cloudflare Worker cron fires (every 15 min, per state)
2. Scraper fetches source, computes content hash, dedupes
3. If new → POST to internal API `/api/v1/scraper/submit` (shared secret auth)
4. API persists raw announcement, enqueues BullMQ job `parse-announcement`
5. Worker picks up job → calls Gemini → validates schema → stores parsed output
6. Worker enqueues `match-announcement` → creates `affected_client` rows per firm
7. Worker enqueues `notify-firm` per firm with affected clients
8. Notify job: creates `firm_announcement` row, sends email (or queues for digest)
9. Next dashboard load for each affected firm → banner appears

---

## 3 · Information architecture — full schema

All tables have: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.

All firm-scoped tables have: `firm_id uuid references firms(id) not null`, with an index.

### 3.1 · Tenancy & auth

```sql
-- Top-level tenant
create table firms (
  id uuid primary key,
  name text not null,
  primary_states text[] not null default '{}',
  postal_address jsonb,
  logo_storage_key text,                  -- Supabase Storage path
  branding jsonb,                         -- { primary_color, email_signature }
  tier text not null default 'solo',      -- 'solo' | 'pro' | 'team'
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_ends_at timestamptz,
  subscription_status text not null default 'trialing',  
    -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended'
  seat_limit int not null default 1,
  client_limit int,                       -- null = unlimited (Pro+)
  created_at timestamptz, updated_at timestamptz
);

-- User = person; links to Supabase auth.users
create table users (
  id uuid primary key references auth.users(id),
  firm_id uuid references firms(id) not null,
  email text not null,
  display_name text,
  role text not null default 'member',    -- 'owner' | 'member'
  timezone text default 'America/New_York',
  invited_by_user_id uuid references users(id),
  invited_at timestamptz,
  accepted_invite_at timestamptz,
  last_active_at timestamptz
);
create index on users(firm_id);

-- Invitations (before user exists)
create table firm_invitations (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  email text not null,
  role text not null default 'member',
  token text unique not null,
  invited_by_user_id uuid references users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz
);
create unique index on firm_invitations(firm_id, email) where accepted_at is null;
```

### 3.2 · Clients, contacts, relationships

```sql
create table clients (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  name text not null,
  entity_type text not null,              -- 'LLC' | 'S-Corp' | 'C-Corp' | 'Partnership' | 'Individual' | 'Trust' | 'Non-profit'
  primary_state text not null,            -- 'CA', 'TX', etc.
  nexus_states text[] not null default '{}',
  county text,                            -- for disaster-extension matching
  status text not null default 'active',  -- 'active' | 'inactive' | 'prospect' | 'archived'
  archived_at timestamptz,
  notes text default '',
  created_at timestamptz, updated_at timestamptz
);
create index on clients(firm_id);
create index on clients(firm_id, status);
create index on clients(primary_state);
create index on clients(firm_id, name);  -- search
-- GIN index for nexus_states overlap queries
create index on clients using gin(nexus_states);

-- Contacts (1-N per client)
create table contacts (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  name text,
  email text,
  phone text,
  is_primary boolean default false,
  email_verified boolean default false,
  email_bounces_consecutive int default 0,
  created_at timestamptz, updated_at timestamptz
);
create unique index on contacts(client_id) where is_primary = true;
create index on contacts(firm_id);

-- Related clients (for K-1 chains across clients)
create table client_relationships (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  parent_client_id uuid references clients(id) on delete cascade not null,  -- the entity (e.g., 1065)
  child_client_id uuid references clients(id) on delete cascade not null,   -- the partner (e.g., 1040 receiving K-1)
  relationship_type text not null,        -- 'partner' | 'shareholder' | 'spouse'
  created_at timestamptz
);
create unique index on client_relationships(parent_client_id, child_client_id);
```

### 3.3 · Service Packages, Services, Deadlines

```sql
-- Library of pre-built + custom filing bundles
create table service_packages (
  id uuid primary key,
  firm_id uuid references firms(id),      -- nullable = system (shared)
  name text not null,
  description text,
  applicable_entity_types text[] not null default '{}',
  applicable_states text[] not null default '{}',
  is_system boolean default false,        -- true for ~30 pre-built
  created_at timestamptz, updated_at timestamptz
);
create index on service_packages(firm_id);

-- A service template = one filing obligation inside a package
create table service_templates (
  id uuid primary key,
  firm_id uuid references firms(id),      -- null for system packages' templates
  package_id uuid references service_packages(id) on delete cascade not null,
  form_name text not null,                -- '1120-S', 'CA Form 568'
  jurisdiction text not null,             -- 'federal' | 'CA' | 'NYC' etc.
  tax_type text not null,                 -- 'state_income' | 'pte' | 'q_estimates' | ...
  due_date_rule jsonb not null,           -- { type: 'fixed_day', month: 3, day: 15 } | { type: 'n_days_after_yearend', n: 105 }
  rollover_rule text,                     -- 'annual' | 'quarterly' | 'monthly' | null
  reminder_schedule jsonb default '[]',   -- [{ offset_days: -30, template_key: 'initial' }, ...]
  depends_on_template_id uuid references service_templates(id)
);
create index on service_templates(package_id);

-- Client ↔ Package assignment (many-to-many)
create table client_service_packages (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  package_id uuid references service_packages(id) not null,
  assigned_at timestamptz,
  assigned_by_user_id uuid references users(id),
  source text default 'manual'            -- 'ai_suggested' | 'manual' | 'imported'
);
create unique index on client_service_packages(client_id, package_id);

-- Instances of service_templates for a client = deadlines
create table deadlines (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  service_template_id uuid references service_templates(id) not null,
  form_name text not null,                -- denormalized for faster triage queries
  jurisdiction text not null,             -- denormalized
  tax_type text not null,                 -- denormalized
  official_due_date date not null,
  adjusted_due_date date not null,        -- post weekend/holiday shift
  internal_target_date date,              -- CPA's working deadline
  client_prep_date date,
  file_by_date date,
  pay_by_date date,
  status text not null default 'not_started',
    -- 'not_started' | 'in_progress' | 'completed' | 'deferred' | 'filed_extension' | 'overdue'
  assigned_user_id uuid references users(id),
  completed_at timestamptz,
  completed_by_user_id uuid references users(id),
  extended_from_deadline_id uuid references deadlines(id),  -- for extension chain
  extension_submitted_at timestamptz,
  extension_approved_at timestamptz,
  notes text,
  created_at timestamptz, updated_at timestamptz
);
create index on deadlines(firm_id);
create index on deadlines(firm_id, status, adjusted_due_date);
create index on deadlines(firm_id, client_id);
create index on deadlines(firm_id, assigned_user_id);
create index on deadlines(firm_id, tax_type, adjusted_due_date);  -- for announcement matching

-- Activity log per client (system-generated events only)
create table client_activity (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  actor_user_id uuid references users(id),
  actor_name text not null,               -- denormalized for long-term display
  type text not null,                     
    -- 'status_change' | 'deadline_added' | 'deadline_updated' | 
    -- 'extension_filed' | 'client_created' | 'client_edited' | 
    -- 'client_archived' | 'batch_adjust' | 'note_added' | 'bundle_assigned'
  summary text not null,                  -- human-readable
  metadata jsonb,
  created_at timestamptz
);
create index on client_activity(firm_id, client_id, created_at desc);
```

### 3.4 · Notes

```sql
create table client_notes (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  body text not null,
  author_user_id uuid references users(id),
  author_name text not null,              -- denormalized
  pinned boolean default false,
  created_at timestamptz, updated_at timestamptz
);
create index on client_notes(firm_id, client_id, created_at desc);
create index on client_notes(firm_id, client_id) where pinned = true;
```

### 3.5 · State announcement system

Full schema in [STATE-NOTIFICATION-IMPLEMENTATION.md](./STATE-NOTIFICATION-IMPLEMENTATION.md) §2. Summary:

```sql
create table announcements (/* see notification doc §2 */);
create table affected_clients (/* join table, materialized on publish + nightly */);
create table firm_announcements (/* per-firm state: ack/snooze/dismiss, escalation */);
create table source_monitors (/* ops: per-state scraper health */);
```

### 3.6 · Reminders

```sql
-- Queued reminders (scheduled by cron based on service_template.reminder_schedule)
create table reminders (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  deadline_id uuid references deadlines(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete cascade not null,
  template_key text not null,             -- 'initial' | 't_minus_14' | 't_minus_7' | 't_minus_1'
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  bounce_reason text,
  opened_at timestamptz,
  clicked_at timestamptz,
  status text not null default 'pending'  -- 'pending' | 'sent' | 'bounced' | 'canceled'
);
create index on reminders(scheduled_for) where status = 'pending';
create index on reminders(firm_id, deadline_id);

-- Custom reminder templates per firm
create table reminder_templates (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  package_id uuid references service_packages(id),  -- null = firm default
  template_key text not null,
  subject text not null,
  body_mdx text not null,                 -- supports {{client_name}}, {{deadline}}, {{days_until}}
  send_time_of_day time default '09:00',
  active boolean default true,
  created_at timestamptz, updated_at timestamptz
);
create unique index on reminder_templates(firm_id, package_id, template_key);
```

### 3.7 · Imports, exports, notifications

```sql
-- CSV import runs (7-day undo window)
create table imports (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  initiated_by_user_id uuid references users(id),
  source_format text,                     -- 'taxdome' | 'drake' | 'proconnect' | 'quickbooks' | 'file_in_time' | 'excel'
  original_filename text,
  storage_key text,                       -- Supabase Storage: archived CSV
  clients_created int default 0,
  deadlines_created int default 0,
  rows_failed int default 0,
  failed_rows jsonb,                      -- for re-run
  status text not null default 'in_progress',  -- 'in_progress' | 'committed' | 'undone' | 'failed'
  committed_at timestamptz,
  undone_at timestamptz,
  created_at timestamptz
);
create index on imports(firm_id, created_at desc);

-- Export history (audit trail + async downloads for large exports)
create table exports (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  requested_by_user_id uuid references users(id),
  scope jsonb not null,                   -- { type: 'filtered' | 'all' | 'date_range' | 'client', ... }
  format text not null,                   -- 'pdf' | 'csv' | 'ical'
  recipient jsonb not null,               -- { type: 'download' | 'email_self' | 'email_other', target?: string }
  storage_key text,                       -- temp file path
  expires_at timestamptz,                 -- 7 days for downloads
  status text default 'generating',       -- 'generating' | 'ready' | 'sent' | 'expired'
  created_at timestamptz
);
create index on exports(firm_id, created_at desc);

-- Per-user notification center (A2 unified feed)
create table notifications (
  id uuid primary key,
  firm_id uuid references firms(id) not null,
  user_id uuid references users(id) not null,
  kind text not null,                     
    -- 'state_announcement' | 'email_bounce' | 'team_invite' | 
    -- 'extension_approved' | 'reminder_digest' | 'import_complete'
  payload jsonb not null,                 -- kind-specific fields
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz
);
create index on notifications(user_id, created_at desc);
create index on notifications(user_id) where read_at is null;

-- Per-user notification preferences
create table notification_preferences (
  user_id uuid primary key references users(id),
  email_delivery_mode text default 'digest',  -- 'digest' | 'per_alert'
  digest_hour int default 8,
  digest_timezone text default 'America/New_York',
  in_app_banner boolean default true,
  bell_badge boolean default true,
  reminder_sent_digest boolean default false,
  updated_at timestamptz
);
```

### 3.8 · Ops / operational

```sql
-- Background job failures (for retry + ops visibility)
create table job_failures (
  id uuid primary key,
  job_name text not null,
  job_data jsonb,
  error text,
  stack_trace text,
  attempts int default 1,
  will_retry_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz
);
create index on job_failures(job_name, created_at desc) where resolved_at is null;

-- Audit log (security-sensitive actions only)
create table audit_log (
  id uuid primary key,
  firm_id uuid references firms(id),
  user_id uuid references users(id),
  action text not null,                   -- 'login' | 'password_reset' | 'role_change' | 'export_sensitive' | 'delete_client' ...
  target_type text,
  target_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz
);
create index on audit_log(firm_id, created_at desc);
create index on audit_log(user_id, created_at desc);
```

---

## 4 · Multi-tenancy (firm isolation)

### 4.1 · Row-Level Security (RLS)

Every firm-scoped table has a policy:

```sql
-- Example for clients
alter table clients enable row level security;

create policy clients_firm_isolation on clients
  for all
  using (
    firm_id = (
      select firm_id from users where id = auth.uid()
    )
  )
  with check (
    firm_id = (
      select firm_id from users where id = auth.uid()
    )
  );
```

### 4.2 · API-level enforcement (defense in depth)

Even with RLS, every tRPC procedure starts with:

```ts
const ctx = await getContext(req)  // { userId, firmId }
if (!ctx.firmId) throw new TRPCError({ code: 'UNAUTHORIZED' })
// All queries then use ctx.firmId explicitly, not trusting RLS alone
```

### 4.3 · Cross-firm operations

Only **announcements** (system-level) and **service_packages** (system-level) span firms. Everything else is strictly firm-scoped. No cross-firm joins ever.

---

## 5 · API design

### 5.1 · tRPC procedures (auth'd app routes)

Grouped by domain. All procedures auto-inject `firmId` from JWT.

```ts
router({
  auth: router({
    session: procedure.query(),             // current user + firm + tier
    inviteTeammate: procedure.mutation(),   // Team tier
    acceptInvite: procedure.mutation(),
    updateProfile: procedure.mutation(),
  }),

  firm: router({
    get: procedure.query(),
    update: procedure.mutation(),
    setBranding: procedure.mutation(),
    uploadLogo: procedure.mutation(),       // returns signed upload URL
  }),

  clients: router({
    list: procedure.input({ filters, search }).query(),
    get: procedure.input({ id }).query(),
    create: procedure.mutation(),
    update: procedure.mutation(),
    archive: procedure.mutation(),
    previewPackageChange: procedure.query(),  // B6 migration preview
    applyPackageChange: procedure.mutation(),
    linkRelated: procedure.mutation(),
  }),

  deadlines: router({
    listForTriage: procedure.input({ bucket, filters }).query(),
    get: procedure.input({ id }).query(),
    updateStatus: procedure.mutation(),     // complete | defer | extension
    addNote: procedure.mutation(),
    batchAdjust: procedure.mutation(),      // from announcement
    quickAdd: procedure.mutation(),         // client detail +Deadline
  }),

  servicePackages: router({
    list: procedure.query(),                // system + firm custom
    get: procedure.input({ id }).query(),
    clone: procedure.mutation(),            // system → firm custom
    updateCustom: procedure.mutation(),
    assignToClient: procedure.mutation(),
    suggestForClient: procedure.query(),    // AI suggestion by entity+state
  }),

  announcements: router({
    list: procedure.input({ filters }).query(),  // firm's announcement history
    get: procedure.input({ id }).query(),
    acknowledge: procedure.mutation(),
    snooze: procedure.mutation(),           // snooze 24h + optional reason
    dismiss: procedure.mutation(),          // not applicable; requires reason
    batchAdjustDeadlines: procedure.mutation(),  // with preview + confirm
  }),

  notifications: router({
    list: procedure.input({ unreadOnly }).query(),
    markRead: procedure.mutation(),
    dismiss: procedure.mutation(),
    updatePreferences: procedure.mutation(),
  }),

  reminders: router({
    listTemplates: procedure.query(),
    updateTemplate: procedure.mutation(),
    previewReminder: procedure.query(),     // render with mock deadline
    sendNow: procedure.mutation(),          // manual override
  }),

  imports: router({
    detectFormat: procedure.mutation(),     // takes CSV header row
    suggestFieldMapping: procedure.mutation(),  // LLM-based
    preview: procedure.mutation(),
    commit: procedure.mutation(),
    listHistory: procedure.query(),
    undo: procedure.mutation(),             // within 7d
  }),

  exports: router({
    request: procedure.mutation(),          // returns { exportId, downloadUrl | null }
    status: procedure.input({ id }).query(),
  }),

  team: router({
    list: procedure.query(),                // members + pending invites
    invite: procedure.mutation(),
    updateRole: procedure.mutation(),
    remove: procedure.mutation(),           // shows client-assignment reversion preview
  }),
})
```

### 5.2 · REST endpoints (public + webhooks)

```
# Public
GET    /api/v1/changes                   → list all announcements (paginated)
GET    /api/v1/changes/:id               → single announcement detail
GET    /api/v1/changes.rss               → RSS feed

# Scrapers (shared-secret auth)
POST   /api/v1/internal/scraper/submit   → ingest raw scrape

# Webhooks
POST   /webhooks/stripe                  → subscription lifecycle
POST   /webhooks/resend                  → email events (bounce, complaint)
POST   /webhooks/inbound-email           → (Phase 2) client reply routing

# Health
GET    /health                           → { status: 'ok', version }
GET    /api/v1/ops/source-health         → auth'd; ops dashboard
```

---

## 6 · Service modules (logical layout of `src/server/`)

```
src/server/
├── modules/
│   ├── auth/            # Supabase JWT validation, invite flow
│   ├── firms/           # tenancy, tier gating, limits
│   ├── clients/         # CRUD, archival, related clients
│   ├── deadlines/       # status machine, weekend/holiday, rollover
│   ├── packages/        # Service Package library, suggest, migration preview
│   ├── announcements/   # detection pipeline (see notification doc)
│   ├── reminders/       # template rendering, scheduling, delivery
│   ├── imports/         # CSV detection, mapping, commit, undo
│   ├── exports/         # PDF/CSV/iCal generation
│   ├── notifications/   # unified center, preferences
│   ├── team/            # invites, roles, removal reversion
│   └── billing/         # Stripe (Phase 2 primarily)
├── jobs/                # BullMQ workers (see §7)
├── trpc/                # procedure definitions
├── rest/                # public REST routes + webhooks
├── lib/
│   ├── db.ts            # Postgres client (Kysely or Drizzle)
│   ├── llm.ts           # Gemini + Claude clients, prompt helpers
│   ├── email.ts         # Resend wrapper with CAN-SPAM
│   ├── storage.ts       # Supabase Storage
│   └── dates.ts         # weekend/holiday shift, tabular formatting
└── index.ts             # Hono app bootstrap
```

### 6.1 · Module responsibilities

**deadlines**: the state machine + weekend/holiday adjustment lives here. Any state transition goes through `updateStatus()` which also writes `client_activity`.

**packages**: encodes the 30 pre-built library as seed data. AI suggestion uses LLM on entity + state → package choice. Migration preview computes diffs using pure SQL (no LLM).

**announcements**: mostly in the notification doc. API surface is small: list / ack / snooze / dismiss / batch-adjust.

**reminders**: scheduler generates `reminders` rows on deadline creation/update. Dispatcher job runs every 5 min, sends due reminders, handles bounces.

**imports**: uses LLM for field detection + entity-type recognition. Commit creates all the rows in a single transaction + enqueues deadline generation as a job. Undo soft-deletes based on `imports.id`.

**exports**: synchronous for small requests (< 100 rows), async for larger (queued). PDF via Puppeteer or `@react-pdf/renderer`. iCal via `ical-generator`.

---

## 7 · Background jobs (BullMQ on Fly.io)

### 7.1 · Inventory

| Queue | Trigger | Frequency | Duration |
|---|---|---|---|
| `parse-announcement` | New scrape ingested | on-demand | 2–5s (LLM call) |
| `match-announcement` | Announcement published | on-demand | 1–3s |
| `notify-firm-announcement` | Per matched firm | on-demand | < 1s (email queue) |
| `send-reminder` | `reminders.scheduled_for` ≤ now | every 5 min | < 1s |
| `escalate-announcements` | Cron hourly | hourly | < 10s |
| `rollover-deadlines` | Deadline completed | on-demand | < 1s |
| `generate-deadlines-for-import` | Import committed | on-demand | seconds to minutes |
| `rematch-announcements` | Client added/edited | nightly cron | < 5 min |
| `digest-email` | Cron hourly (timezone sweep) | hourly | < 1 min |
| `export-generate` | Export request | on-demand | 1–30s (PDF) |
| `scraper-health-check` | Cron hourly | hourly | < 10s |
| `trial-lifecycle` | Cron daily | daily at 2am UTC | < 1 min |

### 7.2 · Retry & failure

- BullMQ default: 3 attempts, exponential backoff
- On final failure: write to `job_failures` table + Sentry event
- Ops Slack channel gets notified for P0 jobs (`notify-firm-announcement` failures)

### 7.3 · Idempotency

Every job is idempotent. Keys used:
- `match-announcement` → idempotent on `announcement_id`
- `notify-firm-announcement` → idempotent on `(announcement_id, firm_id)` via unique constraint on `firm_announcements`
- `send-reminder` → `reminders.sent_at IS NOT NULL` check before SMTP call

---

## 8 · Auth & security

### 8.1 · Auth model

- **Supabase Auth** for email/password + password reset + magic-link
- JWT validated on every API request; claims include `user_id` + `firm_id`
- 7-day rolling session; refresh via Supabase client
- Future: OAuth (Google), SSO (SAML) when Team tier demands

### 8.2 · Secrets & encryption

- Env vars via Fly.io secrets + Supabase dashboard
- Database at rest: encrypted by Supabase (AES-256)
- TLS 1.3 on all traffic
- Passwords: argon2id via Supabase Auth (managed)
- No SSN / EIN stored (PRD §7.3)

### 8.3 · Rate limiting

- Global: 100 req/min per IP (Cloudflare)
- Per-user: 600 req/min on authenticated routes (Upstash Redis token bucket)
- LLM-backed procedures (`importSuggestFieldMapping`, `suggestForClient`): 20/min per firm

### 8.4 · CSRF, XSS, CORS

- SPA uses `SameSite=Lax` session cookies + JWT in Authorization header
- CORS: allow-list frontend origins only
- Strict CSP headers served by the Next.js site and proxied by Hono

### 8.5 · Data residency

- US-only Postgres region at MVP (PRD §7.3)
- Canadian / UK: Phase 2+, via per-region Supabase project

### 8.6 · SOC 2 readiness (Phase 2 target)

- Audit log already present (§3.8)
- Observability via Axiom + Sentry
- Incident runbook to be drafted before SOC 2 kickoff

---

## 9 · Deployment architecture

### 9.1 · Environments

| Env | URL | DB | Purpose |
|---|---|---|---|
| local | localhost | local Postgres (Docker) | Dev |
| preview | `pr-{n}.duedatehq.dev` | ephemeral Supabase branch | Per-PR preview |
| staging | `staging.duedatehq.com` | Supabase staging project | Pre-prod QA |
| production | `app.duedatehq.com` | Supabase prod project | Live |

### 9.2 · CI/CD

- GitHub Actions on PR:
  - Typecheck, lint, unit tests, integration tests (with real Postgres via Docker)
  - Preview deploy to Fly.io + Supabase branch
- On merge to `main`:
  - Migrate staging → run smoke tests → deploy prod behind a feature flag gate
- Migrations via Drizzle or Supabase CLI

### 9.3 · Regions

- **API:** Fly.io `iad` (Virginia) + `sjc` (San Jose)
- **DB:** Supabase `us-east-1`
- **Scrapers:** Cloudflare global (closest edge per state)
- **Email:** Resend (global)

---

## 10 · Dev environment

### 10.1 · Local setup

```bash
# One-time
pnpm install
docker compose up -d  # Postgres + Redis
cp .env.example .env
pnpm db:migrate
pnpm db:seed  # loads 30 system Service Packages + mock state announcements

# Daily
pnpm dev         # starts API (3001) + web (5173) + workers concurrently
pnpm test        # runs unit + integration
pnpm test:e2e    # Playwright against a real preview
```

### 10.2 · Seed data

- Firm: `Test CPA Firm` with Owner `test@duedatehq.com`
- 20 clients across LA / CA / TX
- 3 sample state announcements (1 disaster extension with affected clients)
- 30 system Service Packages
- 1 pending import run (for undo testing)

---

## 11 · Implementation phases

### Phase 0 — Foundation (1 week)
Setup only. No user-facing functionality.

1. Supabase project + schema migration 0001 (firms, users)
2. Hono + tRPC skeleton on Fly.io
3. Auth wiring (Supabase JWT → tRPC context)
4. Dev environment + seed scripts
5. CI/CD basic

**Exit:** hello-world `auth.session` procedure returns current user.

### Phase 1 — Core CRUD (2 weeks)

Everything users need to manage the 80-client portfolio, *without* announcements.

1. Migrations: clients, contacts, service_packages, service_templates, client_service_packages, deadlines, client_activity, client_notes
2. tRPC procedures: clients.*, deadlines.*, servicePackages.*, (minimal) team.*
3. RLS policies on all firm-scoped tables
4. Seed 30 pre-built Service Packages
5. Weekend/holiday date adjustment
6. Rollover engine

**Exit:** new firm can sign up, add clients, have deadlines auto-generate from a package, view triage dashboard.

### Phase 2 — Import / export / reminders (2 weeks)

1. CSV import (AI field detection + commit + undo)
2. Export (PDF/CSV/iCal with the three-axis modal)
3. Reminders: templates, scheduler, dispatcher, bounce handling
4. Resend integration
5. Storage for logos + export temp files

**Exit:** a CPA can migrate from File In Time's CSV, customize reminders, export for a client.

### Phase 3 — State announcements (3 weeks)

See [STATE-NOTIFICATION-IMPLEMENTATION.md](./STATE-NOTIFICATION-IMPLEMENTATION.md) for detail.

1. Scraper worker (CA first, top 10 next)
2. Announcement table + LLM parser
3. Affected-client matcher
4. Notifier (email + in-app banner + unified notification center)
5. Escalation engine
6. Confirm modal on batch-adjust
7. Public `/changes` page

**Exit:** 10 states covered, 6-month backfill published, 1 real announcement actioned end-to-end.

### Phase 4 — Team, billing, polish (2 weeks)

1. Team invites, roles, assignment reversion
2. Stripe billing integration + trial lifecycle
3. Team-tier feature gates
4. Observability dashboards (Axiom queries, Grafana via Supabase)
5. Load testing

**Exit:** paying firm can onboard, upgrade/downgrade, invite teammates, and hit 99.9% uptime target.

### Phase 5 — Expand scrapers (ongoing)
Remaining 40 states + DC + SoS. Incremental.

---

## 12 · Out of scope (stated, not built)

- Client portal (never)
- Document storage / vault (never)
- Time tracking / billing beyond subscription (never)
- Native mobile apps (Phase 2+ of roadmap, not backend MVP)
- Tax prep integration (API only, Phase 4)
- SSO/SAML (Phase 2 Team tier if demanded)
- Native desktop app (never — that's File In Time's trap)
- Event sourcing / CQRS (not needed at this scale)
- Microservices (not until 10k firms)
- Multi-region writes (MVP is single-region US)

---

## 13 · Integration map

| This doc | Pairs with |
|---|---|
| §3 Data model | PRD §5 (extends), [STATE-NOTIFICATION-IMPLEMENTATION.md](./STATE-NOTIFICATION-IMPLEMENTATION.md) §2 |
| §5 API | [DESIGN-HANDOFF.md](./DESIGN-HANDOFF.md) behavior tasks (T3–T10) call these procedures |
| §6.6 Announcements module | [STATE-NOTIFICATION-IMPLEMENTATION.md](./STATE-NOTIFICATION-IMPLEMENTATION.md) (authoritative) |
| §7 Jobs | [DESIGN-HANDOFF-ADDENDUM.md](./DESIGN-HANDOFF-ADDENDUM.md) B1 (escalation), B7 (digest), B9 (extension tracking) |
| §8 Auth | PRD §7.3 |
| §11 Phases | Roadmap from [_archive/pm-strategy-reference/strategy-06-roadmap.md](_archive/pm-strategy-reference/strategy-06-roadmap.md) Q2 → Q4 |

---

*v1 · 2026-04-24 · backend architecture + implementation plan. Self-contained. Execute Phase 0 → Phase 4 sequentially; Phase 5 parallel.*
