import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { SIDEBAR_NAV_SECTIONS, Sidebar } from "@/components/Sidebar";
import { orpc } from "@/orpc";
import { AdminsSidebarUser } from "@/routes/dashboard/-route/app-sidebar/app-sidebar-user";

function hasRole(user: unknown, role: string): boolean {
	if (!user || typeof user !== "object" || !("roles" in user)) {
		return false;
	}

	const { roles } = user as { roles?: Array<{ role?: string }> };
	if (!Array.isArray(roles)) {
		return false;
	}

	return roles.some((r) => r.role === role || r.role === "owner");
}

export function AppSidebar({ className }: { className?: string }) {
	const { data: user } = useSuspenseQuery(orpc.user.auth.getMe.queryOptions());
	const { data: notificationCount } = useSuspenseQuery(
		orpc.general.notifications.count.queryOptions(),
	);

	const visibleSections = useMemo(
		() =>
			SIDEBAR_NAV_SECTIONS.filter(
				(section) => !section.role || hasRole(user, section.role),
			),
		[user],
	);

	return (
		<Sidebar
			className={className}
			sections={visibleSections}
			unreadNotificationsCount={notificationCount?.unread ?? 0}
			footer={<AdminsSidebarUser />}
		/>
	);
}
