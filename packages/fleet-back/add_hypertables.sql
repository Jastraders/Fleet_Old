CREATE TABLE "app"."journal_entry_credit_items" (
	"vehicle_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"amount" numeric(10, 2) NOT NULL
) WITH (
  timescaledb.hypertable,
  timescaledb.segmentby='vehicle_id',
  timescaledb.orderby='transaction_date DESC'
);
--> statement-breakpoint
CREATE TABLE "app"."journal_entry_debit_items" (
	"vehicle_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"expense_category_id" uuid,
	"transaction_date" timestamp NOT NULL,
	"amount" numeric(10, 2) NOT NULL
) WITH (
  timescaledb.hypertable,
  timescaledb.segmentby='vehicle_id',
  timescaledb.orderby='transaction_date DESC'
);
-- Remove default columnstore policy where after = tsdb.chunk_interval defined at hypertable creation
CALL remove_columnstore_policy('app.journal_entry_credit_items');
--> statement-breakpoint
-- Add columnstore policy to compress chunks older than 30 seconds
CALL add_columnstore_policy('app.journal_entry_credit_items', after => INTERVAL '30 seconds');
--> statement-breakpoint
-- Remove default columnstore policy where after = tsdb.chunk_interval defined at hypertable creation
CALL remove_columnstore_policy('app.journal_entry_debit_items');
--> statement-breakpoint
-- Add columnstore policy to compress chunks older than 30 seconds
CALL add_columnstore_policy('app.journal_entry_debit_items', after => INTERVAL '30 seconds');
--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "app"."journal_entry_credit_items" ADD CONSTRAINT "journal_entry_credit_items_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "app"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."journal_entry_debit_items" ADD CONSTRAINT "journal_entry_debit_items_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "app"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."journal_entry_debit_items" ADD CONSTRAINT "journal_entry_debit_items_expense_category_id_expense_category_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "app"."expense_category"("id") ON DELETE set null ON UPDATE no action;
