ALTER TABLE "enrollment_tokens" ADD COLUMN "scan_requested_at" timestamp with time zone;--> statement-breakpoint
GRANT UPDATE (scan_requested_at) ON enrollment_tokens TO dw_app;
