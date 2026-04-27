# Frontend Integration Prep — Getting the SPA Ready for the Backend

> Instructions for the frontend Claude Code session to prepare clean integration points (接口) so the backend can land without a frontend rewrite.
>
> **Pairs with:** [BACKEND-IMPLEMENTATION.md](./BACKEND-IMPLEMENTATION.md), [STATE-NOTIFICATION-IMPLEMENTATION.md](./STATE-NOTIFICATION-IMPLEMENTATION.md), [DESIGN-HANDOFF.md](./DESIGN-HANDOFF.md), [DESIGN-HANDOFF-ADDENDUM.md](./DESIGN-HANDOFF-ADDENDUM.md) (v1.3).

---

## 0 · Why you're doing this now

A backend session will start shortly using the committed stack: **Supabase + Fly.io + Hono + tRPC + Drizzle + BullMQ**. The goal of this prep is:

- **Components stop reading directly from `src/data/store.ts`.** They read from **hooks** that will later be thin wrappers over tRPC.
- **Types live in one place and match what the backend will expose.** Any drift becomes integration pain.
- **Every data access has loading / error / empty states.** The mock store never fails; the real API will. Design for that now.
- **Auth surfaces exist.** Signup, login, session handling, invite-accept — stubbed but shaped correctly.
- **Environment is parameterized.** No hardcoded URLs or assumed data.

**You are still in the "behavior only" scope from the DESIGN-HANDOFF-ADDENDUM.** No visual token work. This prep is structural refactoring + adding missing surfaces. Keep current styling.

---

## 1 · Order of operations

Do these in order. Don't skip ahead.

1. **Finish in-flight DESIGN-HANDOFF-ADDENDUM §D.1 behavior tasks** (T3, T4, T4b, T5, T5b, T5d, T6, T7, T7b, T9b, T10b). Integration prep is the next pass.
2. **Install React Query + tRPC client packages** — zero-cost now, used later.
3. **Refactor data layer** (§3 below) — this is the biggest piece.
4. **Define shared types** (§4) — matches what backend will return.
5. **Scaffold auth surfaces** (§5) — login/signup/invite screens + session context.
6. **Add loading + error + empty states** (§6) where missing.
7. **Add realtime-announcement polling stub** (§7).
8. **Add file-upload scaffold** for CSV + logo (§8).
9. **Add tier-based feature flag hooks** (§9).
10. **Parameterize env + create `.env.example`** (§10).

After step 10, the frontend is "backend-ready." When the backend ships Phase 0, you swap the mock tRPC client for the real one and 80% of the work is a URL change.

---

## 2 · Install these packages

```bash
npm i @tanstack/react-query @trpc/client @trpc/react-query @trpc/server
npm i zod
npm i -D @types/node
```

Rationale:
- **`@tanstack/react-query`** — powers tRPC client; provides cache, optimistic updates, pagination, real-time invalidation
- **`@trpc/*`** — the client and server types; even though we won't wire a real server yet, we'll define the router shape so types are ready
- **`zod`** — shared validation schemas between frontend and backend; used by tRPC for input validation

---

## 3 · Refactor the data layer

This is the core of the prep. Right now `src/data/store.ts` is imported directly across components. You're going to wrap it so components don't notice when it swaps.

### 3.1 · Target structure

```
src/
├── lib/
│   ├── api/
│   │   ├── client.ts              # tRPC client (mock now, real later)
│   │   ├── router.ts              # tRPC AppRouter type — mirrors backend
│   │   ├── mock-adapter.ts        # Mock implementation of the router, reads from store
│   │   └── hooks.ts               # Re-exports `trpc.X.useQuery()` style hooks
│   ├── query-client.ts            # React Query client singleton
│   └── session.ts                 # Session context (mock now, Supabase later)
├── hooks/
│   ├── useClients.ts              # Wraps trpc.clients.list.useQuery
│   ├── useClient.ts               # Wraps trpc.clients.get.useQuery
│   ├── useDeadlines.ts            # Wraps trpc.deadlines.listForTriage.useQuery
│   ├── useAnnouncements.ts
│   ├── useServicePackages.ts
│   ├── useNotifications.ts
│   ├── useSession.ts              # Current user + firm + tier
│   ├── useFirm.ts
│   ├── useFeatureFlags.ts         # Tier-gated flags
│   └── useRealtimeAnnouncements.ts
└── data/                          # Existing — remains for now as the mock source
    ├── store.ts                   # Becomes the mock adapter's data source
    ├── mockClients.ts
    └── ...
```

