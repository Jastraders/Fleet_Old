import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/routes/dashboard/-route/app-sidebar";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: ({ context: { user } }) => {
		if (!user) {
			throw redirect({
				to: "/",
			});
		}

		return {
			user,
		};
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<div className="bg-sidebar w-1/2 h-full absolute top-0 left-0" />
			<SidebarProvider>
				<AppSidebar className="sticky" />
				<SidebarInset>
					<Outlet />
				</SidebarInset>
			</SidebarProvider>
		</>
	);
}
