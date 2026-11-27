import { useSuspenseQuery } from "@tanstack/react-query";
import {
	BanknoteArrowDownIcon,
	BusFrontIcon,
	CircleDollarSignIcon,
	type LucideIcon,
	PercentIcon,
	ShieldCheckIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	TruckIcon,
} from "lucide-react";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";
import type {
	DashboardPeriod,
	FleetStatsItem,
	SummaryStatsData,
} from "./types";

interface KpiCardsProps {
	period: DashboardPeriod;
	startDate?: string;
	endDate?: string;
}

interface KpiCardItem {
	key: string;
	title: string;
	value: string;
	change: number | null;
	subtitle: string;
	icon: LucideIcon;
	iconBoxClass: string;
	invertTrendColor?: boolean;
}

const KPI_GRADIENT_STYLE: React.CSSProperties = {
	backgroundImage:
		"linear-gradient(116.67deg, rgba(219, 232, 255, 0.2) 6.7%, rgba(153, 163, 227, 0.2) 51.56%, rgba(82, 132, 197, 0.3) 100%)",
};

function getPeriodComparisonLabel(period: DashboardPeriod): string {
	switch (period) {
		case "all_time":
			return "all time";
		case "last_7d":
			return "last week";
		case "last_30d":
			return "last month";
		case "last_6m":
			return "last 6 months";
		case "last_12m":
			return "last year";
		case "custom":
			return "prev period";
	}
}

function formatTrend(change: number | null): string {
	if (change === null) return "0.0%";
	const sign = change >= 0 ? "+" : "";
	return `${sign}${change.toFixed(1)}%`;
}

function KpiCardsSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
			{Array.from({ length: 6 }).map((_, idx) => (
				<div
					key={`kpi-skeleton-${idx}`}
					className="h-[138px] rounded-[20px] border border-[#dbd6d6] p-5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.08)] backdrop-blur-[7.5px]"
					style={KPI_GRADIENT_STYLE}
				>
					<div className="flex items-start justify-between">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="size-9 rounded-[10px]" />
					</div>
					<Skeleton className="mt-3 h-8 w-32" />
					<Skeleton className="mt-4 h-3.5 w-36" />
				</div>
			))}
		</div>
	);
}

function KpiCardsContent({ period, startDate, endDate }: KpiCardsProps) {
	const { data: summary } = useSuspenseQuery<SummaryStatsData>({
		...orpc.analyst.analytics.summaryStats.queryOptions({
			input: { period, startDate, endDate },
		}),
	});
	const { data: fleetStats } = useSuspenseQuery<FleetStatsItem[]>({
		...orpc.analyst.analytics.fleetStats.queryOptions({
			input: { period, startDate, endDate },
		}),
	});

	const comparisonLabel = getPeriodComparisonLabel(period);
	const totalVehicles = fleetStats.length;
	const activeVehicles = fleetStats.filter(
		(v) => v.credit > 0 || v.debit > 0,
	).length;

	const cards: KpiCardItem[] = [
		{
			key: "revenue",
			title: "Total Revenue",
			value: formatINR(summary.revenue.value),
			change: summary.revenue.change,
			subtitle: comparisonLabel,
			icon: CircleDollarSignIcon,
			iconBoxClass: "bg-rose-500/15 text-rose-700",
		},
		{
			key: "expenses",
			title: "Total Expense",
			value: formatINR(summary.expenses.value),
			change: summary.expenses.change,
			subtitle: comparisonLabel,
			icon: BanknoteArrowDownIcon,
			iconBoxClass: "bg-emerald-700/15 text-emerald-800",
			invertTrendColor: true,
		},
		{
			key: "profit",
			title: "Net Profit",
			value: formatINR(summary.profit.value),
			change: summary.profit.change,
			subtitle: comparisonLabel,
			icon: PercentIcon,
			iconBoxClass: "bg-emerald-500/15 text-emerald-700",
		},
		{
			key: "total-vehicles",
			title: "Total Vehicles",
			value: String(totalVehicles),
			change: summary.revenue.change,
			subtitle: comparisonLabel,
			icon: BusFrontIcon,
			iconBoxClass: "bg-blue-500/15 text-blue-700",
		},
		{
			key: "active-vehicles",
			title: "Active Vehicles",
			value: String(activeVehicles),
			change: summary.profit.change,
			subtitle: comparisonLabel,
			icon: ShieldCheckIcon,
			iconBoxClass: "bg-orange-500/15 text-orange-700",
		},
		{
			key: "roi",
			title: "ROI",
			value: formatINR(summary.roi.value),
			change: summary.roi.change,
			subtitle: "expenses + investment",
			icon: TruckIcon,
			iconBoxClass: "bg-indigo-500/15 text-indigo-700",
		},
	];

	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
			{cards.map((card) => {
				const Icon = card.icon;
				const isPositive =
					card.change === null ? true : card.change >= 0;
				const isGood = card.invertTrendColor ? !isPositive : isPositive;

				return (
					<div
						key={card.key}
						className="flex min-h-[138px] flex-col justify-between rounded-[20px] border border-[#dbd6d6] p-5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.08)] backdrop-blur-[7.5px] transition-shadow hover:shadow-[0px_4px_14px_0px_rgba(0,0,0,0.12)]"
						style={KPI_GRADIENT_STYLE}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="text-[15px] font-semibold leading-snug text-[#545454]">
									{card.title}
								</p>
								<p className="mt-1.5 truncate text-[26px] font-bold leading-tight text-[#111827] tabular-nums">
									{card.value}
								</p>
							</div>
							<div
								className={cn(
									"flex size-9 shrink-0 items-center justify-center rounded-[10px]",
									card.iconBoxClass,
								)}
							>
								<Icon className="size-[18px] stroke-[1.8]" />
							</div>
						</div>

						<div className="mt-3 flex items-center gap-1.5 text-[13px] font-medium">
							{isPositive ? (
								<TrendingUpIcon
									className={cn(
										"size-3.5 shrink-0",
										isGood ? "text-[#1fb362]" : "text-[#b31f1f]",
									)}
								/>
							) : (
								<TrendingDownIcon
									className={cn(
										"size-3.5 shrink-0",
										isGood ? "text-[#1fb362]" : "text-[#b31f1f]",
									)}
								/>
							)}
							<span
								className={cn(
									"truncate",
									isGood ? "text-[#1fb362]" : "text-[#b31f1f]",
								)}
							>
								{card.change !== null
									? `${formatTrend(card.change)} ${card.subtitle}`
									: card.subtitle}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}

export function KpiCards(props: KpiCardsProps) {
	return (
		<Suspense fallback={<KpiCardsSkeleton />}>
			<KpiCardsContent {...props} />
		</Suspense>
	);
}