### 3.2 · Step-by-step

**Step 1 — Create the tRPC router type stub** (`src/lib/api/router.ts`):

```ts
// This file mirrors what the backend will expose.
// It exists BEFORE the backend is built so frontend can type-check against it.

import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import type {
  Client, Deadline, Announcement, ServicePackage,
  Firm, User, Notification, ImportRun, ReminderTemplate,
} from '../../types'

const t = initTRPC.create()

export const appRouter = t.router({
  auth: t.router({
    session: t.procedure.query(async (): Promise<{
      user: User; firm: Firm; tier: 'solo' | 'pro' | 'team'
    } | null> => { throw new Error('Not implemented') }),
    login: t.procedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async () => { throw new Error('Not implemented') }),
    signup: t.procedure
      .input(z.object({ email: z.string().email(), password: z.string(), firmName: z.string() }))
      .mutation(async () => { throw new Error('Not implemented') }),
    logout: t.procedure.mutation(async () => { throw new Error('Not implemented') }),
    acceptInvite: t.procedure
      .input(z.object({ token: z.string(), password: z.string() }))
      .mutation(async () => { throw new Error('Not implemented') }),
  }),

  clients: t.router({
    list: t.procedure
      .input(z.object({
        search: z.string().optional(),
        state: z.array(z.string()).optional(),
        entityType: z.array(z.string()).optional(),
        status: z.array(z.string()).optional(),
        hasDeadlineThisWeek: z.boolean().optional(),
        assigneeId: z.string().optional(),
        cursor: z.string().optional(),
      }))
      .query(async (): Promise<{ items: Client[]; nextCursor?: string }> => {
        throw new Error('Not implemented')
      }),
    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(async (): Promise<Client | null> => { throw new Error('Not implemented') }),
    create: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    update: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    archive: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    previewPackageChange: t.procedure.input(z.any()).query(async () => { throw new Error('Not implemented') }),
    applyPackageChange: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
  }),

  deadlines: t.router({
    listForTriage: t.procedure
      .input(z.object({
        bucket: z.enum(['overdue', 'this_week', 'this_month', 'long_term']).optional(),
        filters: z.any().optional(),
      }))
      .query(async (): Promise<{
        overdue: Deadline[]; thisWeek: Deadline[];
        thisMonth: Deadline[]; longTerm: Deadline[];
      }> => { throw new Error('Not implemented') }),
    updateStatus: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    addNote: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    batchAdjust: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    quickAdd: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
  }),

  servicePackages: t.router({
    list: t.procedure.query(async (): Promise<ServicePackage[]> => { throw new Error('Not implemented') }),
    suggestForClient: t.procedure.input(z.any()).query(async () => { throw new Error('Not implemented') }),
    assignToClient: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    clone: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    updateCustom: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
  }),

  announcements: t.router({
    list: t.procedure.query(async (): Promise<Announcement[]> => { throw new Error('Not implemented') }),
    get: t.procedure.input(z.object({ id: z.string() })).query(async () => { throw new Error('Not implemented') }),
    acknowledge: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    snooze: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    dismiss: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    batchAdjustDeadlines: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
  }),

  notifications: t.router({
    list: t.procedure.input(z.any()).query(async (): Promise<Notification[]> => { throw new Error('Not implemented') }),
    markRead: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    dismiss: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    updatePreferences: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
  }),

  imports: t.router({
    detectFormat: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    suggestFieldMapping: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    preview: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    commit: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    listHistory: t.procedure.query(async (): Promise<ImportRun[]> => { throw new Error('Not implemented') }),
    undo: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
  }),

  exports: t.router({
    request: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    status: t.procedure.input(z.any()).query(async () => { throw new Error('Not implemented') }),
  }),

  team: t.router({
    list: t.procedure.query(async () => { throw new Error('Not implemented') }),
    invite: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    updateRole: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
    remove: t.procedure.input(z.any()).mutation(async () => { throw new Error('Not implemented') }),
  }),
})

export type AppRouter = typeof appRouter
```

