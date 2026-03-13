import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
	BellIcon,
	ChevronsUpDownIcon,
	LogOutIcon,
	UserIcon,
} from "lucide-react";
import { Suspense, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/orpc";

function AdminsSidebarUserContent() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { isMobile } = useSidebar();

	const { data } = useSuspenseQuery(orpc.user.auth.getMe.queryOptions());
	const signOutMutation = useMutation({
		...orpc.user.auth.signOut.mutationOptions(),
		onSuccess: () => {
			// clear any cached data
			queryClient.clear();
			// revalidate router context with user: undefined
			return router.invalidate();
		},
	});

	const getInitials = (name: string) => {
		const parts = name.trim().split(" ");
		if (parts.length >= 2) {
			const firstInitial = parts[0]?.[0] ?? "";
			const secondInitial = parts[1]?.[0] ?? "";
			return `${firstInitial.toUpperCase()}${secondInitial.toUpperCase()}`;
		}
		return name.slice(0, 2).toUpperCase();
	};

	const handleSignOut = useCallback(() => {
		signOutMutation.mutate({});
	}, [signOutMutation]);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							>
								<Avatar className="h-8 w-8">
									<AvatarFallback>{getInitials(data.name)}</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{data.name}</span>
									<span className="truncate text-xs">{data.email}</span>
								</div>

								<ChevronsUpDownIcon className="ml-auto size-4" />
							</SidebarMenuButton>
						}
					/>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar className="h-8 w-8">
										<AvatarFallback>{getInitials(data.name)}</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{data.name}</span>
										<span className="text-muted-foreground truncate text-xs">
											{data.email}
										</span>
									</div>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							{/* todo */}
							<DropdownMenuItem disabled>
								<UserIcon />
								Account
							</DropdownMenuItem>
							{/* todo */}
							<DropdownMenuItem disabled>
								<BellIcon />
								Notifications
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={handleSignOut}
							disabled={signOutMutation.isPending}
						>
							<LogOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

function AdminsSidebarUserSkeleton() {
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton size="lg" disabled>
					<Skeleton className="h-8 w-8 rounded-lg" />
					<div className="grid flex-1 gap-1.5 text-left text-sm leading-tight">
						<Skeleton className="h-3.5 w-24" />
						<Skeleton className="h-3 w-32" />
					</div>
					<Skeleton className="ml-auto size-4" />
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

export function AdminsSidebarUser() {
	return (
		<Suspense fallback={<AdminsSidebarUserSkeleton />}>
			<AdminsSidebarUserContent />
		</Suspense>
	);
}
