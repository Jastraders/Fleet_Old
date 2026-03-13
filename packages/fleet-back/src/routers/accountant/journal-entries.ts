import { ORPCError } from "@orpc/server";
import { count, desc, eq } from "drizzle-orm";
import * as v from "valibot";
import {
	journalEntryCreditItems,
	journalEntryDebitItems,
} from "@/db/analytics-schema";
import { journalEntries, journalEntryItems } from "@/db/schema";
import { accountantAuthorized } from "@/procedures/accountant-authorized";

// Journal entry item fields schema
const journalEntryItemSchema = v.object({
	transactionDate: v.string(),
	type: v.picklist(["credit", "debit"]),
	amount: v.string(),
	expenseCategoryId: v.optional(v.string()),
});

// Create journal entry with items
const createEntryInput = v.object({
	vehicleId: v.string(),
	notes: v.optional(v.string()),
	items: v.pipe(
		v.array(journalEntryItemSchema),
		v.minLength(1, "At least one item is required"),
	),
});

// Update journal entry input
const updateEntryInput = v.object({
	id: v.string(),
	notes: v.optional(v.string()),
	items: v.optional(
		v.pipe(
			v.array(journalEntryItemSchema),
			v.minLength(1, "At least one item is required"),
		),
	),
});

// Delete journal entry input
const deleteEntryInput = v.object({
	id: v.string(),
});

const get = accountantAuthorized
	.input(v.object({ id: v.string() }))
	.handler(async ({ input, context: { db } }) => {
		const entry = await db.query.journalEntries.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, input.id),
			with: {
				items: true,
				createdByUser: true,
				vehicle: true,
			},
		});

		if (!entry) {
			throw new ORPCError("NOT_FOUND", {
				message: "Journal entry not found",
			});
		}

		return entry;
	});

const list = accountantAuthorized
	.input(
		v.object({
			offset: v.number(),
			limit: v.pipe(v.number(), v.maxValue(20)),
		}),
	)
	.handler(async ({ input, context: { db } }) => {
		const [entryList, countResult] = await Promise.all([
			db.query.journalEntries.findMany({
				orderBy: (table) => desc(table.createdAt),
				limit: input.limit,
				offset: input.offset,
				with: {
					items: {
						orderBy: (table) => desc(table.transactionDate),
					},
					createdByUser: true,
					vehicle: true,
				},
			}),
			db.select({ count: count() }).from(journalEntries),
		]);

		const total = countResult[0]?.count ?? 0;

		return {
			data: entryList,
			meta: {
				total,
				offset: input.offset,
				limit: input.limit,
				hasMore: input.offset + input.limit < total,
			},
		};
	});

const create = accountantAuthorized
	.input(createEntryInput)
	.handler(async ({ input, context: { db, user } }) => {
		// Create journal entry and items in a transaction
		const newEntry = await db.transaction(async (tx) => {
			// Insert journal entry
			const insertedEntries = await tx
				.insert(journalEntries)
				.values({
					vehicleId: input.vehicleId,
					notes: input.notes ?? null,
					createdBy: user.id,
				})
				.returning();

			const entryId = insertedEntries[0]?.id;

			if (!entryId) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create journal entry",
				});
			}

			// Insert journal entry items
			const itemsToInsert = input.items.map((item) => ({
				journalEntryId: entryId,
				vehicleId: input.vehicleId,
				transactionDate: new Date(item.transactionDate),
				type: item.type as "credit" | "debit",
				amount: item.amount,
				expenseCategoryId: item.expenseCategoryId ?? null,
			}));

			await tx.insert(journalEntryItems).values(itemsToInsert);

			// Separate items into credit and debit and insert into respective tables
			const creditItems = input.items
				.filter((item) => item.type === "credit")
				.map((item) => ({
					journalEntryId: entryId,
					vehicleId: input.vehicleId,
					transactionDate: new Date(item.transactionDate),
					amount: item.amount,
				}));

			const debitItems = input.items
				.filter((item) => item.type === "debit")
				.map((item) => ({
					journalEntryId: entryId,
					vehicleId: input.vehicleId,
					expenseCategoryId: item.expenseCategoryId ?? null,
					transactionDate: new Date(item.transactionDate),
					amount: item.amount,
				}));

			if (creditItems.length > 0) {
				await tx.insert(journalEntryCreditItems).values(creditItems);
			}

			if (debitItems.length > 0) {
				await tx.insert(journalEntryDebitItems).values(debitItems);
			}

			// Return the created entry with items
			return await tx.query.journalEntries.findFirst({
				where: (table) => eq(table.id, entryId),
				with: {
					items: {
						orderBy: (table) => desc(table.transactionDate),
					},
					createdByUser: true,
					vehicle: true,
				},
			});
		});

		if (!newEntry) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create journal entry",
			});
		}

		return newEntry;
	});