**Step 2 — Create a mock adapter** (`src/lib/api/mock-adapter.ts`):

Implements all the procedures above using the current `store.ts` data. Returns after a realistic 100–300ms delay to catch loading-state bugs.

```ts
import { useStore, actions } from '../../data/store'
import type { AppRouter } from './router'

const delay = (ms = 150) => new Promise(r => setTimeout(r, ms + Math.random() * 100))

export const mockAdapter = {
  auth: {
    session: async () => {
      await delay()
      return {
        user: { id: 'u1', email: 'sarah@example.com', displayName: 'Sarah Chen', role: 'owner' },
        firm: { id: 'f1', name: 'Sarah Chen, CPA', tier: 'pro' },
        tier: 'pro' as const,
      }
    },
    login: async ({ email, password }) => {
      await delay(500)
      if (password !== 'demo') throw new Error('Invalid credentials')
      return { ok: true }
    },
    // ...
  },
  clients: {
    list: async (input) => {
      await delay()
      const { clients } = useStore.getState()
      // apply filters from input.search, input.state, etc.
      return { items: filtered(clients, input), nextCursor: undefined }
    },
    // ...
  },
  // ... one entry per router procedure
}
```

**Step 3 — Create the tRPC client** (`src/lib/api/client.ts`):

For the mock phase, we don't actually call a server. We build a proxy that routes procedure calls to the mock adapter:

```ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from './router'

export const trpc = createTRPCReact<AppRouter>()

// A tiny custom link that routes to the mock adapter in local/dev,
// and to the real HTTP endpoint in production.
// When backend ships, swap this for httpBatchLink({ url: env.VITE_API_URL }).
```

**Step 4 — Wrap with QueryClient + Provider** (`src/main.tsx`):

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc } from './lib/api/client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
})

const trpcClient = trpc.createClient({ /* mock or real link */ })

root.render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
)
```

**Step 5 — Create hook wrappers** (`src/hooks/use*.ts`):

```ts
// src/hooks/useClients.ts
import { trpc } from '../lib/api/client'

export function useClients(filters: ClientFilters = {}) {
  return trpc.clients.list.useQuery(filters)
}

export function useClient(id: string) {
  return trpc.clients.get.useQuery({ id }, { enabled: !!id })
}

// src/hooks/useDeadlines.ts
export function useTriageDeadlines(filters: DeadlineFilters = {}) {
  return trpc.deadlines.listForTriage.useQuery({ filters })
}
```

**Step 6 — Migrate components** (one page at a time):

`src/pages/Dashboard.tsx` currently starts with:

```tsx
const { clients, deadlines, announcements } = useStore()
```

Becomes:

```tsx
const { data: triage, isLoading, error } = useTriageDeadlines()
const { data: announcementList = [] } = useAnnouncementsActiveBanners()

if (isLoading) return <DashboardSkeleton />
if (error) return <DashboardError error={error} />
// ... use triage.overdue, triage.thisWeek, etc.
```

Do this for every page in order: Dashboard → Clients → ClientDetail → AnnouncementList → AnnouncementDetail → Import.

**Step 7 — Delete direct `useStore()` imports from components.** Components should only touch the store through hooks. The store lives on only as the mock adapter's data source.

### 3.3 · Acceptance criteria for §3

- [ ] `src/hooks/` folder exists with one hook per major query/mutation
- [ ] No page in `src/pages/` imports `useStore` directly
- [ ] Every query hook returns `{ data, isLoading, error }` shape
- [ ] Every page shows a skeleton or placeholder during `isLoading`
- [ ] Every page shows an error state (even a simple text "Something went wrong. Retry.") on `error`
- [ ] Running `npm run dev` shows the app working identically to before the refactor

---

## 4 · Shared types — the contract

All types live in `src/types.ts` (already exists; expand). These must match the backend's Drizzle schema shapes.

### 4.1 · Types to expand

```ts
// Existing in src/types.ts — keep, expand:
//   EntityType, StateCode, ClientStatus, DeadlineStatus, Client, Deadline, Announcement

