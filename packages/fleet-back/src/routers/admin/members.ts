import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
import * as v from "valibot";
import { userRoles, users } from "@/db/schema";
import { adminAuthorized } from "@/procedures/admin-authorized";

const get = adminAuthorized
	.input(v.object({ id: v.string() }))
	.handler(async ({ input, context: { db } }) => {
		const user = await db.query.users.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, input.id),
			with: {
				createdByUser: true,
				roles: true,
			},
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", {
				message: "User not found",
			});
		}

		if (user.roles.some((r) => r.role === "owner")) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot access user with owner role",
			});
		}

		return user;
	});

const list = adminAuthorized
	.input(
		v.object({
			offset: v.number(),
			limit: v.pipe(v.number(), v.maxValue(20)),
			search: v.optional(v.string()),
			sortBy: v.picklist(["memberName", "createdAt", "createdBy"]),
			sortOrder: v.picklist(["asc", "desc"]),
		}),
	)
	.handler(async ({ input, context: { db } }) => {
		const direction = input.sortOrder === "asc" ? asc : desc;

		const sortExpressions = {
			memberName: users.name,
			createdAt: users.createdAt,
			createdBy: sql`(SELECT c."name" FROM "app"."users" AS c WHERE c."id" = ${users.createdBy})`,
		};

		const ownerUserIds = db
			.selectDistinct({ userId: userRoles.userId })
			.from(userRoles)
			.where(eq(userRoles.role, "owner"));

		const searchPattern = input.search ? `%${input.search}%` : null;

		const searchCondition = searchPattern
			? or(
					ilike(users.name, searchPattern),
					ilike(users.email, searchPattern),
					sql`EXISTS (
						SELECT 1 FROM "app"."user_roles" AS ur
						WHERE ur."user_id" = ${users.id}
						AND ur."role"::text ILIKE ${searchPattern}
					)`,
					sql`EXISTS (
						SELECT 1 FROM "app"."users" AS c
						WHERE c."id" = ${users.createdBy}
						AND c."name" ILIKE ${searchPattern}
					)`,
				)
			: undefined;

		const fullCondition = and(
			notInArray(users.id, ownerUserIds),
			searchCondition,
		);

		const [data, countResult] = await Promise.all([
			db.query.users.findMany({
				where: () => fullCondition,
				orderBy: direction(sortExpressions[input.sortBy]),
				limit: input.limit,
				offset: input.offset,
				with: {
					createdByUser: true,
					roles: true,
				},
			}),
			db.select({ count: count() }).from(users).where(fullCondition),
		]);

		const total = countResult[0]?.count ?? 0;

		return {
			data,
			meta: {
				total,
				offset: input.offset,
				limit: input.limit,
				hasMore: input.offset + input.limit < total,
			},
		};
	});

const create = adminAuthorized
	.input(
		v.object({
			name: v.pipe(v.string(), v.maxLength(255)),
			email: v.pipe(v.string(), v.email(), v.maxLength(255)),
			password: v.pipe(v.string(), v.minLength(8), v.maxLength(32)),
			roles: v.pipe(
				v.array(v.picklist(["analyst", "accountant", "admin"])),
				v.minLength(1),
			),
		}),
	)
	.handler(async ({ input, context: { db, user } }) => {
		const { name, email, password, roles } = input;

		// Check if user already exists
		const existingUser = await db.query.users.findFirst({
			where: (users, { eq }) => eq(users.email, email),
		});

		if (existingUser) {
			throw new ORPCError("CONFLICT", {
				message: "User with this email already exists",
			});
		}

		// Hash password
		const passwordHash = await Bun.password.hash(password);

		// Create user and roles in a transaction
		const result = await db.transaction(async (tx) => {
			const newUser = await tx
				.insert(users)
				.values({
					name,
					email,
					passwordHash,
					createdBy: user.id,
				})
				.returning({
					id: users.id,
					name: users.name,
					email: users.email,
					createdAt: users.createdAt,
					updatedAt: users.updatedAt,
					image: users.image,
				});

			const createdUser = newUser[0];

			if (!createdUser) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create user",
				});
			}

			// Create user roles
			await tx.insert(userRoles).values(
				roles.map((role) => ({
					userId: createdUser.id,
					role,
				})),
			);

			return newUser[0];
		});

		return result;
	});

const update = adminAuthorized
	.input(
		v.object({
			id: v.string(),
			roles: v.optional(
				v.pipe(
					v.array(v.picklist(["analyst", "accountant", "admin"])),
					v.minLength(1),
				),
			),
		}),
	)
	.handler(async ({ input, context: { db } }) => {
		const { id, roles } = input;

		const user = await db.query.users.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, id),
			with: {
				roles: true,
			},
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", {
				message: "User not found",
			});
		}

		if (user.roles.some((r) => r.role === "owner")) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot update user with owner role",
			});
		}

		// Update user roles if provided
		if (roles !== undefined) {
			await db.transaction(async (tx) => {
				// Delete existing roles
				await tx.delete(userRoles).where(eq(userRoles.userId, id));

				// Create new roles
				await tx.insert(userRoles).values(
					roles.map((role) => ({
						userId: id,
						role,
					})),
				);
			});
		}

		const updated = await db.query.users.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, id),
			with: {
				roles: true,
			},
		});

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "User not found after update",
			});
		}

		return updated;
	});

const deleteUser = adminAuthorized
	.input(v.object({ id: v.string() }))
	.handler(async ({ input, context: { db } }) => {
		const user = await db.query.users.findFirst({
			where: (table, { eq: eqOp }) => eqOp(table.id, input.id),
			with: {
				roles: true,
			},
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", {
				message: "User not found",
			});
		}

		if (user.roles.some((r) => r.role === "owner")) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot delete user with owner role",
			});
		}

		await db.delete(users).where(eq(users.id, input.id));

		return user;
	});

export const membersRouter = {
	get,
	list,
	create,
	update,
	delete: deleteUser,
};