const update = accountantAuthorized
	.input(updateEntryInput)
	.handler(async ({ input, context: { db, user } }) => {
		// Verify entry exists and user created it
		const entry = await db.query.journalEntries.findFirst({
			where: (table) => eq(table.id, input.id),
		});

		if (!entry) {
			throw new ORPCError("NOT_FOUND", {
				message: "Journal entry not found",
			});
		}

		if (entry.createdBy !== user.id) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "You cannot update this journal entry",
			});
		}

		// Update entry in a transaction
		const updatedEntry = await db.transaction(async (tx) => {
			// Update journal entry notes if provided
			if (input.notes !== undefined) {
				await tx
					.update(journalEntries)
					.set({ notes: input.notes ?? null })
					.where(eq(journalEntries.id, input.id));
			}

			// If items are provided, delete old items and insert new ones
			if (input.items && input.items.length > 0) {
				// Delete old items from all tables
				await tx
					.delete(journalEntryItems)
					.where(eq(journalEntryItems.journalEntryId, input.id));
				await tx
					.delete(journalEntryCreditItems)
					.where(eq(journalEntryCreditItems.journalEntryId, input.id));

				await tx
					.delete(journalEntryDebitItems)
					.where(eq(journalEntryDebitItems.journalEntryId, input.id));

				// Insert new items
				const itemsToInsert = input.items.map((item) => ({
					journalEntryId: input.id,
					vehicleId: entry.vehicleId,
					transactionDate: new Date(item.transactionDate),
					type: item.type as "credit" | "debit",
					amount: item.amount,
					expenseCategoryId: item.expenseCategoryId ?? null,
				}));

				await tx.insert(journalEntryItems).values(itemsToInsert);

				// Separate items into credit and debit
				const creditItems = input.items
					.filter((item) => item.type === "credit")
					.map((item) => ({
						journalEntryId: input.id,
						vehicleId: entry.vehicleId,
						transactionDate: new Date(item.transactionDate),
						amount: item.amount,
					}));

				const debitItems = input.items
					.filter((item) => item.type === "debit")
					.map((item) => ({
						journalEntryId: input.id,
						vehicleId: entry.vehicleId,
						expenseCategoryId: item.expenseCategoryId ?? null,
						transactionDate: new Date(item.transactionDate),
						amount: item.amount,
					}));

				if (creditItems.length > 0) {
					await tx.insert(journalEntryCreditItems).values(creditItems);
				}

				if (debitItems.length > 0) {
					await tx.insert(journalEntryDebitItems).values(debitItems);
				}
			}

			// Return the updated entry
			return await tx.query.journalEntries.findFirst({
				where: (table) => eq(table.id, input.id),
				with: {
					items: {
						orderBy: (table) => desc(table.transactionDate),
					},
					createdByUser: true,
					vehicle: true,
				},
			});
		});

		if (!updatedEntry) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to update journal entry",
			});
		}

		return updatedEntry;
	});

const deleteEntry = accountantAuthorized
	.input(deleteEntryInput)
	.handler(async ({ input, context: { db, user } }) => {
		// Verify entry exists and user created it
		const entry = await db.query.journalEntries.findFirst({
			where: (table) => eq(table.id, input.id),
		});

		if (!entry) {
			throw new ORPCError("NOT_FOUND", {
				message: "Journal entry not found",
			});
		}

		if (entry.createdBy !== user.id) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "You cannot delete this journal entry",
			});
		}

		// Delete entry and related items in a transaction
		await db.transaction(async (tx) => {
			// Delete from specific credit/debit tables
			await tx
				.delete(journalEntryCreditItems)
				.where(eq(journalEntryCreditItems.journalEntryId, input.id));

			await tx
				.delete(journalEntryDebitItems)
				.where(eq(journalEntryDebitItems.journalEntryId, input.id));

			// Delete journal entry items
			await tx
				.delete(journalEntryItems)
				.where(eq(journalEntryItems.journalEntryId, input.id));

			// Delete the journal entry
			await tx.delete(journalEntries).where(eq(journalEntries.id, input.id));
		});

		return { success: true };
	});

export const journalEntriesRouter = {
	get,
	list,
	create,
	update,
	delete: deleteEntry,
};
