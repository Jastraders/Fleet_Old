import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AlertTriangleIcon } from "lucide-react";
import { useMemo } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { orpc } from "@/orpc";

export const Route = createFileRoute("/dashboard/admin/revenue")({
	component: RouteComponent,
});

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

function RouteComponent() {
	const { data: user } = useSuspenseQuery(orpc.user.auth.getMe.queryOptions());
	const isAdmin = useMemo(() => hasRole(user, "admin"), [user]);

	if (!isAdmin) {
		return (
			<div className="flex flex-col items-center justify-center p-12 border rounded-lg bg-card text-center space-y-3 m-6">
				<AlertTriangleIcon className="h-10 w-10 text-amber-600" />
				<h2 className="text-lg font-bold">Access Denied</h2>
				<p className="text-muted-foreground text-sm max-w-md">
					Revenue is restricted exclusively to Admin users.
				</p>
			</div>
		);
	}

	return (
		<>
			<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
				<div className="flex items-center gap-2 px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4 self-center!"
					/>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem className="hidden md:block">
								<BreadcrumbLink
									render={<Link to="/dashboard/admin/revenue">Revenue</Link>}
								/>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
			</header>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Outlet />
			</div>
		</>
	);
}
