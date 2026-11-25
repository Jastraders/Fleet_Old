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
import { useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/orpc";

function AdminsSidebarUserContent() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { isMobile } = useSidebar();

	const { data } = useSuspenseQuery(orpc.user.auth.getMe.queryOptions());
	const { data: notificationCount } = useSuspenseQuery(
		orpc.general.notifications.count.queryOptions(),
	);
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
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type="button"
						className="flex w-full items-center gap-3 rounded-[10px] p-1 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
					>
						<Avatar className="size-[44px] shrink-0">
							<AvatarFallback className="bg-[#13294b] text-[17px] font-semibold lowercase text-[#d1d9d1]">
								{getInitials(data.name)}
							</AvatarFallback>
						</Avatar>
						<div className="grid min-w-0 flex-1 leading-tight">
							<span className="truncate text-[17px] font-semibold text-white">
								{data.name}
							</span>
							<span className="truncate text-[14px] font-semibold text-[#d1d9d1]">
								{data.email}
							</span>
						</div>
						<ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-[#d1d9d1]/80" />
					</button>
				}
			/>
			<DropdownMenuContent
				className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
				side={isMobile ? "bottom" : "right"}
				align="end"
				sideOffset={8}
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
							<DropdownMenuItem
								onClick={() =>
									void router.navigate({
										to: "/dashboard/general/notifications",
									})
								}
							>
								<BellIcon />
								Notifications
								{notificationCount?.unread > 0 ? (
									<span className="ml-auto h-2 w-2 rounded-full bg-red-500" />
								) : null}
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
	);
}

function AdminsSidebarUserSkeleton() {
	return (
		<div className="flex w-full items-center gap-3 p-1">
			<Skeleton className="size-[44px] shrink-0 rounded-full bg-white/15" />
			<div className="grid flex-1 gap-1.5">
				<Skeleton className="h-4 w-24 bg-white/15" />
				<Skeleton className="h-3.5 w-32 bg-white/15" />
			</div>
		</div>
	);
}

export function AdminsSidebarUser() {
	return (
		<Suspense fallback={<AdminsSidebarUserSkeleton />}>
			<AdminsSidebarUserContent />
		</Suspense>
	);
}
