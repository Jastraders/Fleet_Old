import { type InferSelectModel, relations } from "drizzle-orm";
import { decimal, timestamp, uuid } from "drizzle-orm/pg-core";
import {
	appPgSchema,
	expenseCategory,
	journalEntries,
	vehicles,
} from "@/db/schema";

export const journalEntryCreditItems = appPgSchema.table(
	"journal_entry_credit_items",
	{
		// Relations
		journalEntryId: uuid("journal_entry_id").notNull(),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => vehicles.id, { onDelete: "cascade" }),

		// Data
		transactionDate: timestamp("transaction_date").notNull(),
		amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
	},
);

export type JournalEntryCreditItem = InferSelectModel<
	typeof journalEntryCreditItems
>;

export const journalEntryDebitItems = appPgSchema.table(
	"journal_entry_debit_items",
	{
		// Relations
		journalEntryId: uuid("journal_entry_id").notNull(),
		vehicleId: uuid("vehicle_id")
			.notNull()
			.references(() => vehicles.id, { onDelete: "cascade" }),

		expenseCategoryId: uuid("expense_category_id").references(
			() => expenseCategory.id,
			{ onDelete: "set null" },
		),

		// Data
		transactionDate: timestamp("transaction_date").notNull(),
		amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
	},
);

export type JournalEntryDebitItem = InferSelectModel<
	typeof journalEntryDebitItems
>;

export const journalEntryCreditItemsRelations = relations(
	journalEntryCreditItems,
	({ one }) => ({
		journalEntry: one(journalEntries, {
			fields: [journalEntryCreditItems.journalEntryId],
			references: [journalEntries.id],
		}),
		vehicle: one(vehicles, {
			fields: [journalEntryCreditItems.vehicleId],
			references: [vehicles.id],
		}),
	}),
);

export const journalEntryDebitItemsRelations = relations(
	journalEntryDebitItems,
	({ one }) => ({
		journalEntry: one(journalEntries, {
			fields: [journalEntryDebitItems.journalEntryId],
			references: [journalEntries.id],
		}),
		vehicle: one(vehicles, {
			fields: [journalEntryDebitItems.vehicleId],
			references: [vehicles.id],
		}),
		expenseCategory: one(expenseCategory, {
			fields: [journalEntryDebitItems.expenseCategoryId],
			references: [expenseCategory.id],
		}),
	}),
);
