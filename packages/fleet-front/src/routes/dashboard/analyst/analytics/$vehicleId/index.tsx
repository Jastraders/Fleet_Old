import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Suspense } from "react";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/orpc";
import { VehicleExpenseCategoriesStatsCard } from "./-index/vehicle-expense-categories-stats-card";
import { VehicleMonthlyTrendChart } from "./-index/vehicle-monthly-trend-chart";
import { VehicleRoiScoreCard } from "./-index/vehicle-roi-score-card";
import { VehicleSummaryStatsCards } from "./-index/vehicle-summary-stats-cards";

const periodSchema = v.picklist([
	"all_time",
	"last_30d",
	"last_3m",
	"last_6m",
	"last_9m",
	"last_12m",
	"custom",
]);

type Period = v.InferOutput<typeof periodSchema>;

const querySchema = v.object({
	period: v.optional(v.fallback(periodSchema, "all_time"), "all_time"),
	startDate: v.optional(v.string()),
	endDate: v.optional(v.string()),
});

export const Route = createFileRoute(
	"/dashboard/analyst/analytics/$vehicleId/",
)({
	validateSearch: querySchema,
	loaderDeps: ({ search: { period, startDate, endDate } }) => ({ period, startDate, endDate }),
	loader: ({
		context: { orpc: orpcClient, queryClient },
		params: { vehicleId },
		deps: { period, startDate, endDate },
	}) => {
		queryClient.prefetchQuery(
			orpcClient.accountant.vehicles.get.queryOptions({
				input: { id: vehicleId },
			}),
		);
		queryClient.prefetchQuery(
			orpcClient.analyst.analytics.vehicle.summaryStats.queryOptions({
				input: { vehicleId, period, startDate, endDate },
			}),
		);
		queryClient.prefetchQuery(
			orpcClient.analyst.analytics.vehicle.vehicleStats.queryOptions({
				input: { vehicleId, period, startDate, endDate },
			}),
		);
		queryClient.prefetchQuery(
			orpcClient.analyst.analytics.vehicle.expensesStats.queryOptions({
				input: { vehicleId, period, startDate, endDate },
			}),
		);
		queryClient.prefetchQuery(
			orpcClient.analyst.analytics.vehicle.roiStats.queryOptions({
				input: { vehicleId, period, startDate, endDate },
			}),
		);
	},
	component: RouteComponent,
});

const periodOptions = [
	{ value: "last_30d", label: "Last 30 days" },
	{ value: "last_3m", label: "Last 3 months" },
	{ value: "last_6m", label: "Last 6 months" },
	{ value: "last_9m", label: "Last 9 months" },
	{ value: "last_12m", label: "Last 12 months" },
	{ value: "all_time", label: "All time" },
	{ value: "custom", label: "Custom date range" },
] as const;

type VehicleSummary = {
	name: string;
	licensePlate: string;
};

function VehicleTitleSkeleton() {
	return (
		<div className="flex items-center gap-4">
			<Button variant="outline" size="icon" disabled>
				<div className="h-4 w-4" />
			</Button>
			<div>
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-4 w-32" />
			</div>
		</div>
	);
}

function VehicleHeaderContent({
	period,
	startDate,
	endDate,
}: {
	period: Period;
	startDate?: string;
	endDate?: string;
}) {
	const navigate = useNavigate({ from: Route.fullPath });

	function handlePeriodChange(value: Period | null) {
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
		<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
			<div className="flex items-center gap-4 px-4 flex-1">
				<SidebarTrigger className="-ml-1" />
				<Separator
					orientation="vertical"
					className="mr-2 data-[orientation=vertical]:h-4 self-center!"
				/>
			</div>
			<div className="mr-4 flex items-center gap-2 flex-wrap justify-end">
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
		</header>
	);
}

function VehicleTitleContent() {
	const navigate = useNavigate({ from: Route.fullPath });
	const { vehicleId } = Route.useParams();

	const { data: vehicle } = useSuspenseQuery<VehicleSummary>({
		...orpc.accountant.vehicles.get.queryOptions({ input: { id: vehicleId } }),
	});

	function handleGoBack() {
		navigate({ to: "/dashboard/analyst/analytics" });
	}

	return (
		<div className="flex items-center gap-4">
			<Button
				variant="outline"
				size="icon"
				onClick={handleGoBack}
				type="button"
			>
				<ArrowLeftIcon className="h-4 w-4" />
			</Button>
			<div>
				<h1 className="text-2xl font-bold tracking-tight">{vehicle.name}</h1>
				<p className="text-muted-foreground text-sm">
					{vehicle.licensePlate}
				</p>
			</div>
		</div>
	);
}

function RouteComponent() {
	const { vehicleId } = Route.useParams();
	const { period, startDate, endDate } = Route.useSearch();

	return (
		<>
			<VehicleHeaderContent period={period} startDate={startDate} endDate={endDate} />
			<div className="@container/main flex flex-1 flex-col gap-2">
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
					<Suspense fallback={<VehicleTitleSkeleton />}>
						<VehicleTitleContent />
					</Suspense>

					<VehicleSummaryStatsCards vehicleId={vehicleId} period={period} startDate={startDate} endDate={endDate} />
					<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
						<VehicleMonthlyTrendChart
							vehicleId={vehicleId}
							period={period}
							startDate={startDate}
							endDate={endDate}
							className="col-span-4"
						/>
					</div>
					<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
						<VehicleExpenseCategoriesStatsCard
							vehicleId={vehicleId}
							period={period}
							startDate={startDate}
							endDate={endDate}
							className="col-span-2"
						/>
						<VehicleRoiScoreCard
							vehicleId={vehicleId}
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
