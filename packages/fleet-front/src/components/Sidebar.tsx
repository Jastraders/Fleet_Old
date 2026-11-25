import { Link } from "@tanstack/react-router";
import {
	BanknoteArrowDownIcon,
	BellIcon,
	ChartPieIcon,
	CircleUserRoundIcon,
	CoinsIcon,
	FileBarChart2Icon,
	LifeBuoyIcon,
	type LucideIcon,
	ReceiptTextIcon,
	SettingsIcon,
	TagIcon,
	TrendingUpIcon,
	TruckIcon,
	UsersIcon,
	WarehouseIcon,
} from "lucide-react";
import type * as React from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
	label: string;
	to: string;
	icon: LucideIcon;
	disabled?: boolean;
	exact?: boolean;
	showUnreadDot?: boolean;
}

export interface SidebarNavSection {
	id: string;
	label: string;
	role?: string;
	items: SidebarNavItem[];
}

export interface SidebarUser {
	name: string;
	email: string;
}

export const SIDEBAR_NAV_SECTIONS: SidebarNavSection[] = [
	{
		id: "analyst",
		label: "Analyst",
		role: "analyst",
		items: [
			{
				label: "Analytics",
				to: "/dashboard/analyst/analytics",
				icon: ChartPieIcon,
				exact: true,
			},
		],
	},
	{
		id: "accountant",
		label: "Accountant",
		role: "accountant",
		items: [
			{
				label: "Expenses",
				to: "/dashboard/accountant/expenses",
				icon: TagIcon,
				exact: true,
			},
			{
				label: "Drivers",
				to: "/dashboard/accountant/drivers",
				icon: CircleUserRoundIcon,
				exact: true,
			},
			{
				label: "Journal",
				to: "/dashboard/accountant/journal-entries",
				icon: BanknoteArrowDownIcon,
				exact: true,
			},
			{
				label: "Bata",
				to: "/dashboard/accountant/bata",
				icon: CoinsIcon,
				exact: true,
			},
			{
				label: "Vehicles",
				to: "/dashboard/accountant/vehicles",
				icon: TruckIcon,
				exact: true,
			},
			{
				label: "Categories",
				to: "/dashboard/accountant/expense-categories",
				icon: FileBarChart2Icon,
				exact: true,
			},
		],
	},
	{
		id: "admin",
		label: "Admin",
		role: "admin",
		items: [
			{
				label: "Members",
				to: "/dashboard/admin/members",
				icon: UsersIcon,
				exact: true,
			},
			{
				label: "Reports",
				to: "/dashboard/admin/reports",
				icon: ReceiptTextIcon,
				exact: true,
			},
			{
				label: "Revenue",
				to: "/dashboard/admin/revenue",
				icon: TrendingUpIcon,
				exact: true,
			},
			{
				label: "Warehouse",
				to: "/dashboard/admin/warehouse",
				icon: WarehouseIcon,
				exact: true,
			},
		],
	},
	{
		id: "general",
		label: "General",
		items: [
			{
				label: "Notifications",
				to: "/dashboard/general/notifications",
				icon: BellIcon,
				exact: false,
				showUnreadDot: true,
			},
			{
				label: "Settings",
				to: "/",
				icon: SettingsIcon,
				disabled: true,
			},
			{
				label: "Support",
				to: "/",
				icon: LifeBuoyIcon,
				disabled: true,
			},
		],
	},
];

export interface SidebarProps {
	sections?: SidebarNavSection[];
	unreadNotificationsCount?: number;
	footer?: React.ReactNode;
	title?: string;
	version?: string;
	className?: string;
}

const SIDEBAR_GRADIENT_CLASS =
	"bg-gradient-to-b from-[#0b1d3c] via-[#1f146f] via-[50.481%] to-[#1e4ea2]";

function SidebarInner({
	sections = SIDEBAR_NAV_SECTIONS,
	unreadNotificationsCount = 0,
	footer,
	title = "JAS Fleet",
	version = "v1.0.0",
	onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
	return (
		<div
			className={cn(
				SIDEBAR_GRADIENT_CLASS,
				"flex h-full w-full flex-col text-white select-none",
			)}
		>
			{/* Brand Header */}
			<div className="flex items-center gap-3.5 px-5 pt-8 pb-5">
				<div className="flex size-8 shrink-0 items-center justify-center text-white">
					<TruckIcon className="size-[22px] stroke-[1.75]" />
				</div>
				<div className="flex flex-col leading-none">
					<span className="text-[18px] font-bold tracking-tight text-white">
						{title}
					</span>
					<span className="mt-1 text-[11px] font-normal text-[#8f9b91]">
						{version}
					</span>
				</div>
			</div>

			{/* Navigation Sections */}
			<nav
				aria-label="Dashboard navigation"
				className="flex-1 overflow-y-auto px-2 pb-4"
			>
				{sections.map((section, sectionIndex) => (
					<div key={section.id}>
						{sectionIndex > 0 && (
							<div className="mx-2 my-3 h-px bg-[#344238]" />
						)}
						<div className="px-3 pb-2 pt-1">
							<span className="text-[13px] font-medium text-[#8f9b91]">
								{section.label}
							</span>
						</div>
						<ul className="flex flex-col gap-1">
							{section.items.map((item) => {
								const Icon = item.icon;
								const hasUnread =
									item.showUnreadDot && unreadNotificationsCount > 0;

								if (item.disabled) {
									return (
										<li key={item.label}>
											<span
												aria-disabled="true"
												className="flex cursor-not-allowed items-center gap-3.5 rounded-[10px] px-3 py-2.5 text-[15px] font-medium text-[#d1d9d1]/75"
											>
												<Icon className="size-[18px] shrink-0 stroke-[1.75]" />
												<span className="truncate">{item.label}</span>
											</span>
										</li>
									);
								}

								return (
									<li key={item.label}>
										<Link
											to={item.to}
											onClick={onNavigate}
											activeOptions={{
												exact: item.exact ?? true,
												includeSearch: false,
											}}
											activeProps={{
												className: "bg-white/25 text-white",
											}}
											inactiveProps={{
												className:
													"text-[#d1d5d1] hover:bg-white/10 hover:text-white",
											}}
											className="flex items-center gap-3.5 rounded-[10px] px-3 py-2.5 text-[15px] font-medium transition-colors"
										>
											<Icon className="size-[18px] shrink-0 stroke-[1.75]" />
											<span className="truncate">{item.label}</span>
											{hasUnread && (
												<span className="ml-auto size-2 shrink-0 rounded-full bg-red-500" />
											)}
										</Link>
									</li>
								);
							})}
						</ul>
					</div>
				))}
			</nav>

			{/* User Footer */}
			{footer && (
				<div className="mt-auto">
					<div className="mx-2 h-px bg-[#344238]" />
					<div className="px-4 py-4">{footer}</div>
				</div>
			)}
		</div>
	);
}

export function Sidebar({ className, ...props }: SidebarProps) {
	const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile}>
				<SheetContent
					side="left"
					className="w-[260px] border-none p-0 [&>button]:hidden"
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Sidebar</SheetTitle>
						<SheetDescription>Dashboard navigation menu</SheetDescription>
					</SheetHeader>
					<SidebarInner {...props} onNavigate={() => setOpenMobile(false)} />
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<aside
			data-state={state}
			className={cn(
				"hidden md:block shrink-0 transition-[width] duration-200 ease-linear overflow-hidden",
				state === "collapsed" ? "w-0" : "w-[260px]",
				className,
			)}
		>
			<div className="sticky top-0 h-svh w-[260px]">
				<SidebarInner {...props} />
			</div>
		</aside>
	);
}
