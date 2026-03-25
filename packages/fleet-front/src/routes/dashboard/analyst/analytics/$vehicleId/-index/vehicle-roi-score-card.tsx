import { useSuspenseQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { Suspense, useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";

type Period = "last_30d" | "last_3m" | "last_6m" | "last_9m" | "last_12m";

interface VehicleRoiScoreCardProps extends ComponentProps<typeof Card> {
	vehicleId: string;
	period: Period;
}

const COLORS = {
	revenue: "#22c55e",
	expense: "#ef4444",
};

function VehicleRoiScoreCardSkeleton({
	className,
	...props
}: ComponentProps<typeof Card>) {
	return (
		<Card className={cn("flex flex-col", className)} {...props}>
			<CardHeader className="border-b">
				<Skeleton className="h-6 w-28" />
				<Skeleton className="h-4 w-60 mt-1" />
			</CardHeader>
			<CardContent className="flex flex-1 items-center justify-center">
				<Skeleton className="size-56 rounded-full" />
			</CardContent>
		</Card>
	);
}

function VehicleRoiScoreCardContent({
	vehicleId,
	period,
	className,
	...props
}: VehicleRoiScoreCardProps) {
	const { data } = useSuspenseQuery({
		...orpc.analyst.analytics.vehicle.roiStats.queryOptions({
			input: { vehicleId, period },
		}),
	});

	const chartData = useMemo(
		() => [
			{ name: "Revenue", value: data.revenuePercentage, fill: COLORS.revenue },
			{ name: "Vehicle impact expense", value: data.expensePercentage, fill: COLORS.expense },
		],
		[data],
	);

	const roundedRoi = Number(data.roiPercentage.toFixed(1));

	return (
		<Card className={cn("flex flex-col", className)} {...props}>
			<CardHeader className="border-b">
				<CardTitle>ROI Score</CardTitle>
				<CardDescription>
					Revenue vs vehicle impact expense contribution
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
				<div className="relative mx-auto aspect-square w-full max-w-56">
					<ChartContainer
						id="vehicle-roi-score"
						config={{}}
						className="size-full"
					>
						<PieChart>
							<Pie
								data={chartData}
								dataKey="value"
								nameKey="name"
								innerRadius={78}
								outerRadius={96}
								startAngle={90}
								endAngle={-270}
								stroke="none"
							>
								{chartData.map((entry) => (
									<Cell key={entry.name} fill={entry.fill} />
								))}
							</Pie>
						</PieChart>
					</ChartContainer>
					<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
						<div className="text-4xl font-semibold text-[#072d54]">{roundedRoi}%</div>
						<div className="text-xs text-muted-foreground">ROI</div>
					</div>
				</div>
				<div className="w-full max-w-80 space-y-2 text-sm">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
							Revenue
						</div>
						<span>{formatINR(data.revenue)}</span>
					</div>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
							Vehicle impact expense
						</div>
						<span>{formatINR(data.vehicleImpactExpense)}</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function VehicleRoiScoreCard({
	vehicleId,
	period,
	className,
	...props
}: VehicleRoiScoreCardProps) {
	return (
		<Suspense fallback={<VehicleRoiScoreCardSkeleton className={className} {...props} />}>
			<VehicleRoiScoreCardContent
				vehicleId={vehicleId}
				period={period}
				className={className}
				{...props}
			/>
		</Suspense>
	);
}
