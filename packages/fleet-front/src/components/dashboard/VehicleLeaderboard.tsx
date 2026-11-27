import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/orpc";
import type { DashboardPeriod, FleetStatsItem } from "./types";

interface VehicleLeaderboardProps {
	period: DashboardPeriod;
	startDate?: string;
	endDate?: string;
	className?: string;
}

const THUMBNAILS = [
	"/images/dashboard/truck-thumb-1.png",
	"/images/dashboard/truck-thumb-2.png",
	"/images/dashboard/truck-thumb-3.png",
	"/images/dashboard/truck-thumb-4.png",
];

function VehicleLeaderboardSkeleton({ className }: { className?: string }) {
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
					<Skeleton className="mt-2 h-5 w-60" />
				</div>
				<Skeleton className="h-5 w-14" />
			</div>
			<div className="mt-6 space-y-4">
				{Array.from({ length: 4 }).map((_, idx) => (
					<Skeleton
						key={`lb-skel-${idx}`}
						className="h-[88px] w-full rounded-[10px]"
					/>
				))}
			</div>
		</div>
	);
}

function VehicleLeaderboardContent({
	period,
	startDate,
	endDate,
	className,
}: VehicleLeaderboardProps) {
	const { data: fleetStats } = useSuspenseQuery<FleetStatsItem[]>({
		...orpc.analyst.analytics.fleetStats.queryOptions({
			input: { period, startDate, endDate },
		}),
	});

	const items = useMemo(
		() =>
			fleetStats
				.map((vehicle) => {
					const profitPct =
						vehicle.credit > 0
							? (vehicle.profit / vehicle.credit) * 100
							: vehicle.credit === 0 && vehicle.debit === 0
								? 0
								: -100;
					return {
						...vehicle,
						profitPct,
					};
				})
				.sort((a, b) => b.profitPct - a.profitPct)
				.slice(0, 5),
		[fleetStats],
	);

	return (
		<section
			className={cn(
				"flex h-full flex-col rounded-[20px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.08)]",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-[20px] font-semibold leading-tight text-black sm:text-[22px]">
						Vehicle Leaderboard
					</h2>
					<p className="mt-1 text-[14px] text-[#666] sm:text-[15px]">
						Top performing vehicles by profit %
					</p>
				</div>
				<Link
					to="/dashboard/accountant/vehicles"
					className="text-[14px] font-medium text-black underline underline-offset-4 hover:text-[#18325e]"
				>
					see all
				</Link>
			</div>

			<div className="mt-5 flex-1 space-y-3.5">
				{items.length === 0 ? (
					<div className="rounded-[10px] bg-[#f8fafc] p-6 text-center text-sm text-[#666]">
						No vehicle performance data for this period.
					</div>
				) : (
					items.map((vehicle, index) => {
						const clampedPct = Math.max(0, Math.min(100, vehicle.profitPct));
						return (
							<Link
								key={vehicle.vehicleId}
								to="/dashboard/analyst/analytics/$vehicleId"
								params={{ vehicleId: vehicle.vehicleId }}
								className="flex items-center gap-4 rounded-[10px] bg-white p-4 shadow-[0px_2px_4px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5"
							>
								<img
									src={THUMBNAILS[index % THUMBNAILS.length]}
									alt={vehicle.vehicleName}
									className="size-[57px] shrink-0 rounded-[5px] object-cover shadow-[1px_2px_5px_0px_rgba(0,0,0,0.05)]"
								/>
								<div className="min-w-0 flex-1">
									<p className="truncate text-[18px] font-medium text-black">
										{vehicle.vehicleName}
									</p>
									<div className="mt-2.5 h-3.5 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
										<div
											className="h-full rounded-full bg-[#0b1d3c] transition-all duration-500"
											style={{ width: `${Math.max(clampedPct, 4)}%` }}
										/>
									</div>
								</div>
								<span className="shrink-0 text-[18px] font-semibold text-[#0b1d3c] tabular-nums">
									{vehicle.profitPct.toFixed(0)}%
								</span>
							</Link>
						);
					})
				)}
			</div>
		</section>
	);
}

export function VehicleLeaderboard(props: VehicleLeaderboardProps) {
	return (
		<Suspense fallback={<VehicleLeaderboardSkeleton className={props.className} />}>
			<VehicleLeaderboardContent {...props} />
		</Suspense>
	);
}