// Add:

export type FirmTier = 'solo' | 'pro' | 'team'
export type UserRole = 'owner' | 'member'

export interface User {
  id: string
  email: string
  displayName: string | null
  role: UserRole
  timezone: string
  lastActiveAt: string | null
}

export interface Firm {
  id: string
  name: string
  primaryStates: StateCode[]
  logoStorageKey: string | null
  branding: {
    primaryColor?: string
    emailSignature?: string
  } | null
  tier: FirmTier
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended'
  trialEndsAt: string | null
  seatLimit: number
  clientLimit: number | null  // null = unlimited
}

export interface Contact {
  id: string
  clientId: string
  name: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  emailVerified: boolean
  emailBouncesConsecutive: number
}

export interface ServicePackage {
  id: string
  firmId: string | null   // null = system package
  name: string
  description: string | null
  applicableEntityTypes: EntityType[]
  applicableStates: StateCode[]
  isSystem: boolean
}

export interface ReminderTemplate {
  id: string
  firmId: string
  packageId: string | null
  templateKey: 'initial' | 't_minus_30' | 't_minus_14' | 't_minus_7' | 't_minus_1'
  subject: string
  bodyMdx: string
  sendTimeOfDay: string  // '09:00'
  active: boolean
}

export interface ImportRun {
  id: string
  firmId: string
  sourceFormat: 'taxdome' | 'drake' | 'proconnect' | 'quickbooks' | 'file_in_time' | 'excel' | null
  originalFilename: string | null
  clientsCreated: number
  deadlinesCreated: number
  rowsFailed: number
  status: 'in_progress' | 'committed' | 'undone' | 'failed'
  committedAt: string | null
  undoneAt: string | null
  createdAt: string
}

export type NotificationKind =
  | 'state_announcement'
  | 'email_bounce'
  | 'team_invite'
  | 'extension_approved'
  | 'reminder_digest'
  | 'import_complete'

export interface Notification {
  id: string
  kind: NotificationKind
  payload: Record<string, unknown>
  readAt: string | null
  dismissedAt: string | null
  createdAt: string
}

export interface FirmAnnouncement {
  announcementId: string
  firmId: string
  firstNotifiedAt: string
  acknowledgedAt: string | null
  snoozedUntil: string | null
  snoozeReason: string | null
  dismissedAt: string | null
  dismissedReason: string | null
  escalationLevel: 'normal' | 'dark' | 'blocking'
  batchAdjustedAt: string | null
}

// Extension state machine per B9
export type DeadlineExtensionSubStatus = 'submitted' | 'approved'

export interface DeadlineExtensionMeta {
  subStatus: DeadlineExtensionSubStatus | null
  submittedAt: string | null
  approvedAt: string | null
  extendedFromDeadlineId: string | null
}
```

### 4.2 · Zod schemas (same file or sibling)

For any type that will be validated in mutation inputs, define a Zod schema. This becomes the source of truth once backend ships (tRPC will use the same schemas on both sides).

Create `src/types/schemas.ts`:

```ts
import { z } from 'zod'

export const clientCreateSchema = z.object({
  name: z.string().min(1).max(120),
  entityType: z.enum(['LLC', 'S-Corp', 'C-Corp', 'Individual', 'Partnership', 'Trust']),
  primaryState: z.string().length(2),
  nexusStates: z.array(z.string().length(2)).default([]),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  county: z.string().optional(),
})

export type ClientCreate = z.infer<typeof clientCreateSchema>

// Mirror every mutation input like this. Backend will import these.
```

### 4.3 · Acceptance criteria for §4

- [ ] Every type used in a hook signature is defined in `src/types.ts`
- [ ] Every mutation input has a Zod schema in `src/types/schemas.ts`
- [ ] All dates serialized as ISO 8601 strings (never `Date` objects crossing component boundaries)
- [ ] All IDs are strings (never numbers)
- [ ] Optional fields use `| null` consistently (not `| undefined`)

---

## 5 · Auth surfaces

The app currently has no signup / login. Backend Phase 0 will need them day one. Build the shells now.

### 5.1 · Routes to add

Add to `src/App.tsx`:

```tsx
<Route path="/signup" element={<Signup />} />
<Route path="/login" element={<Login />} />
<Route path="/accept-invite" element={<AcceptInvite />} />
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

