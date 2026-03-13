import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import type * as schema from "@/db/schema";
import { userRoles, users } from "@/db/schema";

export async function seed(db: BunSQLDatabase<typeof schema>) {
	const ownerEmail = "owner@fleet.dev";
	const ownerPassword = "password";

	const existingOwner = await db.query.users.findFirst({
		where: (users, { eq }) => eq(users.email, ownerEmail),
	});

	if (!existingOwner) {
		const passwordHash = await Bun.password.hash(ownerPassword);
		await db.transaction(async (tx) => {
			const insertedUsers = await tx
				.insert(users)
				.values({
					name: "Owner",
					email: ownerEmail,
					passwordHash,
				})
				.returning();

			const insertedUser = insertedUsers[0];

			if (!insertedUser) {
				throw Error("Expected owner user to be created");
			}

			// Create user roles
			await tx.insert(userRoles).values({
				userId: insertedUser.id,
				role: "owner",
			});
		});
		console.log("✓ Owner user seeded successfully");
	} else {
		console.log("✓ Owner user already exists");
	}
}
