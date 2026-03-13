import { ORPCError } from "@orpc/server";
import { base } from "@/context";
import { authenticatedMiddleware } from "@/middlewares/authenticated";

export const ownerAuthorized = base
	.use(authenticatedMiddleware)
	.use(async ({ context: { user }, next }) => {
		const hasOwnerRole = user.roles.some(
			(userRole) => userRole.role === "owner",
		);

		if (!hasOwnerRole) {
			throw new ORPCError("FORBIDDEN");
		}

		return await next({
			context: { user },
		});
	});