These routes are **outside the `AppShell`** — they have their own layout (centered card, no sidebar).

### 5.2 · Session context

Create `src/lib/session.ts`:

```ts
import { createContext, useContext } from 'react'
import type { User, Firm, FirmTier } from '../types'

export interface Session {
  user: User
  firm: Firm
  tier: FirmTier
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession called outside SessionProvider — ensure route is protected')
  return s
}

export function useMaybeSession(): Session | null {
  return useContext(SessionContext)
}
```

Wrap `<AppShell>` in a `<SessionProvider>` that:
1. On mount, calls `trpc.auth.session.useQuery()`
2. If session exists → renders children with context
3. If no session → `<Navigate to="/login" replace />`
4. While loading → full-page skeleton

### 5.3 · Page shells (behavior-complete, visual rough)

**Login** (`src/pages/Login.tsx`):
- Email + password fields (controlled)
- `trpc.auth.login.useMutation()`
- On success: invalidate `auth.session` → redirect to `/`
- On error: show inline error below password
- "Forgot password?" link + "Create account" link

**Signup** (`src/pages/Signup.tsx`):
- Email + password + firm name fields
- `trpc.auth.signup.useMutation()`
- On success: redirect to `/onboarding/firm`
- No credit card per PRD §3.17

**Onboarding flow** (`src/pages/onboarding/*`):
- `/onboarding/firm` — firm setup (primary states, firm size, role)
- `/onboarding/clients` — three choices (import / add 5 / demo data)
- `/onboarding/packages` — bundle suggestions per client
- Final step → `/` with celebration toast

**AcceptInvite** (`src/pages/AcceptInvite.tsx`):
- Reads `?token=...` from URL
- Shows firm name + inviter name + role offered
- Password + name fields → `trpc.auth.acceptInvite.useMutation()`

**ForgotPassword / ResetPassword** — standard flows.

### 5.4 · Acceptance criteria for §5

- [ ] Routes render; Login/Signup forms submit against the mock adapter
- [ ] Successful mock login sets a mock session and redirects to `/`
- [ ] Visiting `/` without a session redirects to `/login`
- [ ] Invite-accept flow token parsing works (even if the token is mocked to `demo`)
- [ ] All auth pages use the existing component patterns (no new design system)
- [ ] Form validation via Zod schemas (reuse `clientCreateSchema` pattern)

---

## 6 · Loading / error / empty states

Every data-fetching page must handle these four states. Right now most pages only handle the success state.

### 6.1 · Patterns to adopt

**Loading:**

```tsx
if (isLoading) return <DashboardSkeleton />
```

Create skeleton components in `src/components/skeletons/`:
- `DashboardSkeleton`
- `ClientsTableSkeleton`
- `ClientDetailSkeleton`
- `AnnouncementDetailSkeleton`

Keep these simple — gray `bg-slate-100 animate-pulse` rectangles matching the real layout's shape. Visual polish later.

**Error:**

```tsx
if (error) return <ErrorState error={error} onRetry={refetch} />
```

Create a shared `<ErrorState>` component: icon + message + "Retry" button.

**Empty:**

Per addendum §5.9 — already spec'd for Dashboard, Clients, Announcements, Import. Verify every page renders the right empty-state copy when its condition is met.

**Offline:** 
Low priority for MVP but nice: use `navigator.onLine` + `window.addEventListener('online'|'offline')` to show a one-line banner when offline. Queries pause automatically via React Query.

### 6.2 · Acceptance criteria for §6

- [ ] Every page handles loading + error + empty + success
- [ ] Toggle network offline in DevTools → app shows offline banner + graceful behavior
- [ ] Each empty state matches the copy in DESIGN-HANDOFF.md §5.9
- [ ] Retry button on error actually refetches (not just dismisses the error)

