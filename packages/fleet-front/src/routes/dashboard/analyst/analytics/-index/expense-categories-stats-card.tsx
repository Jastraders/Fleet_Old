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

type Period = "all_time" | "last_7d" | "last_30d" | "last_6m" | "last_12m" | "custom";

interface ExpenseCategoriesStatsCardProps extends ComponentProps<typeof Card> {
	period: Period;
	startDate?: string;
	endDate?: string;
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
		payload: { name: string; fill?: string };
	}>;
}) {
	if (active && payload && payload.length > 0) {
		const data = payload[0];
		return (
			<div className="flex items-center gap-2 rounded-lg border border-border bg-background p-2 shadow-md">
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

function ExpenseCategoryChartContent({
	period,
	startDate,
	endDate,
	className,
	...props
}: ExpenseCategoriesStatsCardProps) {
	const id = "expense-category-pie";
	const chartContainerRef = useRef<HTMLDivElement>(null);

	const { data } = useSuspenseQuery({
		...orpc.analyst.analytics.expensesStats.queryOptions({
			input: { period, startDate, endDate },
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
				<CardHeader className="flex-row items-start justify-between border-b">
					<div>
						<CardTitle>Expenses by Category</CardTitle>
						<CardDescription>No expense data for this period</CardDescription>
					</div>
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
			<CardHeader className="flex-row items-start justify-between space-y-0 border-b pb-4">
				<div>
					<CardTitle>Expenses by Category</CardTitle>
					<CardDescription>
						Breakdown of expenses for selected period
					</CardDescription>
				</div>
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
			<CardContent className="flex flex-1 flex-col items-center justify-between p-4 gap-3">
				<div
					className="relative mx-auto aspect-square w-full max-w-52 flex items-center justify-center min-h-[180px]"
					ref={chartContainerRef}
				>
					<ChartContainer
						id={id}
						config={chartConfig}
						className="aspect-square w-full max-w-52"
					>
						<PieChart>
							<ChartTooltip cursor={false} content={<CustomTooltip />} />
							<Pie
								data={chartData}
								dataKey="amount"
								nameKey="name"
								innerRadius={55}
								outerRadius={80}
								strokeWidth={4}
							/>
						</PieChart>
					</ChartContainer>
				</div>
				<div className="w-full max-h-36 overflow-y-auto pt-2.5 border-t border-border/40">
					<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs">
						{chartData.map((entry) => (
							<div key={entry.category} className="flex items-center gap-1.5 shrink-0">
								<div
									className="h-2.5 w-2.5 rounded-xs shrink-0"
									style={{ backgroundColor: entry.fill }}
								/>
								<span className="text-xs text-foreground font-medium">{entry.name}</span>
							</div>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function ExpenseCategoriesStatsCard(props: ExpenseCategoriesStatsCardProps) {
	return (
		<Suspense
			fallback={
				<ExpenseCategoryChartSkeleton className={props.className} {...props} />
			}
		>
			<ExpenseCategoryChartContent
				{...props}
			/>
		</Suspense>
	);
}
