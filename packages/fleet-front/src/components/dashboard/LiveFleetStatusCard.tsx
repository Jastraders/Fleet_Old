import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/orpc";
import type { DashboardPeriod, FleetStatsItem } from "./types";

interface LiveFleetStatusCardProps {
	period: DashboardPeriod;
	startDate?: string;
	endDate?: string;
}

function LiveFleetStatusSkeleton() {
	return (
		<div className="rounded-[15px] bg-white p-6 shadow-[0px_2px_4px_rgba(0,0,0,0.12)]">
			<div className="flex items-start justify-between">
				<div>
					<Skeleton className="h-7 w-44" />
					<Skeleton className="mt-2 h-4 w-48" />
				</div>
				<Skeleton className="h-5 w-14" />
			</div>
			<div className="mt-8 space-y-6">
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
			</div>
		</div>
	);
}

function LiveFleetStatusContent({
	period,
	startDate,
	endDate,
}: LiveFleetStatusCardProps) {
	const { data: fleetStats } = useSuspenseQuery<FleetStatsItem[]>({
		...orpc.analyst.analytics.fleetStats.queryOptions({
			input: { period, startDate, endDate },
		}),
	});

	const total = Math.max(fleetStats.length, 1);
	const onRoadCount = fleetStats.filter((v) => v.credit > 0).length;
	const availableCount = fleetStats.filter(
		(v) => v.credit === 0 && v.debit === 0,
	).length;
	const maintenanceCount = fleetStats.filter(
		(v) => v.credit === 0 && v.debit > 0,
	).length;

	const rows = [
		{
			label: "On Road",
			count: onRoadCount,
			textColor: "text-[#1fb362]",
			barColor: "bg-[#1fb362]",
			pct: Math.round((onRoadCount / total) * 100),
		},
		{
			label: "Available",
			count: availableCount,
			textColor: "text-[#799edd]",
			barColor: "bg-[#799edd]",
			pct: Math.round((availableCount / total) * 100),
		},
		{
			label: "Maintenance",
			count: maintenanceCount,
			textColor: "text-[#9b741c]",
			barColor: "bg-[#9b741c]",
			pct: Math.round((maintenanceCount / total) * 100),
		},
	];

	return (
		<div className="rounded-[20px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.08)]">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="text-[20px] font-semibold leading-tight text-black">
						Live Fleet Status
					</h3>
					<p className="mt-1 text-[14px] text-[#666]">
						Real-time vehicle updates
					</p>
				</div>
				<Link
					to="/dashboard/accountant/vehicles"
					className="text-[14px] font-medium text-black underline underline-offset-4 hover:text-[#18325e]"
				>
					see all
				</Link>
			</div>

			<div className="mt-6 space-y-5">
				{rows.map((row) => (
					<div key={row.label} className="space-y-2">
						<div className="flex items-center justify-between text-[15px] font-medium">
							<span className={row.textColor}>{row.label}</span>
							<span className={row.textColor}>{row.count}</span>
						</div>
						<div className="h-[11px] w-full overflow-hidden rounded-full bg-[#e9ecef]">
							<div
								className={`h-full rounded-full transition-all duration-500 ${row.barColor}`}
								style={{
									width: `${row.count > 0 ? Math.max(row.pct, 6) : 0}%`,
								}}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export function LiveFleetStatusCard(props: LiveFleetStatusCardProps) {
	return (
		<Suspense fallback={<LiveFleetStatusSkeleton />}>
			<LiveFleetStatusContent {...props} />
		</Suspense>
	);
}