---

## 7 · Realtime announcement stub

The dashboard banner needs to appear when a new announcement arrives *without* requiring a full page reload. Backend won't have Supabase Realtime wired on day one — build a polling stub now.

### 7.1 · Polling hook

```ts
// src/hooks/useRealtimeAnnouncements.ts
import { useQuery } from '@tanstack/react-query'
import { trpc } from '../lib/api/client'

export function useRealtimeAnnouncements() {
  return trpc.announcements.list.useQuery(
    { activeOnly: true },
    {
      refetchInterval: 30_000,           // poll every 30s
      refetchOnWindowFocus: true,        // refetch when user returns to tab
      staleTime: 15_000,
    }
  )
}
```

This is a stub. When the backend ships realtime (Phase 3+), swap the internals for a Supabase Realtime subscription. The hook signature doesn't change, so components aren't affected.

### 7.2 · Acceptance criteria for §7

- [ ] Dashboard banner updates within 30s when a new announcement appears in the mock store (use a dev trigger: a button that adds a mock announcement and verify the banner shows up)
- [ ] Polling stops when the tab is hidden (React Query default)
- [ ] Background tab opening doesn't trigger 100 simultaneous requests

---

## 8 · File upload scaffold

Two places need it: **CSV import** (Import wizard step 1) and **firm logo** (Settings / onboarding).

### 8.1 · Pattern

```ts
// src/lib/api/upload.ts
export async function requestUploadUrl(opts: {
  kind: 'csv_import' | 'firm_logo'
  filename: string
  contentType: string
}): Promise<{ uploadUrl: string; storageKey: string }> {
  // Backend will sign a Supabase Storage URL; client uploads directly.
  // For now, mock returns a fake URL.
  if (env.USE_MOCK_API) {
    return { uploadUrl: 'data:application/octet-stream;base64,', storageKey: crypto.randomUUID() }
  }
  return await trpc.uploads.requestUrl.mutate(opts)
}

export async function uploadToSignedUrl(url: string, file: File) {
  // In mock mode, just resolve. In real mode, PUT the file.
  if (url.startsWith('data:')) return
  await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
}
```

### 8.2 · Import wizard Step 1 wiring

Current `Import.tsx` step 1 is decorative. Wire it:

1. User drops CSV → `File` object in state
2. Parse CSV client-side (use `papaparse`) → show row count + preview
3. `requestUploadUrl({ kind: 'csv_import', filename, contentType })`
4. Upload to signed URL
5. Call `trpc.imports.detectFormat.mutate({ storageKey })` → LLM returns format guess
6. Continue to Step 2 mapping

In mock mode, skip step 3–4 and fake the format detection.

### 8.3 · Acceptance criteria for §8

- [ ] Drag-drop in Import step 1 accepts a CSV, parses header row, shows count
- [ ] Mock mode "uploads" succeed with zero network
- [ ] Firm logo upload works the same way (deferred to Settings page if not yet built)

---

## 9 · Tier-based feature flags

Different tiers unlock different features. Build this gate now so Settings / Team / API pages know what to show.

### 9.1 · Hook

```ts
// src/hooks/useFeatureFlags.ts
import { useSession } from '../lib/session'

export function useFeatureFlags() {
  const { firm } = useSession()

  return {
    canInviteTeammates: firm.tier === 'pro' || firm.tier === 'team',
    maxTeammates: firm.tier === 'solo' ? 1 : firm.tier === 'pro' ? 3 : 10,
    canAccessAPI: firm.tier === 'team',
    canCustomDomain: firm.tier === 'team',
    canCustomBranding: firm.tier === 'pro' || firm.tier === 'team',
    hasClientLimit: firm.clientLimit !== null,
    clientLimit: firm.clientLimit,
    canAssignDeadlines: firm.tier !== 'solo',
  }
}
```

### 9.2 · Usage pattern

Components check the flag, never the tier directly:

```tsx
const { canInviteTeammates } = useFeatureFlags()
if (!canInviteTeammates) {
  return <UpgradePrompt feature="team invites" requiredTier="pro" />
}
```

