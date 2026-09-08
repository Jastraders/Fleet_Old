import { useSuspenseQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { Suspense, useMemo } from "react";
import { Pie, PieChart } from "recharts";
import {
	Card,
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";

type Period =
	| "all_time"
	| "last_30d"
	| "last_3m"
	| "last_6m"
	| "last_9m"
	| "last_12m";

interface VehicleExpenseCategoriesStatsCardProps
	extends ComponentProps<typeof Card> {
	vehicleId: string;
	period: Period;
}

type VehicleExpenseCategoryStatsItem = {
	id: string;
	name: string;
	color: string;
	amount: number;
};

function VehicleExpensesCategoryChartSkeleton({
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

function VehicleExpensesCategoryChartContent({
	vehicleId,
	period,
	className,
	...props
}: VehicleExpenseCategoriesStatsCardProps) {
	const id = "vehicle-expense-category-pie";

	const { data } = useSuspenseQuery({
		...orpc.analyst.analytics.vehicle.expensesStats.queryOptions({
			input: { vehicleId, period },
		}),
	});
	const expenseStats = data as VehicleExpenseCategoryStatsItem[];

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

	if (chartData.length === 0) {
		return (
			<Card className={cn("flex flex-col", className)} {...props}>
				<CardHeader className="border-b">
					<CardTitle>Expenses by Category</CardTitle>
					<CardDescription>No expense data for this period</CardDescription>
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
			</CardHeader>
			<CardContent className="flex flex-1 flex-col items-center justify-between p-4 gap-3">
				<div className="relative mx-auto aspect-square w-full max-w-52 flex items-center justify-center min-h-[180px]">
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

export function VehicleExpenseCategoriesStatsCard({
	vehicleId,
	period,
	className,
	...props
}: VehicleExpenseCategoriesStatsCardProps) {
	return (
		<Suspense
			fallback={
				<VehicleExpensesCategoryChartSkeleton
					className={className}
					{...props}
				/>
			}
		>
			<VehicleExpensesCategoryChartContent
				vehicleId={vehicleId}
				period={period}
				className={className}
				{...props}
			/>
		</Suspense>
	);
}
