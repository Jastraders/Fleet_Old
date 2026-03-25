import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Suspense, useRef } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
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
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
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

interface VehicleProfitChartProps extends ComponentProps<typeof Card> {
	period: Period;
}

type FleetProfitChartItem = {
	vehicleName: string;
	profit: number;
	debit: number;
};

const chartConfig = {
	profit: {
		label: "Profit",
		color: "#072d54",
	},
	debit: {
		label: "Expenses",
		color: "#2f6196",
	},
} satisfies ChartConfig;

function VehicleProfitChartSkeleton({
	className,
	...props
}: ComponentProps<typeof Card>) {
	return (
		<Card className={cn("pb-0", className)} {...props}>
			<CardHeader className="border-b">
				<Skeleton className="h-6 w-32" />
				<Skeleton className="h-4 w-64 mt-1" />
			</CardHeader>
			<CardContent className="px-2 sm:p-6">
				<Skeleton className="h-[250px] w-full" />
			</CardContent>
		</Card>
	);
}

function VehicleProfitChartContent({
	period,
	className,
	...props
}: VehicleProfitChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const { data } = useSuspenseQuery<FleetProfitChartItem[]>({
		...orpc.analyst.analytics.fleetStats.queryOptions({
			input: { period },
		}),
	});
	const fleetStats = data;

	// Transform data for the chart - debit should be negative for stacking below 0
	const chartData = fleetStats.map((vehicle) => ({
		vehicleName: vehicle.vehicleName,
		profit: vehicle.profit + vehicle.debit, // to account for stacking offset
		debit: -vehicle.debit, // Negative so it stacks below the x-axis
		// Keep original debit value for tooltip
		originalDebit: vehicle.debit,
		originalProfit: vehicle.profit,
	}));

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

	return (
		<Card className={cn("pb-0", className)} {...props}>
			<CardHeader className="border-b">
				<CardTitle>Fleet Performance</CardTitle>
				<CardDescription>
					Profit and expenses by vehicle for the selected period
				</CardDescription>
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
			<CardContent className="px-2 sm:p-6">
				<div ref={chartContainerRef}>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[250px] w-full"
					>
						<BarChart accessibilityLayer data={chartData}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="vehicleName"
								tickLine={false}
								tickMargin={10}
								axisLine={false}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => formatINR(Math.abs(value))}
							/>
							<ReferenceLine y={0} stroke="var(--border)" />
							<ChartTooltip
								content={
									<ChartTooltipContent
										hideLabel
										className="w-50"
										formatter={(_value, name, item) => {
											const payload =
												typeof item === "object" &&
												item !== null &&
												"payload" in item
													? (item as {
															payload?: {
																originalDebit?: number;
																originalProfit?: number;
															};
														}).payload
													: undefined;

											return (
												<>
												<div
													className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg)"
													style={
														{
															"--color-bg": `var(--color-${name})`,
														} as React.CSSProperties
													}
												/>
												{chartConfig[name as keyof typeof chartConfig]?.label ||
													name}
												<div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
													{name === "debit" && payload?.originalDebit}
													{name === "profit" && payload?.originalProfit}
												</div>
											</>
											);
										}}
									/>
								}
								cursor={false}
							/>
							<ChartLegend content={<ChartLegendContent />} />
							<Bar
								dataKey="debit"
								stackId="a"
								fill="#2f6196"
								radius={[4, 4, 4, 4]}
								zIndex={1}
							/>
							<Bar
								dataKey="profit"
								stackId="a"
								fill="#072d54"
								radius={[4, 4, 4, 4]}
								zIndex={0}
							/>
						</BarChart>
					</ChartContainer>
				</div>
			</CardContent>
		</Card>
	);
}

export function VehicleProfitChart({
	period,
	className,
	...props
}: VehicleProfitChartProps) {
	return (
		<Suspense
			fallback={<VehicleProfitChartSkeleton className={className} {...props} />}
		>
			<VehicleProfitChartContent
				period={period}
				className={className}
				{...props}
			/>
		</Suspense>
	);
}
