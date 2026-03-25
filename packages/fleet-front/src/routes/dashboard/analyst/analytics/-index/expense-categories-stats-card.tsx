import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Suspense, useMemo, useRef } from "react";
import { Pie, PieChart } from "recharts";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
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

type Period = "all_time" | "last_7d" | "last_30d" | "last_6m" | "last_12m";

interface ExpenseCategoriesStatsCardProps extends ComponentProps<typeof Card> {
	period: Period;
}

type ExpenseCategoryStatsItem = {
	id: string;
	name: string;
	color: string;
	amount: number;
};

function ExpenseCategoryChartSkeleton({
	className,
	...props
}: ComponentProps<typeof Card>) {
	return (
		<Card className={cn("flex flex-col", className)} {...props}>
			<CardHeader className="border-b">
				<Skeleton className="h-6 w-40" />
				<Skeleton className="h-4 w-48 mt-1" />
			</CardHeader>
			<CardContent className="flex flex-1 justify-center pb-0">
				<Skeleton className="size-75 rounded-full" />
			</CardContent>
		</Card>
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
		payload: { name: string };
	}>;
}) {
	if (active && payload && payload.length > 0) {
		const data = payload[0];
		return (
			<div className="rounded-lg border border-border bg-background p-2 shadow-md">
				<p className="text-sm font-semibold">{data.payload.name}</p>
				<p className="text-sm text-foreground">{formatINR(data.value)}</p>
			</div>
		);
	}
	return null;
}

function CustomLegend({
	payload,
}: {
	payload?: Array<{ color: string; value: string }>;
}) {
	if (!payload) return null;

	return (
		<div className="flex flex-wrap gap-2 justify-center py-4">
			{payload.map((entry) => (
				<div key={entry.value} className="flex items-center gap-2">
					<div
						className="h-3 w-3 rounded"
						style={{ backgroundColor: entry.color }}
					/>
					<span className="text-sm text-foreground">{entry.value}</span>
				</div>
			))}
		</div>
	);
}

function ExpenseCategoryChartContent({
	period,
	className,
	...props
}: ExpenseCategoriesStatsCardProps) {
	const id = "expense-category-pie";
	const chartContainerRef = useRef<HTMLDivElement>(null);

	const { data } = useSuspenseQuery({
		...orpc.analyst.analytics.expensesStats.queryOptions({
			input: { period },
		}),
	});
	const expenseStats = data as ExpenseCategoryStatsItem[];

	// Transform data for chart and build config
	const { chartData, chartConfig } = useMemo(() => {
		const config: ChartConfig = {
			amount: {
				label: "Amount",
			},
		};

		const transformedData = expenseStats.map((item) => {
			const color = `#${item.color}`;

			config[item.id] = {
				label: item.name,
				color,
			};

			return {
				category: item.id,
				name: item.name,
				amount: item.amount,
				fill: color,
			};
		});

		return {
			chartData: transformedData,
			chartConfig: config,
		};
	}, [expenseStats]);

	// Get SVG ref from the chart container
	const svgRef = useRef<SVGSVGElement | null>(null);
	const { downloadPng, downloadJpeg, downloadSvg } = useSvgExport(svgRef);

	const handleDownloadPng = async () => {
		if (!chartContainerRef.current) return;
		const svg = chartContainerRef.current.querySelector("svg");
		if (svg) {
			svgRef.current = svg;
			await downloadPng.execute();
		}
	};

	const handleDownloadJpeg = async () => {
		if (!chartContainerRef.current) return;
		const svg = chartContainerRef.current.querySelector("svg");
		if (svg) {
			svgRef.current = svg;
			await downloadJpeg.execute();
		}
	};

	const handleDownloadSvg = async () => {
		if (!chartContainerRef.current) return;
		const svg = chartContainerRef.current.querySelector("svg");
		if (svg) {
			svgRef.current = svg;
			await downloadSvg.execute();
		}
	};

	if (chartData.length === 0) {
		return (
			<Card className={cn("flex flex-col", className)} {...props}>
				<CardHeader className="border-b flex-row items-start justify-between">
					<CardTitle>Expenses by Category</CardTitle>
					<CardDescription>No expense data for this period</CardDescription>
					<CardAction>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button variant="outline" size="icon">
										<DownloadIcon />
									</Button>
								}
							/>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleDownloadPng}>
									Download as PNG
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleDownloadJpeg}>
									Download as JPEG
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleDownloadSvg}>
									Download as SVG
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</CardAction>
				</CardHeader>
				<CardContent className="flex flex-1 items-center justify-center">
					<p className="text-muted-foreground">No expenses recorded</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={cn("flex flex-col", className)} {...props}>
			<CardHeader className="flex-row items-start justify-between space-y-0 pb-0 border-b">
				<CardTitle>Expenses by Category</CardTitle>
				<CardDescription>
					Breakdown of expenses for selected period
				</CardDescription>
			</CardHeader>
			<CardContent
				className="flex flex-1 justify-center pb-0"
				ref={chartContainerRef}
			>
				<ChartContainer
					id={id}
					config={chartConfig}
					className="mx-auto aspect-square w-full max-w-75"
				>
					<PieChart>
						<ChartTooltip cursor={false} content={<CustomTooltip />} />
						<Pie
							data={chartData}
							dataKey="amount"
							nameKey="name"
							innerRadius={60}
							strokeWidth={5}
						/>
						<ChartLegend content={<CustomLegend />} />
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

export function ExpenseCategoriesStatsCard({
	period,
	className,
	...props
}: ExpenseCategoriesStatsCardProps) {
	return (
		<Suspense
			fallback={
				<ExpenseCategoryChartSkeleton className={className} {...props} />
			}
		>
			<ExpenseCategoryChartContent
				period={period}
				className={className}
				{...props}
			/>
		</Suspense>
	);
}
