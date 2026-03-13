import { GalleryVerticalEnd } from "lucide-react";
import type * as React from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { AppSidebarMainNav } from "@/routes/dashboard/-route/app-sidebar/app-sidebar-main-nav";
import { AppSidebarSecondaryNav } from "@/routes/dashboard/-route/app-sidebar/app-sidebar-secondary-nav";
import { AdminsSidebarUser } from "@/routes/dashboard/-route/app-sidebar/app-sidebar-user";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg">
							<div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
								<GalleryVerticalEnd className="size-4" />
							</div>
							<div className="flex flex-col gap-0.5 leading-none">
								<span className="font-medium">Fleet</span>
								<span className="">v1.0.0</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<AppSidebarMainNav />
				<AppSidebarSecondaryNav className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<AdminsSidebarUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
