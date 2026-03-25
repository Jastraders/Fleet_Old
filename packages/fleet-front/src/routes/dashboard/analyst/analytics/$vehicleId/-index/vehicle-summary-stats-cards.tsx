import { useSuspenseQuery } from "@tanstack/react-query";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";

type Period =
	| "all_time"
	| "last_30d"
	| "last_3m"
	| "last_6m"
	| "last_9m"
	| "last_12m";

interface VehicleSummaryStatsCardsProps {
	vehicleId: string;
	period: Period;
}

interface VehicleSummaryStatValue {
	value: number;
	change: number | null;
}

interface VehicleSummaryStatsData {
	revenue: VehicleSummaryStatValue;
	expenses: VehicleSummaryStatValue;
	profit: VehicleSummaryStatValue;
	profitPercentage: VehicleSummaryStatValue;
}

function getPeriodDescription(period: Period): string {
	switch (period) {
		case "all_time":
			return "Compared to all-time performance";
		case "last_30d":
			return "Compared to previous 30 days";
		case "last_3m":
			return "Compared to previous 3 months";
		case "last_6m":
			return "Compared to previous 6 months";
		case "last_9m":
			return "Compared to previous 9 months";
		case "last_12m":
			return "Compared to previous 12 months";
	}
}

function formatChange(change: number | null): string {
	if (change === null) return "N/A";
	const sign = change >= 0 ? "+" : "";
	return `${sign}${change.toFixed(1)}%`;
}

const skeletonCards = ["revenue", "expenses", "profit", "profitPercentage"];

function VehicleSummaryStatsCardsSkeleton() {
	return (
		<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
			{skeletonCards.map((card) => (
				<Card key={card} className="@container/card">
					<CardHeader>
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-32 mt-2" />
						<CardAction>
							<Skeleton className="h-5 w-16" />
						</CardAction>
					</CardHeader>
					<CardFooter className="flex-col items-start gap-1.5 text-sm">
						<Skeleton className="h-4 w-40" />
					</CardFooter>
				</Card>
			))}
		</div>
	);
}

function VehicleSummaryStatsCardsContent({
	vehicleId,
	period,
}: VehicleSummaryStatsCardsProps) {
	const { data } = useSuspenseQuery<VehicleSummaryStatsData>({
		...orpc.analyst.analytics.vehicle.summaryStats.queryOptions({
			input: { vehicleId, period },
		}),
	});

	const periodDescription = getPeriodDescription(period);

	return (
		<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
			<Card className="@container/card">
				<CardHeader>
					<CardDescription className="flex items-center justify-between">
						Total Revenue
						<Badge variant="outline">
							{data.revenue.change !== null && data.revenue.change >= 0 ? (
								<TrendingUpIcon />
							) : (
								<TrendingDownIcon className="text-destructive" />
							)}
							{formatChange(data.revenue.change)}
						</Badge>
					</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{formatINR(data.revenue.value)}
					</CardTitle>
				</CardHeader>
				<CardFooter className="flex-col items-start gap-1.5 text-sm">
					<div className="text-muted-foreground">{periodDescription}</div>
				</CardFooter>
			</Card>
			<Card className="@container/card">
				<CardHeader>
					<CardDescription className="flex items-center justify-between">
						Expenses
						<Badge variant="outline">
							{data.expenses.change !== null && data.expenses.change <= 0 ? (
								<TrendingDownIcon className="text-destructive" />
							) : (
								<TrendingUpIcon />
							)}
							{formatChange(data.expenses.change)}
						</Badge>
					</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{formatINR(data.expenses.value)}
					</CardTitle>
				</CardHeader>
				<CardFooter className="flex-col items-start gap-1.5 text-sm">
					<div className="text-muted-foreground">{periodDescription}</div>
				</CardFooter>
			</Card>
			<Card className="@container/card">
				<CardHeader>
					<CardDescription className="flex items-center justify-between">
						Profit
						<Badge variant="outline">
							{data.profit.change !== null && data.profit.change >= 0 ? (
								<TrendingUpIcon />
							) : (
								<TrendingDownIcon className="text-destructive" />
							)}
							{formatChange(data.profit.change)}
						</Badge>
					</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{formatINR(data.profit.value)}
					</CardTitle>
				</CardHeader>
				<CardFooter className="flex-col items-start gap-1.5 text-sm">
					<div className="text-muted-foreground">{periodDescription}</div>
				</CardFooter>
			</Card>
			<Card className="@container/card">
				<CardHeader>
					<CardDescription className="flex items-center justify-between">
						Profit %
						<Badge variant="outline">
							{data.profitPercentage.change !== null &&
							data.profitPercentage.change >= 0 ? (
								<TrendingUpIcon />
							) : (
								<TrendingDownIcon className="text-destructive" />
							)}
							{formatChange(data.profitPercentage.change)}
						</Badge>
					</CardDescription>
					<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
						{data.profitPercentage.value.toFixed(1)}%
					</CardTitle>
				</CardHeader>
				<CardFooter className="flex-col items-start gap-1.5 text-sm">
					<div className="text-muted-foreground">{periodDescription}</div>
				</CardFooter>
			</Card>
		</div>
	);
}

export function VehicleSummaryStatsCards({
	vehicleId,
	period,
}: VehicleSummaryStatsCardsProps) {
	return (
		<Suspense fallback={<VehicleSummaryStatsCardsSkeleton />}>
			<VehicleSummaryStatsCardsContent vehicleId={vehicleId} period={period} />
		</Suspense>
	);
}
