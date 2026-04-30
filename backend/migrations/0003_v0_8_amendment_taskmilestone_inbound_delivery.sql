CREATE TYPE "public"."delivery_bounce_reason" AS ENUM('hard_bounce', 'soft_bounce', 'mailbox_full', 'spam_blocked', 'address_not_found', 'complaint', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."delivery_event_type" AS ENUM('submitted', 'accepted', 'delivered', 'opened', 'replied', 'bounced', 'complained', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."gmail_message_status" AS ENUM('available', 'gone_404', 'pending_check');--> statement-breakpoint
CREATE TYPE "public"."imported_fact_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."inbound_reply_intent" AS ENUM('document_provided', 'timeline_pushback', 'question_asked', 'off_topic', 'mismatched_attachment', 'acknowledgment');--> statement-breakpoint
CREATE TYPE "public"."inbound_top_level_class" AS ENUM('client_document', 'client_reply_intent', 'agency_correspondence', 'third_party_data', 'payment_confirm', 'vendor_notification', 'spam');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('not_started', 'in_progress', 'blocked', 'done', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."milestone_type" AS ENUM('initial_meeting', 'collect_materials', 'prepare_workpapers', 'internal_review', 'client_review', 'file', 'pay');--> statement-breakpoint
CREATE TYPE "public"."state_announcement_source_status" AS ENUM('healthy', 'stale_short', 'stale_long', 'rescrape_running', 'broken');--> statement-breakpoint
ALTER TYPE "public"."ai_mode" ADD VALUE 'F';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"email_draft_id" uuid NOT NULL,
	"event_type" "delivery_event_type" NOT NULL,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_provider_payload" jsonb,
	"bounce_reason" "delivery_bounce_reason",
	"diagnostic_text" text,
	"suppressed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "imported_facts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"client_id" uuid,
	"fact_type" text NOT NULL,
	"value" jsonb NOT NULL,
	"unit" text,
	"tax_year" integer,
	"source_gmail_message_id" text,
	"source_attachment_index" integer,
	"source_page_range" text,
	"extraction_version" text DEFAULT 'v1' NOT NULL,
	"last_reextracted_at" timestamp with time zone,
	"gmail_message_status" "gmail_message_status" DEFAULT 'available' NOT NULL,
	"confidence" "imported_fact_confidence" DEFAULT 'medium' NOT NULL,
	"import_tier" integer DEFAULT 1 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"task_id" uuid,
	"gmail_message_id" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text,
	"body_text" text,
	"attachment_metadata" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_level_class" "inbound_top_level_class",
	"reply_intent" "inbound_reply_intent",
	"intent_confidence" numeric(3, 2),
	"suggested_action" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"classified_at" timestamp with time zone,
	"cpa_actioned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "state_announcement_sources" (
	"state_code" text NOT NULL,
	"authority" text NOT NULL,
	"source_url" text NOT NULL,
	"last_scraped_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error_message" text,
	"consecutive_error_count" integer DEFAULT 0 NOT NULL,
	"next_scheduled_scrape_at" timestamp with time zone,
	"status" "state_announcement_source_status" DEFAULT 'healthy' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "state_announcement_sources_state_code_authority_pk" PRIMARY KEY("state_code","authority")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_milestone_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"from_status" "milestone_status",
	"to_status" "milestone_status" NOT NULL,
	"actor_kind" "actor_kind" NOT NULL,
	"actor_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"milestone_type" "milestone_type" NOT NULL,
	"custom_label" text,
	"target_date" date,
	"completed_date" date,
	"status" "milestone_status" DEFAULT 'not_started' NOT NULL,
	"blocker_reason" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"proposed_by" "actor_kind" DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "source_references" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "inline_text" text;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "embedding" jsonb;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_email_draft_id_email_drafts_id_fk" FOREIGN KEY ("email_draft_id") REFERENCES "public"."email_drafts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "imported_facts" ADD CONSTRAINT "imported_facts_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "imported_facts" ADD CONSTRAINT "imported_facts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_replies" ADD CONSTRAINT "inbound_replies_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_replies" ADD CONSTRAINT "inbound_replies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_milestone_events" ADD CONSTRAINT "task_milestone_events_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_milestone_events" ADD CONSTRAINT "task_milestone_events_milestone_id_task_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."task_milestones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_milestone_events" ADD CONSTRAINT "task_milestone_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_milestones" ADD CONSTRAINT "task_milestones_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_milestones" ADD CONSTRAINT "task_milestones_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
