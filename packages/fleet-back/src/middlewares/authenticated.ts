import { ORPCError } from "@orpc/server";
import { getCookie } from "@orpc/server/helpers";
import { eq } from "drizzle-orm";
import { base } from "@/context";
import type { db as DB } from "@/db";
import { sessions, type User, type UserRole } from "@/db/schema";
import { constantTimeEqual, hashSecret } from "@/utils/auth";

const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export const authenticatedMiddleware = base.middleware(
	async ({ context: { reqHeaders, db }, next }) => {
		const token = getCookie(reqHeaders, "session");

		if (!token) {
			throw new ORPCError("UNAUTHORIZED");
		}

		const user = await validateSessionToken(db, token);

		if (!user) {
			throw new ORPCError("UNAUTHORIZED");
		}

		return await next({
			context: {
				// Pass additional context
				user,
			},
		});
	},
);

export type UserWithRoles = User & {
	roles: UserRole[];
};

export async function validateSessionToken(
	db: typeof DB,
	token: string,
): Promise<UserWithRoles | null> {
	const parts = token.split(".");
	if (parts.length !== 2) return null;

	const [sessionId, sessionSecret] = parts;
	if (!sessionId || !sessionSecret) return null;

	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, sessionId),
		with: {
			users: {
				with: {
					roles: true,
				},
			},
		},
	});

	if (!session) return null;

	// Check if session has expired
	const expiresAt = new Date(
		session.createdAt.getTime() + SESSION_EXPIRES_IN_MS,
	);

	if (new Date() > expiresAt) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
		return null;
	}

	// Verify the secret using constant-time comparison
	const tokenSecretHash = await hashSecret(sessionSecret);
	if (!constantTimeEqual(tokenSecretHash, session.secretHash)) {
		return null;
	}

	return session.users;
}
