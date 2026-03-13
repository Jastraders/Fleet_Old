import { type InferSelectModel, relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	char,
	decimal,
	index,
	pgSchema,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const appPgSchema = pgSchema("app");

export const userRolePgSchema = appPgSchema.enum("user_role", [
	"owner", // owns the org
	"analyst", // analytics
	"accountant", // journal + vehicles + categories
	"admin", // members + settings
]);

export const transactionTypeEnum = appPgSchema.enum("transaction_type", [
	"credit",
	"debit",
]);

export const users = appPgSchema.table("users", {
	// Identity
	id: uuid("id").primaryKey().defaultRandom(),

	// Profile
	name: text("name").notNull(), // User display name
	email: text("email").notNull().unique(), // User email address
	image: text("image"), // Profile image URL

	// Authentication
	passwordHash: text("password_hash").notNull(), // Bcrypt hashed password

	// Tracking
	// https://github.com/drizzle-team/drizzle-orm/issues/4308#issuecomment-2746211498
	createdBy: uuid("created_by").references((): AnyPgColumn => users.id, {
		onDelete: "set null",
	}), // User who created this member

	// Timestamps
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export type User = Omit<InferSelectModel<typeof users>, "passwordHash">;

export const userRoles = appPgSchema.table("user_roles", {
	// Identity
	id: uuid("id").primaryKey().defaultRandom(),

	// Relations
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }), // Associated user

	// Access
	role: userRolePgSchema().notNull(), // User role/permission level

	// Timestamps
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export type UserRole = InferSelectModel<typeof userRoles>;

export const sessions = appPgSchema.table(
	"sessions",
	{
		// Identity
		id: text("id").primaryKey(),
		secretHash: text("secret_hash").notNull().unique(), // Session secret token hash

		// Relations
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }), // Associated user

		// Timestamps
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("sessions_userId_idx").on(table.userId)],
);

export const expenseCategory = appPgSchema.table("expense_category", {
	// Identity
	id: uuid("id").primaryKey().defaultRandom(),

	// Descriptive fields
	name: text("name").notNull(), // Category name
	color: char("color", { length: 6 }).notNull().unique(), // Hex color code

	// Tracking
	createdBy: uuid("created_by").references(() => users.id, {
		onDelete: "set null",
	}), // User who created this category

	// Timestamps
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export type ExpenseCategory = InferSelectModel<typeof expenseCategory>;

export const vehicles = appPgSchema.table("vehicles", {
	// Identity
	id: uuid("id").primaryKey().defaultRandom(),
	licensePlate: text("license_plate").notNull().unique(), // Vehicle registration plate
	name: text("name").notNull(), // Display name/identifier

	// Descriptive fields
	color: char("color", { length: 6 }).notNull().unique(), // Hex color code

	// Tracking
	createdBy: uuid("created_by").references(() => users.id, {
		onDelete: "set null",
	}),

	// Timestamps
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export type Vehicle = InferSelectModel<typeof vehicles>;

export const journalEntries = appPgSchema.table("journal_entries", {
	// Identity
	id: uuid("id").primaryKey().defaultRandom(),

	// Relations
	vehicleId: uuid("vehicle_id")
		.notNull()
		.references(() => vehicles.id, { onDelete: "cascade" }),

	// Tracking
	createdBy: uuid("created_by").references(() => users.id, {
		onDelete: "set null",
	}),

	// Data
	notes: text("notes"),

	// Timestamps
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type JournalEntry = InferSelectModel<typeof journalEntries>;

export const journalEntryItems = appPgSchema.table("journal_entry_items", {
	// Identity
	id: uuid("id").primaryKey().defaultRandom(),

	// Relations
	journalEntryId: uuid("journal_entry_id")
		.notNull()
		.references(() => journalEntries.id, { onDelete: "cascade" }),

	vehicleId: uuid("vehicle_id")
		.notNull()
		.references(() => vehicles.id, { onDelete: "cascade" }),

	expenseCategoryId: uuid("expense_category_id").references(
		() => expenseCategory.id,
		{ onDelete: "set null" },
	),

	// Data
	transactionDate: timestamp("transaction_date").notNull(),
	type: transactionTypeEnum().notNull(),
	amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
});

export type JournalEntryItem = InferSelectModel<typeof journalEntryItems>;

export const usersRelations = relations(users, ({ many, one }) => ({
	sessions: many(sessions),
	roles: many(userRoles),
	createdByUser: one(users, {
		fields: [users.createdBy],
		references: [users.id],
	}),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	users: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id],
	}),
}));

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
	createdByUser: one(users, {
		fields: [vehicles.createdBy],
		references: [users.id],
	}),
}));

export const expenseCategoryRelations = relations(
	expenseCategory,
	({ one }) => ({
		createdByUser: one(users, {
			fields: [expenseCategory.createdBy],
			references: [users.id],
		}),
	}),
);

export const journalEntriesRelations = relations(
	journalEntries,
	({ one, many }) => ({
		vehicle: one(vehicles, {
			fields: [journalEntries.vehicleId],
			references: [vehicles.id],
		}),
		createdByUser: one(users, {
			fields: [journalEntries.createdBy],
			references: [users.id],
		}),
		items: many(journalEntryItems),
	}),
);

export const journalEntryItemsRelations = relations(
	journalEntryItems,
	({ one }) => ({
		journalEntry: one(journalEntries, {
			fields: [journalEntryItems.journalEntryId],
			references: [journalEntries.id],
		}),
		vehicle: one(vehicles, {
			fields: [journalEntryItems.vehicleId],
			references: [vehicles.id],
		}),
		expenseCategory: one(expenseCategory, {
			fields: [journalEntryItems.expenseCategoryId],
			references: [expenseCategory.id],
		}),
	}),
);