### 9.3 · Acceptance criteria for §9

- [ ] Settings → Team page hidden/gated for Solo tier
- [ ] Client creation blocked when Solo tier is at 50-client limit (show upgrade prompt)
- [ ] `<UpgradePrompt>` component exists — simple for now, linking to Settings → Billing

---

## 10 · Environment config

Create `.env.example` at repo root:

```
# Frontend (Vite)
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_PUBLIC_ASSETS_URL=https://assets.duedatehq.com
VITE_USE_MOCK_API=true                    # flip to false when backend is live
VITE_SENTRY_DSN=
VITE_ENABLE_DEV_TOOLS=true
```

Create `src/config.ts`:

```ts
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  useMockApi: import.meta.env.VITE_USE_MOCK_API === 'true',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  enableDevTools: import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true',
}
```

Use `env.useMockApi` as the switch inside `src/lib/api/client.ts` to route to the mock adapter vs the real tRPC HTTP link.

### 10.1 · Acceptance criteria for §10

- [ ] `.env.example` exists and is git-committed
- [ ] `.env` is git-ignored (check `.gitignore`)
- [ ] Flipping `VITE_USE_MOCK_API=false` + pointing at a stub HTTP endpoint doesn't crash — the adapter swap is clean

---

## 11 · Integration-day checklist (what happens when backend Phase 0 ships)

When the backend session reports Phase 0 complete, here's the sequence:

1. Backend publishes: Supabase project URL + anon key, Fly.io API URL, `AppRouter` types via a shared package
2. Copy the real `AppRouter` type over `src/lib/api/router.ts`
3. Replace the mock link in `src/lib/api/client.ts` with `httpBatchLink({ url: env.apiUrl + '/trpc' })`
4. Flip `VITE_USE_MOCK_API=false`
5. Wire Supabase JS client for auth; update `SessionProvider` to read from Supabase session instead of mock
6. Run `npm run dev` + manually smoke-test each page
7. Fix type errors from backend type drift (should be < 20)
8. Deploy frontend to Vercel preview

Target: **one working session to fully cut over** from mock to real API once Phase 0 lands. That's the payoff of this prep.

---

## 12 · What this prep does NOT do

- ❌ Visual styling — still deferred per DESIGN-HANDOFF-ADDENDUM §⚠️
- ❌ New features beyond what's in the design handoff + addendum
- ❌ Building the actual real API client (backend session handles)
- ❌ PWA service worker — Phase 2 of frontend, not here
- ❌ Dark mode — deferred
- ❌ i18n — Phase 3+
- ❌ Offline-first caching beyond React Query's default — out of scope

---

## 13 · Stopping points

If you hit any of these, stop and ask:

- The backend docs contradict something obvious — wait for human
- A type you need doesn't exist in PRD §5 or BACKEND-IMPLEMENTATION.md §3 — flag and propose
- A procedure shape is unclear (e.g., "what does `previewPackageChange` return?") — flag and propose, don't invent
- You find missing acceptance criteria in this doc — flag; don't guess

---

## 14 · Summary — the "ready for backend" bar

You're done when:

- [ ] All pages read through `src/hooks/use*.ts` — no `useStore()` in components
- [ ] `src/lib/api/router.ts` defines the full `AppRouter` shape
- [ ] `src/lib/api/mock-adapter.ts` implements every procedure against the mock store
- [ ] Every query hook returns `{ data, isLoading, error }` and every page handles all three
- [ ] Auth surfaces exist: signup, login, invite, reset
- [ ] Realtime announcements poll every 30s
- [ ] File uploads use the signed-URL pattern (mocked now)
- [ ] `useFeatureFlags()` gates tier-dependent UI
- [ ] `.env.example` is checked in
- [ ] Flipping `VITE_USE_MOCK_API=false` doesn't crash — adapter swap is clean

When all boxes check, the backend session can swap in real endpoints with minimal friction.

---

*v1 · 2026-04-24 · Frontend integration prep instructions. Self-contained. Execute sequentially after finishing DESIGN-HANDOFF-ADDENDUM §D.1 behavior tasks.*
