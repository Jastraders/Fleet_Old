import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";
import type { DashboardPeriod, FleetStatsItem } from "./types";

interface RecentVehicleActivityCardProps {
	period: DashboardPeriod;
	startDate?: string;
	endDate?: string;
}

function RecentVehicleActivitySkeleton() {
	return (
		<div className="rounded-[15px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)]">
			<div className="flex items-start justify-between">
				<div>
					<Skeleton className="h-7 w-52" />
					<Skeleton className="mt-2 h-4 w-56" />
				</div>
				<Skeleton className="h-5 w-14" />
			</div>
			<div className="mt-6 space-y-3.5">
				{Array.from({ length: 4 }).map((_, idx) => (
					<Skeleton key={`activity-skel-${idx}`} className="h-[72px] w-full rounded-[10px]" />
				))}
			</div>
		</div>
	);
}

function RecentVehicleActivityContent({
	period,
	startDate,
	endDate,
}: RecentVehicleActivityCardProps) {
	const { data: fleetStats } = useSuspenseQuery<FleetStatsItem[]>({
		...orpc.analyst.analytics.fleetStats.queryOptions({
			input: { period, startDate, endDate },
		}),
	});

	const items = fleetStats.slice(0, 4);

	return (
		<div className="flex flex-1 flex-col rounded-[20px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.08)]">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="text-[20px] font-semibold leading-tight text-black">
						Recent Vehicle Activity
					</h3>
					<p className="mt-1 text-[14px] text-[#666]">
						Latest updates on vehicle movements
					</p>
				</div>
				<Link
					to="/dashboard/accountant/vehicles"
					className="text-[14px] font-medium text-black underline underline-offset-4 hover:text-[#18325e]"
				>
					see all
				</Link>
			</div>

			<div className="mt-5 flex-1 space-y-3">
				{items.length === 0 ? (
					<div className="rounded-[10px] bg-[#f8fafc] p-5 text-center text-sm text-[#666]">
						No vehicle activity recorded for this period.
					</div>
				) : (
					items.map((vehicle) => {
						const isOnRoute = vehicle.credit > 0;
						return (
							<Link
								key={vehicle.vehicleId}
								to="/dashboard/analyst/analytics/$vehicleId"
								params={{ vehicleId: vehicle.vehicleId }}
								className={cn(
									"flex items-center justify-between gap-4 rounded-[12px] px-4 py-3.5 shadow-[0px_1px_4px_rgba(0,0,0,0.06)] transition-transform hover:-translate-y-0.5",
									isOnRoute ? "bg-[rgba(31,179,98,0.1)]" : "bg-[#fae6dc]",
								)}
							>
								<div className="min-w-0">
									<p className="truncate text-[16px] font-semibold text-black">
										{vehicle.vehicleName}
									</p>
									<p className="mt-0.5 truncate text-[13px] font-medium text-[#545454]">
										Net: {formatINR(vehicle.profit)}
									</p>
								</div>
								<span
									className={cn(
										"shrink-0 rounded-[20px] px-3.5 py-1 text-[13px] font-medium",
										isOnRoute
											? "bg-[rgba(31,179,98,0.2)] text-[#1fb362]"
											: "bg-[rgba(219,105,48,0.2)] text-[#b3691f]",
									)}
								>
									{isOnRoute ? "On Route" : "Idle"}
								</span>
							</Link>
						);
					})
				)}
			</div>
		</div>
	);
}

export function RecentVehicleActivityCard(
	props: RecentVehicleActivityCardProps,
) {
	return (
		<Suspense fallback={<RecentVehicleActivitySkeleton />}>
			<RecentVehicleActivityContent {...props} />
		</Suspense>
	);
}
