import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Suspense } from "react";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
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
]);

type Period = v.InferOutput<typeof periodSchema>;

const querySchema = v.object({
	period: v.optional(v.fallback(periodSchema, "all_time"), "all_time"),
});

export const Route = createFileRoute(
	"/dashboard/analyst/analytics/$vehicleId/",
)({
	validateSearch: querySchema,
	loaderDeps: ({ search: { period } }) => ({ period }),
	loader: ({
		context: { orpc: orpcClient, queryClient },
		params: { vehicleId },
		deps: { period },
	}) => {
		queryClient.prefetchQuery(
			orpcClient.accountant.vehicles.get.queryOptions({
				input: { id: vehicleId },
			}),
		);
		queryClient.prefetchQuery(
			orpcClient.analyst.analytics.vehicle.summaryStats.queryOptions({
				input: { vehicleId, period },
			}),
		);
		queryClient.prefetchQuery(
			orpcClient.analyst.analytics.vehicle.vehicleStats.queryOptions({
				input: { vehicleId, period },
			}),
		);
		queryClient.prefetchQuery(
			orpcClient.analyst.analytics.vehicle.expensesStats.queryOptions({
				input: { vehicleId, period },
			}),
		);
		queryClient.prefetchQuery(
			orpcClient.analyst.analytics.vehicle.roiStats.queryOptions({
				input: { vehicleId, period },
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

function VehicleHeaderContent({ period }: { period: Period }) {
	const navigate = useNavigate({ from: Route.fullPath });

	function handlePeriodChange(value: Period | null) {
		if (value === null) return;
		navigate({
			search: { period: value },
		});
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
			<div className="mr-4">
				<Select
					items={periodOptions}
					value={period}
					onValueChange={handlePeriodChange}
				>
					<SelectTrigger className="w-[160px]">
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
			</div>
		</header>
	);
}

function VehicleTitleContent() {
	const navigate = useNavigate({ from: Route.fullPath });
	const { vehicleId } = Route.useParams();

	const { data: vehicle } = useSuspenseQuery({
		...orpc.accountant.vehicles.get.queryOptions({ input: { id: vehicleId } }),
	});
	const vehicleData = vehicle as VehicleSummary;

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
				<h1 className="text-2xl font-bold tracking-tight">{vehicleData.name}</h1>
				<p className="text-muted-foreground text-sm">
					{vehicleData.licensePlate}
				</p>
			</div>
		</div>
	);
}

function RouteComponent() {
	const { vehicleId } = Route.useParams();
	const { period } = Route.useSearch();

	return (
		<>
			<VehicleHeaderContent period={period} />
			<div className="@container/main flex flex-1 flex-col gap-2">
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
					<Suspense fallback={<VehicleTitleSkeleton />}>
						<VehicleTitleContent />
					</Suspense>

					<VehicleSummaryStatsCards vehicleId={vehicleId} period={period} />
					<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
						<VehicleMonthlyTrendChart
							vehicleId={vehicleId}
							period={period}
							className="col-span-4"
						/>
					</div>
					<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
						<VehicleExpenseCategoriesStatsCard
							vehicleId={vehicleId}
							period={period}
							className="col-span-2"
						/>
						<VehicleRoiScoreCard
							vehicleId={vehicleId}
							period={period}
							className="col-span-2"
						/>
					</div>
				</div>
			</div>
		</>
	);
}
