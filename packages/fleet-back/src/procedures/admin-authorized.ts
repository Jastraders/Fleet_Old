import { ORPCError } from "@orpc/server";
import { base } from "@/context";
import { authenticatedMiddleware } from "@/middlewares/authenticated";

const ADMIN_ROLES = new Set(["owner", "admin"]);

export const adminAuthorized = base
	.use(authenticatedMiddleware)
	.use(async ({ context: { user }, next }) => {
		const hasAdminRole = user.roles.some((userRole) =>
			ADMIN_ROLES.has(userRole.role),
		);

		if (!hasAdminRole) {
			throw new ORPCError("FORBIDDEN");
		}

		return await next({
			context: { user },
		});
	});
