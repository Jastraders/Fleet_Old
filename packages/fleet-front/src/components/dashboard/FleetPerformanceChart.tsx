import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { Suspense, useRef } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
	type ChartConfig,
	ChartContainer,
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
import type { DashboardPeriod, FleetStatsItem } from "./types";

interface FleetPerformanceChartProps {
	period: DashboardPeriod;
	startDate?: string;
	endDate?: string;
	className?: string;
}

const chartConfig = {
	debit: {
		label: "Expenses",
		color: "#18325e",
	},
	profit: {
		label: "Profit",
		color: "#cce0f8",
	},
} satisfies ChartConfig;

const chartDataMinWidth = (vehicleCount: number) => vehicleCount * 105;

function FleetPerformanceChartSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"rounded-[20px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)] sm:p-8",
				className,
			)}
		>
			<div className="flex items-start justify-between">
				<div>
					<Skeleton className="h-7 w-48" />
					<Skeleton className="mt-2 h-5 w-64" />
				</div>
				<Skeleton className="size-11 rounded-[8px]" />
			</div>
			<Skeleton className="mt-8 h-[280px] w-full rounded-xl" />
		</div>
	);
}

function FleetPerformanceChartContent({
	period,
	startDate,
	endDate,
	className,
}: FleetPerformanceChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const { data: fleetStats } = useSuspenseQuery<FleetStatsItem[]>({
		...orpc.analyst.analytics.fleetStats.queryOptions({
			input: { period, startDate, endDate },
		}),
	});

	const minChartWidth = Math.max(chartDataMinWidth(fleetStats.length), 460);

	const chartData = fleetStats.map((vehicle) => ({
		vehicleName: vehicle.vehicleName,
		profit: Math.max(vehicle.profit, 0),
		debit: vehicle.debit,
		originalDebit: vehicle.debit,
		originalProfit: vehicle.profit,
	}));

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
				"rounded-[20px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.08)]",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-[20px] font-semibold leading-tight text-[#1f2939] sm:text-[22px]">
						Fleet Performance
					</h2>
					<p className="mt-1 text-[14px] text-[#666] sm:text-[15px]">
						Profit vs Expenses trends over time
					</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="outline"
								size="icon"
								aria-label="Export Fleet Performance chart"
								className="size-10 rounded-[10px] border-[#e5e7eb] bg-white shadow-[0px_2px_4px_rgba(0,0,0,0.08)] hover:bg-neutral-50"
							>
								<DownloadIcon className="size-4 text-[#1f2939]" />
							</Button>
						}
					/>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => void exportWith(downloadPng.execute)}>
							Download as PNG
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void exportWith(downloadJpeg.execute)}>
							Download as JPEG
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void exportWith(downloadSvg.execute)}>
							Download as SVG
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="mt-5 overflow-x-auto" ref={chartContainerRef}>
				<div style={{ minWidth: `${minChartWidth}px` }}>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[250px] w-full"
					>
						<BarChart accessibilityLayer data={chartData} barGap={6}>
							<CartesianGrid
								vertical={false}
								stroke="rgba(209, 213, 209, 0.6)"
							/>
							<XAxis
								dataKey="vehicleName"
								tickLine={false}
								tickMargin={12}
								axisLine={false}
								tick={{ fill: "#111827", fontSize: 14 }}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								width={78}
								tick={{ fill: "#5e605e", fontSize: 12 }}
								tickFormatter={(value) => formatINR(value)}
							/>
							<ChartTooltip
								cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
								content={
									<ChartTooltipContent
										hideLabel
										className="w-52"
										formatter={(_value, name, item) => {
											const payload =
												typeof item === "object" &&
												item !== null &&
												"payload" in item
													? (
															item as {
																payload?: {
																	originalDebit?: number;
																	originalProfit?: number;
																};
															}
														).payload
													: undefined;

											return (
												<>
													<div
														className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
														style={{
															backgroundColor:
																name === "debit" ? "#18325e" : "#cce0f8",
														}}
													/>
													{chartConfig[name as keyof typeof chartConfig]?.label ||
														name}
													<div className="text-foreground ml-auto font-mono font-medium tabular-nums">
														{name === "debit" &&
															formatINR(payload?.originalDebit ?? 0)}
														{name === "profit" &&
															formatINR(payload?.originalProfit ?? 0)}
													</div>
												</>
											);
										}}
									/>
								}
							/>
							<Bar
								dataKey="profit"
								fill="#cce0f8"
								radius={[6, 6, 0, 0]}
								maxBarSize={52}
							/>
							<Bar
								dataKey="debit"
								fill="#18325e"
								radius={[6, 6, 0, 0]}
								maxBarSize={52}
							/>
						</BarChart>
					</ChartContainer>
				</div>
			</div>

			{/* Custom Legend matching Figma */}
			<div className="mt-5 flex items-center justify-center gap-10 text-[15px] text-black">
				<div className="flex items-center gap-2.5">
					<span className="size-4 rounded-[2px] bg-[#18325e]" />
					<span>Expenses</span>
				</div>
				<div className="flex items-center gap-2.5">
					<span className="size-4 rounded-[2px] bg-[#cce0f8]" />
					<span>Profit</span>
				</div>
			</div>
		</section>
	);
}

export function FleetPerformanceChart(props: FleetPerformanceChartProps) {
	return (
		<Suspense fallback={<FleetPerformanceChartSkeleton className={props.className} />}>
			<FleetPerformanceChartContent {...props} />
		</Suspense>
	);
}
