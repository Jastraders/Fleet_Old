import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { Suspense, useMemo, useRef } from "react";
import { Pie, PieChart } from "recharts";
import { Button } from "@/components/ui/button";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
} from "@/components/ui/chart";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import useSvgExport from "@/hooks/use-svg-export";
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";
import type { DashboardPeriod, ExpenseCategoryStatsItem } from "./types";

interface ExpensesDonutChartProps {
	period: DashboardPeriod;
	startDate?: string;
	endDate?: string;
	periodLabel?: string;
	className?: string;
}

function ExpensesDonutChartSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"rounded-[20px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)] sm:p-8",
				className,
			)}
		>
			<div className="flex items-start justify-between">
				<div>
					<Skeleton className="h-7 w-56" />
					<Skeleton className="mt-2 h-5 w-64" />
				</div>
				<Skeleton className="h-6 w-36" />
			</div>
			<div className="mt-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
				<div className="flex justify-center lg:col-span-5">
					<Skeleton className="size-64 rounded-full" />
				</div>
				<div className="space-y-4 lg:col-span-7">
					{Array.from({ length: 5 }).map((_, idx) => (
						<Skeleton key={`donut-skel-${idx}`} className="h-6 w-full" />
					))}
				</div>
			</div>
		</div>
	);
}

function CustomTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: Array<{
		name: string;
		value: number;
		payload: { name: string; fill?: string };
	}>;
}) {
	if (active && payload && payload.length > 0) {
		const data = payload[0];
		return (
			<div className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5 shadow-md">
				{data.payload.fill && (
					<div
						className="h-3 w-3 shrink-0 rounded"
						style={{ backgroundColor: data.payload.fill }}
					/>
				)}
				<div>
					<p className="text-sm font-semibold">{data.payload.name}</p>
					<p className="text-sm text-foreground">{formatINR(data.value)}</p>
				</div>
			</div>
		);
	}
	return null;
}

function ExpensesDonutChartContent({
	period,
	startDate,
	endDate,
	periodLabel,
	className,
}: ExpensesDonutChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);

	const { data } = useSuspenseQuery({
		...orpc.analyst.analytics.expensesStats.queryOptions({
			input: { period, startDate, endDate },
		}),
	});
	const expenseStats = data as ExpenseCategoryStatsItem[];

	const { chartData, chartConfig, totalAmount } = useMemo(() => {
		const config: ChartConfig = {
			amount: { label: "Amount" },
		};
		const total = expenseStats.reduce((sum, item) => sum + item.amount, 0);

		const transformedData = expenseStats.map((item) => {
			const color = item.color.startsWith("#") ? item.color : `#${item.color}`;
			config[item.id] = {
				label: item.name,
				color,
			};

			return {
				category: item.id,
				name: item.name,
				amount: item.amount,
				fill: color,
				percentage: total > 0 ? (item.amount / total) * 100 : 0,
			};
		});

		return {
			chartData: transformedData,
			chartConfig: config,
			totalAmount: total,
		};
	}, [expenseStats]);

	const svgRef = useRef<SVGSVGElement | null>(null);
	const { downloadPng, downloadJpeg, downloadSvg } = useSvgExport(svgRef);

	const exportWith = async (fn: () => Promise<void>) => {
		if (!chartContainerRef.current) return;
		const svg = chartContainerRef.current.querySelector("svg");
		if (svg) {
			svgRef.current = svg;
			await fn();
		}
	};

	return (
		<section
			className={cn(
				"rounded-[20px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)] sm:p-8",
				className,
			)}
		>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 className="text-[22px] font-semibold leading-tight text-black sm:text-[26px]">
						Expenses by Category
					</h2>
					<p className="mt-1 text-[15px] text-[#666] sm:text-[17px]">
						Breakdown of expenses for selected period
					</p>
				</div>
				<div className="flex items-center gap-3">
					{periodLabel && (
						<span className="text-[16px] font-medium text-black sm:text-[20px]">
							{periodLabel}
						</span>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant="outline"
									size="icon"
									aria-label="Export Expenses chart"
									className="size-10 rounded-[8px] border-[#e5e7eb] bg-white shadow-[0px_2px_4px_rgba(0,0,0,0.12)] hover:bg-neutral-50"
								>
									<DownloadIcon className="size-4 text-[#1f2939]" />
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() => void exportWith(downloadPng.execute)}
							>
								Download as PNG
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => void exportWith(downloadJpeg.execute)}
							>
								Download as JPEG
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => void exportWith(downloadSvg.execute)}
							>
								Download as SVG
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{chartData.length === 0 ? (
				<div className="flex h-60 items-center justify-center text-sm text-[#666]">
					No expenses recorded for this period.
				</div>
			) : (
				<div className="mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
					<div
						className="flex items-center justify-center lg:col-span-5"
						ref={chartContainerRef}
					>
						<ChartContainer
							id="expense-category-donut"
							config={chartConfig}
							className="aspect-square w-full max-w-[300px]"
						>
							<PieChart>
								<ChartTooltip cursor={false} content={<CustomTooltip />} />
								<Pie
									data={chartData}
									dataKey="amount"
									nameKey="name"
									innerRadius={68}
									outerRadius={116}
									strokeWidth={3}
								/>
							</PieChart>
						</ChartContainer>
					</div>

					<div className="space-y-4 lg:col-span-7">
						{chartData.map((entry) => (
							<div
								key={entry.category}
								className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-6 text-[15px]"
							>
								<div className="flex min-w-0 items-center gap-3.5">
									<span
										className="size-[15px] shrink-0 rounded-[2px]"
										style={{ backgroundColor: entry.fill }}
									/>
									<span className="truncate font-medium text-black">
										{entry.name}
									</span>
								</div>
								<span className="font-medium text-[#545454] tabular-nums">
									{formatINR(entry.amount)}
								</span>
								<span className="w-14 text-right font-medium text-[#545454] tabular-nums">
									{totalAmount > 0 ? `${entry.percentage.toFixed(1)}%` : "0.0%"}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</section>
	);
}

export function ExpensesDonutChart(props: ExpensesDonutChartProps) {
	return (
		<Suspense fallback={<ExpensesDonutChartSkeleton className={props.className} />}>
			<ExpensesDonutChartContent {...props} />
		</Suspense>
	);
}
