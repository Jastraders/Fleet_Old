import { ORPCError } from "@orpc/server";
import { asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import * as v from "valibot";
import { expenseCategory } from "@/db/schema";
import { accountantAuthorized } from "@/procedures/accountant-authorized";

// Shared category fields schema
const categoryFieldsSchema = v.object({
	name: v.pipe(v.string(), v.maxLength(255)),
});

// Generate a random hex color
const generateRandomColor = (): string => {
	return Math.floor(Math.random() * 16777215)
		.toString(16)
		.padStart(6, "0");
};

// Create requires specific fields
const createCategoryInput = v.object({
	...categoryFieldsSchema.entries,
});

// Update makes all fields optional
const updateCategoryInput = v.object({
	id: v.string(),
	...categoryFieldsSchema.entries,
});

const get = accountantAuthorized
	.input(v.object({ id: v.string() }))
	.handler(async ({ input, context: { db } }) => {
		const category = await db.query.expenseCategory.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, input.id),
			with: {
				createdByUser: true,
			},
		});

		if (!category) {
			throw new ORPCError("NOT_FOUND", {
				message: "Category not found",
			});
		}

		return category;
	});

const list = accountantAuthorized
	.input(
		v.object({
			offset: v.number(),
			limit: v.pipe(v.number(), v.maxValue(100)),
			search: v.optional(v.string()),
			sortBy: v.picklist(["categoryName", "createdAt", "createdBy"]),
			sortOrder: v.picklist(["asc", "desc"]),
		}),
	)
	.handler(async ({ input, context: { db } }) => {
		const direction = input.sortOrder === "asc" ? asc : desc;

		const sortExpressions = {
			categoryName: expenseCategory.name,
			createdAt: expenseCategory.createdAt,
			createdBy: sql`(SELECT c."name" FROM "app"."users" AS c WHERE c."id" = ${expenseCategory.createdBy})`,
		};

		const searchPattern = input.search ? `%${input.search}%` : null;

		const searchCondition = searchPattern
			? or(
					ilike(expenseCategory.name, searchPattern),
					sql`EXISTS (
						SELECT 1 FROM "app"."users" AS c
						WHERE c."id" = ${expenseCategory.createdBy}
						AND c."name" ILIKE ${searchPattern}
					)`,
				)
			: undefined;

		const [categoryList, countResult] = await Promise.all([
			db.query.expenseCategory.findMany({
				where: searchCondition,
				orderBy: direction(sortExpressions[input.sortBy]),
				limit: input.limit,
				offset: input.offset,
				with: {
					createdByUser: true,
				},
			}),
			db
				.select({ count: count() })
				.from(expenseCategory)
				.where(searchCondition),
		]);

		const total = countResult[0]?.count ?? 0;

		return {
			data: categoryList,
			meta: {
				total,
				offset: input.offset,
				limit: input.limit,
				hasMore: input.offset + input.limit < total,
			},
		};
	});

const create = accountantAuthorized
	.input(createCategoryInput)
	.handler(async ({ input, context: { db, user } }) => {
		// Generate unique color with retry logic
		let color: string | null = null;
		for (let attempt = 0; attempt < 10; attempt++) {
			const candidateColor = generateRandomColor();
			const existing = await db.query.expenseCategory.findFirst({
				where: (table, { eq: eqOp }) => eqOp(table.color, candidateColor),
			});
			if (!existing) {
				color = candidateColor;
				break;
			}
		}

		if (!color) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to generate unique color after 10 attempts",
			});
		}

		const newCategory = await db
			.insert(expenseCategory)
			.values({
				name: input.name,
				color,
				createdBy: user.id,
			})
			.returning();

		return newCategory[0];
	});

const update = accountantAuthorized
	.input(updateCategoryInput)
	.handler(async ({ input, context: { db } }) => {
		const { id, ...updates } = input;

		const category = await db.query.expenseCategory.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, id),
		});

		if (!category) {
			throw new ORPCError("NOT_FOUND", {
				message: "Category not found",
			});
		}

		// Filter out undefined values (color is auto-generated, not updatable)
		const updateData = Object.fromEntries(
			Object.entries(updates).filter(([, value]) => value !== undefined),
		);

		const updated = await db
			.update(expenseCategory)
			.set(updateData)
			.where(eq(expenseCategory.id, id))
			.returning();

		return updated[0];
	});

const deleteCategory = accountantAuthorized
	.input(v.object({ id: v.string() }))
	.handler(async ({ input, context: { db } }) => {
		const category = await db.query.expenseCategory.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, input.id),
		});

		if (!category) {
			throw new ORPCError("NOT_FOUND", {
				message: "Category not found",
			});
		}

		await db.delete(expenseCategory).where(eq(expenseCategory.id, input.id));

		return category;
	});

export const expenseCategoriesRouter = {
	get,
	list,
	create,
	update,
	delete: deleteCategory,
};
