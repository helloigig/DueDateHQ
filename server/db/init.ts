import { pglite } from "./client";

const schemaSql = `
create table if not exists firms (
  id uuid primary key,
  name text not null,
  primary_states text[] not null default '{}',
  branding jsonb not null default '{}'::jsonb,
  plan text not null default 'solo',
  trial_ends_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists users (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  email text not null unique,
  password_hash text not null,
  role text not null default 'owner',
  full_name text,
  created_at timestamptz not null,
  last_active_at timestamptz
);

create table if not exists clients (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  entity_type text not null,
  primary_state text not null,
  nexus_states text[] not null default '{}',
  contact_email text,
  contact_phone text,
  status text not null default 'active',
  tier text default 'standard',
  assigned_user_id uuid references users(id),
  industry text,
  county text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz
);

create table if not exists contacts (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  name text,
  email text,
  phone text,
  is_primary boolean not null default false,
  email_verified boolean not null default false,
  email_bounces_consecutive integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists related_clients (
  parent_client_id uuid not null references clients(id) on delete cascade,
  related_client_id uuid not null references clients(id) on delete cascade,
  relationship text not null,
  primary key (parent_client_id, related_client_id)
);

create table if not exists service_packages (
  id uuid primary key,
  firm_id uuid references firms(id) on delete cascade,
  name text not null,
  description text,
  applicable_entity_types text[] not null,
  applicable_states text[],
  is_system boolean not null default false,
  created_at timestamptz not null
);

create table if not exists service_templates (
  id uuid primary key,
  package_id uuid not null references service_packages(id) on delete cascade,
  form_type text not null,
  jurisdiction text not null,
  due_date_rule jsonb not null default '{}'::jsonb,
  rollover_rule jsonb not null default '{}'::jsonb,
  default_reminder_schedule jsonb not null default '{}'::jsonb,
  dependencies jsonb not null default '{}'::jsonb,
  standard_checklist jsonb not null default '[]'::jsonb
);

create table if not exists client_service_packages (
  client_id uuid not null references clients(id) on delete cascade,
  package_id uuid not null references service_packages(id) on delete cascade,
  assigned_at timestamptz not null,
  primary key (client_id, package_id)
);

create table if not exists deadlines (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  service_template_id uuid references service_templates(id),
  period text not null default '2026',
  form text not null,
  jurisdiction text not null,
  official_due_date date not null,
  adjusted_due_date date not null,
  internal_target_date date,
  client_prep_date date,
  file_by_date date,
  pay_by_date date,
  status text not null default 'not_started',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists tasks (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  deadline_id uuid not null references deadlines(id) on delete cascade,
  assigned_user_id uuid references users(id),
  forwarding_email_local_part text not null unique,
  forwarding_email_revoked_at timestamptz,
  completion_percentage integer not null default 0,
  status text not null default 'not_started',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists checklist_items (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  label text not null,
  item_type text not null,
  description text,
  sort_order integer not null default 0,
  state text not null default 'not_requested',
  state_changed_at timestamptz not null,
  state_changed_by_kind text not null default 'system',
  state_changed_by_user_id uuid references users(id),
  ai_confidence numeric(3,2),
  ai_flag_reason text,
  source_document_url text,
  last_reminder_at timestamptz,
  created_at timestamptz not null,
  constraint ai_cannot_confirm check (
    state != 'received_confirmed' or state_changed_by_kind = 'user'
  )
);

create table if not exists checklist_item_events (
  id bigserial primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  from_state text,
  to_state text not null,
  actor_kind text not null,
  actor_user_id uuid references users(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create table if not exists activity_events (
  id bigserial primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  event_type text not null,
  actor_kind text not null,
  actor_user_id uuid references users(id),
  description text not null,
  payload jsonb not null default '{}'::jsonb,
  related_checklist_item_id uuid references checklist_items(id),
  related_email_draft_id uuid,
  created_at timestamptz not null
);

create table if not exists reminder_templates (
  id uuid primary key,
  firm_id uuid references firms(id) on delete cascade,
  name text not null,
  item_type_filter text not null,
  deadline_class_filter text,
  trigger_offset_days integer not null,
  cadence text not null default 'once',
  subject_template text not null,
  body_template text not null,
  default_tone text not null default 'default',
  automation_phase text not null default 'phase_1',
  is_system boolean not null default false,
  created_at timestamptz not null
);

create table if not exists email_drafts (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  checklist_item_id uuid references checklist_items(id),
  template_id uuid references reminder_templates(id),
  status text not null default 'draft',
  subject text not null,
  body text not null,
  tone text not null default 'default',
  ai_sources jsonb not null default '{}'::jsonb,
  send_method text,
  scheduled_send_at timestamptz,
  recall_window_expires_at timestamptz,
  sent_at timestamptz,
  sent_by_user_id uuid references users(id),
  bounce_reason text,
  created_at timestamptz not null
);

create table if not exists ai_inferences (
  id bigserial primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  mode text not null,
  model text not null,
  input_hash text not null,
  output jsonb not null,
  confidence numeric(3,2),
  cost_cents numeric(8,4) not null,
  latency_ms integer not null,
  was_acted_on boolean,
  cpa_action_at timestamptz,
  related_object_type text,
  related_object_id uuid,
  created_at timestamptz not null
);

create table if not exists integration_connections (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  integration_type text not null,
  integration_tier integer not null,
  auth_blob_encrypted text not null default '',
  auth_blob_kms_key_id text not null default 'dev',
  status text not null default 'not_connected',
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  last_error jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create table if not exists imported_facts (
  id bigserial primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  connection_id uuid references integration_connections(id),
  client_id uuid references clients(id) on delete cascade,
  source_object_id text,
  fact_type text not null,
  period text not null,
  value jsonb not null,
  confidence numeric(3,2),
  import_tier integer not null,
  imported_at timestamptz not null
);

create table if not exists state_announcements (
  id uuid primary key,
  state_code text not null,
  authority text not null,
  title text not null,
  raw_text text not null,
  parsed_impact jsonb not null default '{}'::jsonb,
  source_url text not null,
  announcement_date date not null,
  detected_at timestamptz not null,
  confidence numeric(3,2) not null,
  parse_status text not null default 'auto_published'
);

create table if not exists affected_client_matches (
  id bigserial primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  announcement_id uuid not null references state_announcements(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  match_basis text not null,
  match_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  dismissed_reason text,
  created_at timestamptz not null
);

create table if not exists notifications (
  id bigserial primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  deep_link text not null,
  read_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create table if not exists import_runs (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  source_format text,
  original_filename text,
  clients_created integer not null default 0,
  deadlines_created integer not null default 0,
  rows_failed integer not null default 0,
  status text not null default 'in_progress',
  committed_at timestamptz,
  undone_at timestamptz,
  created_at timestamptz not null
);

create table if not exists dev_inbound_events (
  id uuid primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  checklist_item_id uuid references checklist_items(id),
  filename text,
  subject text,
  body text,
  attachment_url text,
  processed_at timestamptz,
  created_at timestamptz not null
);
`;

export async function initDatabase() {
  await pglite.exec(schemaSql);
}
