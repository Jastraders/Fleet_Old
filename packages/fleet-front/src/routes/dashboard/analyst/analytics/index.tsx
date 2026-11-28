import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BellIcon, CalendarClockIcon } from "lucide-react";
import * as v from "valibot";
import { ExpensesDonutChart } from "@/components/dashboard/ExpensesDonutChart";
import { FleetAlertsCard } from "@/components/dashboard/FleetAlertsCard";
import { FleetPerformanceChart } from "@/components/dashboard/FleetPerformanceChart";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { LiveFleetStatusCard } from "@/components/dashboard/LiveFleetStatusCard";
import { RecentVehicleActivityCard } from "@/components/dashboard/RecentVehicleActivityCard";
import { TruckMapCard } from "@/components/dashboard/TruckMapCard";
import { VehicleLeaderboard } from "@/components/dashboard/VehicleLeaderboard";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { orpc } from "@/orpc";

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
	loaderDeps: ({ search: { period, startDate, endDate } }) => ({
		period,
		startDate,
		endDate,
	}),
	loader: ({
		context: { orpc, queryClient },
		deps: { period, startDate, endDate },
	}) => {
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
		orpc.general.notifications.list.queryOptions({
			input: { filter: "unread" },
		}),
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

	const activePeriodLabel =
		period === "custom" && startDate && endDate
			? `${startDate} - ${endDate}`
			: periodOptions.find((o) => o.value === period)?.label;

	return (
		<div className="min-h-full w-full bg-[#F3F3F3] px-4 py-6 sm:px-6 lg:px-7">
			<div className="flex w-full flex-col gap-6">
				{/* Top Header */}
				<header className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<SidebarTrigger className="-ml-1 md:hidden" />
						<h1 className="text-[26px] font-semibold tracking-tight text-[#111827] sm:text-[30px]">
							Overview
						</h1>
					</div>

					<div className="flex flex-wrap items-center justify-end gap-3">
						<div className="flex items-center gap-2">
							<Select
								items={periodOptions}
								value={period}
								onValueChange={handlePeriodChange}
							>
								<SelectTrigger className="h-[46px] min-w-[195px] rounded-[14px] border border-[#e5e7eb] bg-white/80 px-4 text-[15px] font-medium text-black shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)]">
									<span className="flex items-center gap-2.5">
										<CalendarClockIcon className="size-5 shrink-0 text-[#111827]" />
										<SelectValue placeholder="Select period" />
									</span>
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
												search: (prev) => ({
													...prev,
													startDate: e.target.value,
												}),
											})
										}
										className="h-[46px] w-[140px] rounded-[14px] border-[#e5e7eb] bg-white"
									/>
									<span className="text-xs text-muted-foreground">to</span>
									<Input
										type="date"
										value={endDate || ""}
										onChange={(e) =>
											navigate({
												search: (prev) => ({
													...prev,
													endDate: e.target.value,
												}),
											})
										}
										className="h-[46px] w-[140px] rounded-[14px] border-[#e5e7eb] bg-white"
									/>
								</div>
							)}
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="outline"
										size="icon"
										aria-label="Notifications"
										className="relative size-[46px] rounded-[14px] border-[#e5e7eb] bg-white/80 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)] hover:bg-white"
									>
										<BellIcon className="size-5 text-[#111827]" />
										{notificationCount?.unread > 0 ? (
											<span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-red-500" />
										) : null}
									</Button>
								}
							/>
							<DropdownMenuContent align="end" className="w-96 max-w-[90vw]">
								<DropdownMenuLabel>Notifications</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{unreadNotifications.length === 0 ? (
									<div className="px-2 py-3 text-sm text-muted-foreground">
										No new notifications.
									</div>
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
												onClick={() =>
													navigate({ to: "/dashboard/general/notifications" })
												}
												className="items-start whitespace-normal"
											>
												{meta.renewalType ?? "Renewal"} for{" "}
												{meta.vehicleName ?? "vehicle"} is due in{" "}
												{meta.daysRemaining ?? "-"} day(s).
											</DropdownMenuItem>
										);
									})
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</header>

				{/* 6 KPI Cards */}
				<KpiCards period={period} startDate={startDate} endDate={endDate} />

				{/* Fleet Performance Bar Chart */}
				<FleetPerformanceChart
					period={period}
					startDate={startDate}
					endDate={endDate}
				/>

				{/* Live Fleet Status + Recent Activity + Truck & Map Card */}
				<div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
					<div className="flex flex-col gap-6 xl:col-span-6">
						<LiveFleetStatusCard
							period={period}
							startDate={startDate}
							endDate={endDate}
						/>
						<RecentVehicleActivityCard
							period={period}
							startDate={startDate}
							endDate={endDate}
						/>
					</div>
					<div className="xl:col-span-6">
						<TruckMapCard />
					</div>
				</div>

				{/* Vehicle Leaderboard + Fleet Alerts */}
				<div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
					<VehicleLeaderboard
						period={period}
						startDate={startDate}
						endDate={endDate}
						className="xl:col-span-7"
					/>
					<FleetAlertsCard className="xl:col-span-5" />
				</div>

				{/* Expenses by Category Donut Chart */}
				<ExpensesDonutChart
					period={period}
					startDate={startDate}
					endDate={endDate}
					periodLabel={activePeriodLabel}
				/>
			</div>
		</div>
	);
}
