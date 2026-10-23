-- Comandos remotos (Fase D). Índices únicos antes das FKs compostas.
CREATE TYPE "public"."command_batch_status" AS ENUM('not_required', 'waiting_approval', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."command_state" AS ENUM('requested', 'validated', 'waiting_approval', 'queued', 'sent_to_provider', 'provider_accepted', 'device_acknowledged', 'applied_verified', 'failed', 'expired', 'cancelled', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."command_type" AS ENUM('lock', 'reboot', 'start_lost_mode', 'stop_lost_mode', 'clear_app_data', 'wipe');--> statement-breakpoint
CREATE TABLE "command_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "command_type" NOT NULL,
	"reason" text,
	"device_count" integer NOT NULL,
	"status" "command_batch_status" NOT NULL,
	"requested_by" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"decided_by" text,
	"decided_by_name" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_batches_not_self_approved" CHECK ("command_batches"."decided_by" is null or "command_batches"."status" <> 'approved' or "command_batches"."decided_by" <> "command_batches"."requested_by")
);
--> statement-breakpoint
CREATE TABLE "command_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"state" "command_state" NOT NULL,
	"actor" text NOT NULL,
	"detail" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"batch_id" uuid,
	"type" "command_type" NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text,
	"state" "command_state" NOT NULL,
	"state_detail" text,
	"requested_by" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"idempotency_key" text,
	"correlation_id" text,
	"provider_ref" text,
	"send_attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"wipe_enabled" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "lost_mode_since" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "command_batches_tenant_id_key" ON "command_batches" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "command_batches_status_idx" ON "command_batches" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "command_events_command_idx" ON "command_events" USING btree ("tenant_id","command_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_commands_tenant_id_key" ON "device_commands" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_commands_idempotency_key" ON "device_commands" USING btree ("tenant_id","idempotency_key") WHERE "device_commands"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "device_commands_device_idx" ON "device_commands" USING btree ("tenant_id","device_id","created_at");--> statement-breakpoint
CREATE INDEX "device_commands_state_idx" ON "device_commands" USING btree ("tenant_id","state");--> statement-breakpoint
CREATE INDEX "device_commands_batch_idx" ON "device_commands" USING btree ("tenant_id","batch_id");--> statement-breakpoint
ALTER TABLE "command_batches" ADD CONSTRAINT "command_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_events" ADD CONSTRAINT "command_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_events" ADD CONSTRAINT "command_events_command_same_tenant_fk" FOREIGN KEY ("tenant_id","command_id") REFERENCES "public"."device_commands"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_same_tenant_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_batch_same_tenant_fk" FOREIGN KEY ("tenant_id","batch_id") REFERENCES "public"."command_batches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
