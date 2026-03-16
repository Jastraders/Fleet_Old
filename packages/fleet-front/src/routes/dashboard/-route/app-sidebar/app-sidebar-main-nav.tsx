import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	BanknoteArrowDownIcon,
	ChartPieIcon,
    CircleUserRoundIcon,
	SettingsIcon,
	TagIcon,
	TruckIcon,
	UsersIcon,
} from "lucide-react";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { orpc } from "@/orpc";

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

export function AppSidebarMainNav() {
	const { data: user } = useSuspenseQuery(orpc.user.auth.getMe.queryOptions());

	return (
		<>
			{hasRole(user, "analyst") && (
				<>
					<SidebarGroup>
						<SidebarGroupLabel>Analyst</SidebarGroupLabel>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									<Link
										to="/dashboard/analyst/analytics"
										activeProps={{ "data-active": true }}
										activeOptions={{ exact: true, includeSearch: false }}
									/>
								}
							>
								<ChartPieIcon />
								Analytics
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarGroup>
					<SidebarSeparator />
				</>
			)}
			{hasRole(user, "accountant") && (
				<>
					<SidebarGroup>
						<SidebarGroupLabel>Accountant</SidebarGroupLabel>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									<Link
										to="/dashboard/accountant/drivers"
										activeProps={{ "data-active": true }}
										activeOptions={{ exact: true, includeSearch: false }}
									/>
								}
							>
								<CircleUserRoundIcon />
								Drivers
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									<Link
										to="/dashboard/accountant/journal-entries"
										activeProps={{ "data-active": true }}
										activeOptions={{ exact: true, includeSearch: false }}
									/>
								}
							>
								<BanknoteArrowDownIcon />
								Journal
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									<Link
										to="/dashboard/accountant/vehicles"
										activeProps={{ "data-active": true }}
										activeOptions={{ exact: true, includeSearch: false }}
									/>
								}
							>
								<TruckIcon />
								Vehicles
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									<Link
										to="/dashboard/accountant/expense-categories"
										activeProps={{ "data-active": true }}
										activeOptions={{ exact: true, includeSearch: false }}
									/>
								}
							>
								<TagIcon />
								Categories
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarGroup>
					<SidebarSeparator />
				</>
			)}
			{hasRole(user, "admin") && (
				<SidebarGroup>
					<SidebarGroupLabel>Admin</SidebarGroupLabel>
					<SidebarMenuItem>
						<SidebarMenuButton
							render={
								<Link
									to="/dashboard/admin/members"
									activeProps={{ "data-active": true }}
									activeOptions={{ exact: true, includeSearch: false }}
								/>
							}
						>
							<UsersIcon />
							Members
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						{/* todo */}
						<SidebarMenuButton
							disabled
							render={
								<Link to="/">
									<SettingsIcon />
									Settings
								</Link>
							}
						/>
					</SidebarMenuItem>
				</SidebarGroup>
			)}
		</>
	);
}
