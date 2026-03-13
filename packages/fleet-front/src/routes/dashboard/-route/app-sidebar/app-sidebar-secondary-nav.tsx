import { Link } from "@tanstack/react-router";
import { LifeBuoyIcon } from "lucide-react";
import type * as React from "react";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebarSecondaryNav({
	...props
}: React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					<SidebarMenuItem>
						{/* todo */}
						<SidebarMenuButton
							disabled
							size="sm"
							render={
								<Link to="/">
									<LifeBuoyIcon />
									Support
								</Link>
							}
						/>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
