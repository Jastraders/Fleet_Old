import { ORPCError } from "@orpc/server";
import { asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import * as v from "valibot";
import { vehicles } from "@/db/schema";
import { accountantAuthorized } from "@/procedures/accountant-authorized";

// Shared vehicle fields schema
const vehicleFieldsSchema = v.object({
	name: v.pipe(v.string(), v.maxLength(255)),
	licensePlate: v.pipe(
		v.string(),
		v.minLength(1, "License Plate is required"),
		v.maxLength(255),
	),
});

// Generate a random hex color
const generateRandomColor = (): string => {
	return Math.floor(Math.random() * 16777215)
		.toString(16)
		.padStart(6, "0");
};

// Create requires specific fields
const createVehicleInput = v.object({
	...vehicleFieldsSchema.entries,
});

// Update makes all fields optional
const updateVehicleInput = v.object({
	id: v.string(),
	...vehicleFieldsSchema.entries,
});

const get = accountantAuthorized
	.input(v.object({ id: v.string() }))
	.handler(async ({ input, context: { db } }) => {
		const vehicle = await db.query.vehicles.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, input.id),
			with: {
				createdByUser: true,
			},
		});

		if (!vehicle) {
			throw new ORPCError("NOT_FOUND", {
				message: "Vehicle not found",
			});
		}

		return vehicle;
	});

const list = accountantAuthorized
	.input(
		v.object({
			offset: v.number(),
			limit: v.pipe(v.number(), v.maxValue(100)),
			search: v.optional(v.string()),
			sortBy: v.picklist(["vehicleName", "createdAt", "createdBy"]),
			sortOrder: v.picklist(["asc", "desc"]),
		}),
	)
	.handler(async ({ input, context: { db } }) => {
		const direction = input.sortOrder === "asc" ? asc : desc;

		const sortExpressions = {
			vehicleName: vehicles.name,
			createdAt: vehicles.createdAt,
			createdBy: sql`(SELECT c."name" FROM "app"."users" AS c WHERE c."id" = ${vehicles.createdBy})`,
		};

		const searchPattern = input.search ? `%${input.search}%` : null;

		const searchCondition = searchPattern
			? or(
					ilike(vehicles.name, searchPattern),
					ilike(vehicles.licensePlate, searchPattern),
					sql`EXISTS (
						SELECT 1 FROM "app"."users" AS c
						WHERE c."id" = ${vehicles.createdBy}
						AND c."name" ILIKE ${searchPattern}
					)`,
				)
			: undefined;

		const [vehicleList, countResult] = await Promise.all([
			db.query.vehicles.findMany({
				where: searchCondition,
				orderBy: direction(sortExpressions[input.sortBy]),
				limit: input.limit,
				offset: input.offset,
				with: {
					createdByUser: true,
				},
			}),
			db.select({ count: count() }).from(vehicles).where(searchCondition),
		]);

		const total = countResult[0]?.count ?? 0;

		return {
			data: vehicleList,
			meta: {
				total,
				offset: input.offset,
				limit: input.limit,
				hasMore: input.offset + input.limit < total,
			},
		};
	});

const create = accountantAuthorized
	.input(createVehicleInput)
	.handler(async ({ input, context: { db, user } }) => {
		// Generate unique color with retry logic
		let color: string | null = null;
		for (let attempt = 0; attempt < 10; attempt++) {
			const candidateColor = generateRandomColor();
			const existing = await db.query.vehicles.findFirst({
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

		const newVehicle = await db
			.insert(vehicles)
			.values({
				name: input.name,
				licensePlate: input.licensePlate,
				color,
				createdBy: user.id,
			})
			.returning();

		return newVehicle[0];
	});

const update = accountantAuthorized
	.input(updateVehicleInput)
	.handler(async ({ input, context: { db } }) => {
		const { id, ...updates } = input;

		const vehicle = await db.query.vehicles.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, id),
		});

		if (!vehicle) {
			throw new ORPCError("NOT_FOUND", {
				message: "Vehicle not found",
			});
		}

		// Filter out undefined values
		const updateData = Object.fromEntries(
			Object.entries(updates).filter(([, value]) => value !== undefined),
		);

		const updated = await db
			.update(vehicles)
			.set(updateData)
			.where(eq(vehicles.id, id))
			.returning();

		return updated[0];
	});

const deleteVehicle = accountantAuthorized
	.input(v.object({ id: v.string() }))
	.handler(async ({ input, context: { db } }) => {
		const vehicle = await db.query.vehicles.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, input.id),
		});

		if (!vehicle) {
			throw new ORPCError("NOT_FOUND", {
				message: "Vehicle not found",
			});
		}

		await db.delete(vehicles).where(eq(vehicles.id, input.id));

		return vehicle;
	});

export const vehiclesRouter = {
	get,
	list,
	create,
	update,
	delete: deleteVehicle,
};
