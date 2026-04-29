CREATE TYPE "public"."client_status" AS ENUM('prospect', 'active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."deadline_status" AS ENUM('not_started', 'in_progress', 'completed', 'deferred', 'filed_extension', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."firm_subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."firm_tier" AS ENUM('solo', 'pro', 'team');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_service_packages" (
	"client_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_service_packages_client_id_package_id_pk" PRIMARY KEY("client_id","package_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"primary_state" text NOT NULL,
	"nexus_states" text[] DEFAULT '{}'::text[] NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"tier" text DEFAULT 'standard',
	"assigned_user_id" uuid,
	"industry" text,
	"county" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"service_template_id" uuid,
	"period" text NOT NULL,
	"form_type" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"official_due_date" date NOT NULL,
	"adjusted_due_date" date NOT NULL,
	"internal_target_date" date,
	"client_prep_date" date,
	"file_by_date" date,
	"pay_by_date" date,
	"status" "deadline_status" DEFAULT 'not_started' NOT NULL,
	"assigned_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"primary_states" text[] NOT NULL,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tier" "firm_tier" DEFAULT 'solo' NOT NULL,
	"subscription_status" "firm_subscription_status" DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"seat_limit" integer DEFAULT 1 NOT NULL,
	"client_limit" integer,
	"logo_storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "related_clients" (
	"parent_client_id" uuid NOT NULL,
	"related_client_id" uuid NOT NULL,
	"relationship" text NOT NULL,
	CONSTRAINT "related_clients_parent_client_id_related_client_id_pk" PRIMARY KEY("parent_client_id","related_client_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"applicable_entity_types" text[] NOT NULL,
	"applicable_states" text[],
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"form_type" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"due_date_rule" jsonb NOT NULL,
	"rollover_rule" jsonb NOT NULL,
	"default_reminder_schedule" jsonb NOT NULL,
	"dependencies" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"standard_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_service_packages" ADD CONSTRAINT "client_service_packages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_service_packages" ADD CONSTRAINT "client_service_packages_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_service_template_id_service_templates_id_fk" FOREIGN KEY ("service_template_id") REFERENCES "public"."service_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "related_clients" ADD CONSTRAINT "related_clients_parent_client_id_clients_id_fk" FOREIGN KEY ("parent_client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "related_clients" ADD CONSTRAINT "related_clients_related_client_id_clients_id_fk" FOREIGN KEY ("related_client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_templates" ADD CONSTRAINT "service_templates_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
