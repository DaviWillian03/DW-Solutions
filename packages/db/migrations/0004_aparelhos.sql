CREATE TYPE "public"."data_source" AS ENUM('simulator', 'android_management_api');--> statement-breakpoint
CREATE TYPE "public"."device_manufacturer" AS ENUM('samsung', 'motorola');--> statement-breakpoint
CREATE TYPE "public"."enrollment_state" AS ENUM('pending', 'enrolled', 'unenrolled');--> statement-breakpoint
CREATE TYPE "public"."management_mode" AS ENUM('fully_managed', 'dedicated');--> statement-breakpoint
CREATE TYPE "public"."sim_device_profile" AS ENUM('reliable', 'flaky', 'silent', 'never_seen');--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"source" "data_source" DEFAULT 'simulator' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"manufacturer" "device_manufacturer" NOT NULL,
	"model" text NOT NULL,
	"android_version" smallint NOT NULL,
	"security_patch" date,
	"serial_number" text,
	"management_mode" "management_mode" DEFAULT 'fully_managed' NOT NULL,
	"enrollment_state" "enrollment_state" DEFAULT 'pending' NOT NULL,
	"holder_id" uuid,
	"source" "data_source" DEFAULT 'simulator' NOT NULL,
	"provider_ref" text,
	"enrolled_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"observed_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"desired_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_name_len" CHECK (char_length("devices"."display_name") between 2 and 80),
	CONSTRAINT "devices_android_range" CHECK ("devices"."android_version" between 10 and 20)
);--> statement-breakpoint
CREATE TABLE "enrollment_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"demo" boolean DEFAULT true NOT NULL,
	"management_mode" "management_mode" DEFAULT 'fully_managed' NOT NULL,
	"holder_id" uuid,
	"display_name_hint" text,
	"provider_ref" text,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"device_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "sim_devices" (
	"device_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"profile" "sim_device_profile" NOT NULL,
	"battery_drain_per_hour" smallint DEFAULT 4 NOT NULL,
	"next_check_in_at" timestamp with time zone
);--> statement-breakpoint
CREATE UNIQUE INDEX "devices_tenant_id_key" ON "devices" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_tenant_serial_key" ON "devices" USING btree ("tenant_id","serial_number") WHERE "devices"."serial_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_tokens_hash_key" ON "enrollment_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "device_holders_tenant_id_key" ON "device_holders" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_same_tenant_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_holder_same_tenant_fk" FOREIGN KEY ("tenant_id","holder_id") REFERENCES "public"."device_holders"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_holder_same_tenant_fk" FOREIGN KEY ("tenant_id","holder_id") REFERENCES "public"."device_holders"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_device_same_tenant_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sim_devices" ADD CONSTRAINT "sim_devices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sim_devices" ADD CONSTRAINT "sim_devices_device_same_tenant_fk" FOREIGN KEY ("tenant_id","device_id") REFERENCES "public"."devices"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_events_device_time_idx" ON "device_events" USING btree ("tenant_id","device_id","occurred_at");--> statement-breakpoint
CREATE INDEX "devices_tenant_name_idx" ON "devices" USING btree ("tenant_id","display_name");--> statement-breakpoint
CREATE INDEX "devices_tenant_seen_idx" ON "devices" USING btree ("tenant_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "devices_tenant_holder_idx" ON "devices" USING btree ("tenant_id","holder_id");--> statement-breakpoint
CREATE INDEX "enrollment_tokens_tenant_idx" ON "enrollment_tokens" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "sim_devices_due_idx" ON "sim_devices" USING btree ("next_check_in_at");
