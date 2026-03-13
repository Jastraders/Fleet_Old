import { ORPCError } from "@orpc/server";
import { base } from "@/context";
import { authenticatedMiddleware } from "@/middlewares/authenticated";

const ACCOUNTANT_ROLES = new Set(["owner", "accountant"]);

export const accountantAuthorized = base
	.use(authenticatedMiddleware)
	.use(async ({ context: { user }, next }) => {
		const hasAccountantRole = user.roles.some((userRole) =>
			ACCOUNTANT_ROLES.has(userRole.role),
		);

		if (!hasAccountantRole) {
			throw new ORPCError("FORBIDDEN");
		}

		return await next({
			context: { user },
		});
	});
