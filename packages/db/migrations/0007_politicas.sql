-- Políticas versionadas e conformidade (Fase C). Índices únicos antes das FKs compostas.
CREATE TYPE "public"."compliance_state" AS ENUM('compliant', 'noncompliant', 'unknown', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."policy_template" AS ENUM('sales', 'merchandising');--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template" "policy_template" NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policies_version_positive" CHECK ("policies"."current_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"settings" jsonb NOT NULL,
	"note" text NOT NULL,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_versions_note_len" CHECK (char_length("policy_versions"."note") between 3 and 300)
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "policy_id" uuid;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "policy_version" integer;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "policy_assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "applied_policy_version" integer;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "policy_reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "policy_report" jsonb;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "compliance" "compliance_state" DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "compliance_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "compliance_evaluated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollment_tokens" ADD COLUMN "policy_id" uuid;--> statement-breakpoint
ALTER TABLE "sim_devices" ADD COLUMN "screen_lock_set" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sim_devices" ADD COLUMN "app_install_issue" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "policies_tenant_id_key" ON "policies" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "policies_tenant_template_key" ON "policies" USING btree ("tenant_id","template");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_versions_policy_version_key" ON "policy_versions" USING btree ("tenant_id","policy_id","version");--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_same_tenant_fk" FOREIGN KEY ("tenant_id","policy_id") REFERENCES "public"."policies"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_policy_same_tenant_fk" FOREIGN KEY ("tenant_id","policy_id") REFERENCES "public"."policies"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_policy_same_tenant_fk" FOREIGN KEY ("tenant_id","policy_id") REFERENCES "public"."policies"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_tenant_policy_idx" ON "devices" USING btree ("tenant_id","policy_id");--> statement-breakpoint
CREATE INDEX "devices_tenant_compliance_idx" ON "devices" USING btree ("tenant_id","compliance");--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_policy_version_pair" CHECK (("devices"."policy_id" is null) = ("devices"."policy_version" is null));