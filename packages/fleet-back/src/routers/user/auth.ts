import { ORPCError } from "@orpc/server";
import { getCookie, setCookie } from "@orpc/server/helpers";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { base } from "@/context";
import { sessions } from "@/db/schema";
import { env } from "@/env";
import { authenticatedMiddleware } from "@/middlewares/authenticated";
import { generateSessionToken, hashSecret } from "@/utils/auth";

const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const signInWithEmailAndPassword = base
	.input(
		v.object({
			email: v.pipe(v.string(), v.email(), v.maxLength(255)),
			password: v.pipe(v.string(), v.minLength(8)),
		}),
	)
	.handler(async ({ input, context: { db, resHeaders } }) => {
		const { email, password } = input;

		const user = await db.query.users.findFirst({
			where: (users, { eq }) => eq(users.email, email),
			columns: {
				id: true,
				passwordHash: true,
			},
		});

		if (!user) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "Invalid credentials",
			});
		}

		const isMatch = await Bun.password.verify(password, user.passwordHash);

		if (!isMatch) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "Invalid credentials",
			});
		}

		const { id, secret, token } = generateSessionToken();
		const secretHash = await hashSecret(secret);

		await db
			.insert(sessions)
			.values({
				id,
				secretHash,
				userId: user.id,
			})
			.returning({
				id: sessions.id,
				userId: sessions.userId,
				createdAt: sessions.createdAt,
			});

		setCookie(resHeaders, "session", token, {
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			maxAge: SESSION_EXPIRES_IN_MS / 1000,
			secure: env.NODE_ENV === "production",
		});
	});

const signOut = base.handler(
	async ({ context: { db, reqHeaders, resHeaders } }) => {
		const token = getCookie(reqHeaders, "session");

		if (token) {
			const parts = token.split(".");
			if (parts.length === 2 && parts[0]) {
				const sessionId = parts[0];
				await db.delete(sessions).where(eq(sessions.id, sessionId));
			}
		}

		// blank session
		setCookie(resHeaders, "session", "", {
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			maxAge: SESSION_EXPIRES_IN_MS / 1000,
			secure: env.NODE_ENV === "production",
		});
	},
);

const getMe = base
	.use(authenticatedMiddleware)
	.handler(async ({ context: { user } }) => user);

export const authRouter = {
	signInWithEmailAndPassword,
	signOut,
	getMe,
};
