import { createFileRoute, redirect } from "@tanstack/react-router";

function hasRole(user: { roles: { role: string }[] }, role: string): boolean {
	return user.roles.some((r) => r.role === role || r.role === "owner");
}

export const Route = createFileRoute("/dashboard/")({
	beforeLoad: ({ context: { user } }) => {
		if (hasRole(user, "analyst")) {
			throw redirect({
				to: "/dashboard/analyst/analytics",
			});
		}

		if (hasRole(user, "accountant")) {
			throw redirect({
				to: "/dashboard/accountant/journal-entries",
			});
		}

		if (hasRole(user, "admin")) {
			throw redirect({
				to: "/dashboard/admin/members",
			});
		}
	},
});
