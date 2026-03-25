import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, type LinkOptions, linkOptions } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { Suspense, useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/orpc";

type Period = "all_time" | "last_7d" | "last_30d" | "last_6m" | "last_12m";

interface VehicleLeaderboardCardProps extends ComponentProps<typeof Card> {
	period: Period;
}

interface BarListItem {
	key: string;
	name: string;
	value: number;
	color: string;
	link: LinkOptions;
}

interface FleetStatsItem {
	vehicleId: string;
	vehicleName: string;
	vehicleColor: string;
	credit: number;
	debit: number;
	profit: number;
}

interface BarListProps extends React.HTMLAttributes<HTMLDivElement> {
	data: BarListItem[];
	valueFormatter?: (value: number) => string;
	showAnimation?: boolean;
	sortOrder?: "ascending" | "descending" | "none";
}

function BarList({
	data = [],
	valueFormatter = (value) => value.toString(),
	showAnimation = false,
	sortOrder = "descending",
	className,
	...props
}: BarListProps) {
	const sortedData = useMemo(() => {
		if (sortOrder === "none") {
			return data;
		}
		return [...data].sort((a, b) => {
			return sortOrder === "ascending" ? a.value - b.value : b.value - a.value;
		});
	}, [data, sortOrder]);

	const widths = useMemo(() => {
		const maxValue = Math.max(...sortedData.map((item) => item.value), 0);
		return sortedData.map((item) =>
			item.value === 0 ? 0 : Math.max((item.value / maxValue) * 100, 2),
		);
	}, [sortedData]);

	const rowHeight = "h-8";

	return (
		<div className={cn("flex justify-between space-x-6", className)} {...props}>
			<div className="relative w-full space-y-1.5">
				{sortedData.map((item, index) => (
					<div key={item.key} className="group w-full rounded-sm">
						<Link
							className={cn(
								"flex items-center rounded-sm transition-all",
								rowHeight,
								{
									"mb-0": index === sortedData.length - 1,
									"duration-800": showAnimation,
								},
							)}
							style={{
								width: `${widths[index]}%`,
								backgroundColor: item.color,
								opacity: 0.8,
							}}
							{...item.link}
						>
							<div className={cn("absolute left-2 flex max-w-full pr-2")}>
								<p className={cn("truncate whitespace-nowrap text-sm")}>
									{item.name}
								</p>
							</div>
						</Link>
					</div>
				))}
			</div>
			<div>
				{sortedData.map((item, index) => (
					<div
						key={item.key}
						className={cn(
							"flex items-center justify-end",
							rowHeight,
							index === sortedData.length - 1 ? "mb-0" : "mb-1.5",
						)}
					>
						<p
							className={cn(
								"truncate whitespace-nowrap text-sm leading-none",
								"text-gray-900 dark:text-gray-50",
							)}
						>
							{valueFormatter(item.value)}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}

function VehicleLeaderboardCardSkeleton({
	className,
	...props
}: ComponentProps<typeof Card>) {
	return (
		<Card className={cn(className)} {...props}>
			<CardHeader className="border-b">
				<Skeleton className="h-6 w-40" />
				<Skeleton className="h-4 w-48 mt-1" />
			</CardHeader>
			<CardContent>
				<Skeleton className="h-[250px] w-full" />
			</CardContent>
		</Card>
	);
}

function VehicleLeaderboardCardContent({
	period,
	className,
	...props
}: VehicleLeaderboardCardProps) {
	const { data } = useSuspenseQuery<FleetStatsItem[]>({
		...orpc.analyst.analytics.fleetStats.queryOptions({
			input: { period },
		}),
	});

	// Calculate profit percentage and transform to BarList format
	const leaderboardData: BarListItem[] = data
		.map((vehicle) => ({
			key: vehicle.vehicleName,
			name: vehicle.vehicleName,
			color: `#${vehicle.vehicleColor}`,
			value:
				vehicle.credit > 0
					? (vehicle.profit / vehicle.credit) * 100
					: vehicle.credit === 0 && vehicle.debit === 0
						? 0
						: -100,
			link: linkOptions({
				to: "/dashboard/analyst/analytics/$vehicleId",
				params: {
					vehicleId: vehicle.vehicleId,
				},
			}),
		}))
		.sort((a, b) => b.value - a.value);

	return (
		<Card className={cn(className)} {...props}>
			<CardHeader className="border-b">
				<CardTitle>Vehicle Leaderboard</CardTitle>
				<CardDescription>Top performing vehicles by profit %</CardDescription>
			</CardHeader>
			<CardContent>
				<BarList
					data={leaderboardData}
					sortOrder="none"
					valueFormatter={(value) => `${value.toFixed(1)}%`}
				/>
			</CardContent>
		</Card>
	);
}

export function VehicleLeaderboardCard({
	period,
	className,
	...props
}: VehicleLeaderboardCardProps) {
	return (
		<Suspense
			fallback={
				<VehicleLeaderboardCardSkeleton className={className} {...props} />
			}
		>
			<VehicleLeaderboardCardContent
				period={period}
				className={className}
				{...props}
			/>
		</Suspense>
	);
}
