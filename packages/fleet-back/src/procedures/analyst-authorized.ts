import { ORPCError } from "@orpc/server";
import { base } from "@/context";
import { authenticatedMiddleware } from "@/middlewares/authenticated";

const ANALYST_ROLES = new Set(["owner", "analyst"]);

export const analystAuthorized = base
	.use(authenticatedMiddleware)
	.use(async ({ context: { user }, next }) => {
		const hasAnalystRole = user.roles.some((userRole) =>
			ANALYST_ROLES.has(userRole.role),
		);

		if (!hasAnalystRole) {
			throw new ORPCError("FORBIDDEN");
		}

		return await next({
			context: { user },
		});
	});
