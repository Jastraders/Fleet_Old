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
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="min-w-0 overflow-x-hidden bg-[#F3F3F3]">
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
}
