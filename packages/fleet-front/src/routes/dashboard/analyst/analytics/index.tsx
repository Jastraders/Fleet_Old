import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BellIcon } from "lucide-react";
import * as v from "valibot";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from "@/components/ui/breadcrumb";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orpc } from "@/orpc";
import { ExpenseCategoriesStatsCard } from "@/routes/dashboard/analyst/analytics/-index/expense-categories-stats-card";
import { SummaryStatsCards } from "@/routes/dashboard/analyst/analytics/-index/summary-stats-cards";
import { VehicleLeaderboardCard } from "@/routes/dashboard/analyst/analytics/-index/vehicle-leaderboard-card";
import { VehicleProfitChart } from "@/routes/dashboard/analyst/analytics/-index/vehicle-profit-chart";

const periodSchema = v.picklist([
	"all_time",
	"last_7d",
	"last_30d",
	"last_6m",
	"last_12m",
	"custom",
]);

const querySchema = v.object({
	period: v.optional(v.fallback(periodSchema, "all_time"), "all_time"),
	startDate: v.optional(v.string()),
	endDate: v.optional(v.string()),
});

export const Route = createFileRoute("/dashboard/analyst/analytics/")({
	validateSearch: querySchema,
	loaderDeps: ({ search: { period, startDate, endDate } }) => ({ period, startDate, endDate }),
	loader: ({ context: { orpc, queryClient }, deps: { period, startDate, endDate } }) => {
		queryClient.prefetchQuery(
			orpc.analyst.analytics.summaryStats.queryOptions({
				input: { period, startDate, endDate },
			}),
		);
		queryClient.prefetchQuery(
			orpc.analyst.analytics.fleetStats.queryOptions({
				input: { period, startDate, endDate },
			}),
		);
		queryClient.prefetchQuery(
			orpc.analyst.analytics.expensesStats.queryOptions({
				input: { period, startDate, endDate },
			}),
		);
	},
	component: RouteComponent,
});

const periodOptions = [
	{ value: "last_7d", label: "Last 7 days" },
	{ value: "last_30d", label: "Last 30 days" },
	{ value: "last_6m", label: "Last 6 months" },
	{ value: "last_12m", label: "Last 12 months" },
	{ value: "all_time", label: "All time" },
	{ value: "custom", label: "Custom date range" },
] as const;

function RouteComponent() {
	const { period, startDate, endDate } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data: notificationCount } = useSuspenseQuery(
		orpc.general.notifications.count.queryOptions(),
	);
	const { data: unreadNotifications } = useSuspenseQuery(
		orpc.general.notifications.list.queryOptions({ input: { filter: "unread" } }),
	);

	function handlePeriodChange(value: typeof period | null) {
		if (value === null) return;
		if (value === "custom") {
			const today = new Date().toISOString().split("T")[0];
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			navigate({
				search: {
					period: "custom",
					startDate: startDate || thirtyDaysAgo,
					endDate: endDate || today,
				},
			});
		} else {
			navigate({
				search: { period: value, startDate: undefined, endDate: undefined },
			});
		}
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
									render={<Link to="/dashboard">Overview</Link>}
								/>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto mr-4 flex items-center gap-2 flex-wrap justify-end">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="outline" size="icon" className="relative">
									<BellIcon className="h-4 w-4" />
									{notificationCount?.unread > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" /> : null}
								</Button>
							}
						/>
						<DropdownMenuContent align="end" className="w-96 max-w-[90vw]">
							<DropdownMenuLabel>Notifications</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{unreadNotifications.length === 0 ? (
								<div className="px-2 py-3 text-sm text-muted-foreground">No new notifications.</div>
							) : (
								unreadNotifications.slice(0, 5).map((item: any) => {
									const meta = (() => {
										try {
											return item.metadata ? JSON.parse(item.metadata) : {};
										} catch {
											return {};
										}
									})();
									return (
										<DropdownMenuItem
											key={item.id}
											onClick={() => navigate({ to: "/dashboard/general/notifications" })}
											className="items-start whitespace-normal"
										>
											{meta.renewalType ?? "Renewal"} for {meta.vehicleName ?? "vehicle"} is due in {meta.daysRemaining ?? "-"} day(s).
										</DropdownMenuItem>
									);
								})
							)}
						</DropdownMenuContent>
					</DropdownMenu>

					<div className="flex items-center gap-2">
						<Select
							items={periodOptions}
							value={period}
							onValueChange={handlePeriodChange}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Select period" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{periodOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>

						{period === "custom" && (
							<div className="flex items-center gap-2">
								<Input
									type="date"
									value={startDate || ""}
									onChange={(e) =>
										navigate({
											search: (prev) => ({ ...prev, startDate: e.target.value }),
										})
									}
									className="w-[140px] h-9"
								/>
								<span className="text-xs text-muted-foreground">to</span>
								<Input
									type="date"
									value={endDate || ""}
									onChange={(e) =>
										navigate({
											search: (prev) => ({ ...prev, endDate: e.target.value }),
										})
									}
									className="w-[140px] h-9"
								/>
							</div>
						)}
					</div>
				</div>
			</header>
			<div className="@container/main flex flex-1 flex-col gap-2">
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
					<SummaryStatsCards period={period} startDate={startDate} endDate={endDate} />
					<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
						<VehicleProfitChart period={period} startDate={startDate} endDate={endDate} className="col-span-4" />
					</div>
					<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
						<VehicleLeaderboardCard period={period} startDate={startDate} endDate={endDate} className="col-span-2" />
						<ExpenseCategoriesStatsCard
							period={period}
							startDate={startDate}
							endDate={endDate}
							className="col-span-2"
						/>
					</div>
				</div>
			</div>
		</>
	);
}