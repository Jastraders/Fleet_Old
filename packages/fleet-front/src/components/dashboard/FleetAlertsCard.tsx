import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	ClockIcon,
	FileWarningIcon,
	LocateOffIcon,
	MapPinIcon,
} from "lucide-react";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/orpc";

interface FleetAlertsCardProps {
	className?: string;
}

interface AlertItem {
	id: string;
	title: string;
	description: string;
	variant: "danger" | "info";
	icon: typeof AlertTriangleIcon;
}

const DEFAULT_ALERTS: AlertItem[] = [
	{
		id: "default-1",
		title: "Maintenance Due",
		description: "TRK-104. Services due in 2 days",
		variant: "danger",
		icon: AlertTriangleIcon,
	},
	{
		id: "default-2",
		title: "Route Deviation",
		description: "TRK-218. Outside planned route",
		variant: "info",
		icon: MapPinIcon,
	},
	{
		id: "default-3",
		title: "Document Expiring",
		description: "TRK-112. Registration expiry",
		variant: "info",
		icon: FileWarningIcon,
	},
	{
		id: "default-4",
		title: "Delivery delayed",
		description: "TRK-105. 3km away from assigned route",
		variant: "info",
		icon: ClockIcon,
	},
	{
		id: "default-5",
		title: "GPS Offline",
		description: "TRK-115. signal disconnected",
		variant: "info",
		icon: LocateOffIcon,
	},
];

function FleetAlertsSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"rounded-[20px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)] sm:p-8",
				className,
			)}
		>
			<div className="flex items-start justify-between">
				<div>
					<Skeleton className="h-7 w-36" />
					<Skeleton className="mt-2 h-5 w-52" />
				</div>
				<Skeleton className="h-5 w-14" />
			</div>
			<div className="mt-6 space-y-3.5">
				{Array.from({ length: 5 }).map((_, idx) => (
					<Skeleton
						key={`alert-skel-${idx}`}
						className="h-[78px] w-full rounded-[10px]"
					/>
				))}
			</div>
		</div>
	);
}

function FleetAlertsContent({ className }: FleetAlertsCardProps) {
	const { data: unreadNotifications } = useSuspenseQuery(
		orpc.general.notifications.list.queryOptions({
			input: { filter: "unread" },
		}),
	);

	const notificationAlerts: AlertItem[] = Array.isArray(unreadNotifications)
		? unreadNotifications.slice(0, 5).map((item: any, idx: number) => {
				const meta = (() => {
					try {
						return item.metadata ? JSON.parse(item.metadata) : {};
					} catch {
						return {};
					}
				})();
				const daysRemaining = Number(meta.daysRemaining ?? 99);
				return {
					id: String(item.id ?? idx),
					title: `${meta.renewalType ?? "Renewal"} Due`,
					description: `${meta.vehicleName ?? "Vehicle"} due in ${meta.daysRemaining ?? "-"} day(s)`,
					variant: daysRemaining <= 7 ? "danger" : "info",
					icon: daysRemaining <= 7 ? AlertTriangleIcon : FileWarningIcon,
				};
			})
		: [];

	const alerts =
		notificationAlerts.length > 0 ? notificationAlerts : DEFAULT_ALERTS;

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
						Fleet Alerts
					</h2>
					<p className="mt-1 text-[14px] text-[#666] sm:text-[15px]">
						Important fleet updates and warnings
					</p>
				</div>
				<Link
					to="/dashboard/general/notifications"
					className="text-[14px] font-medium text-black underline underline-offset-4 hover:text-[#18325e]"
				>
					see all
				</Link>
			</div>

			<div className="mt-5 flex-1 space-y-3">
				{alerts.map((alert) => {
					const Icon = alert.icon;
					const isDanger = alert.variant === "danger";
					return (
						<Link
							key={alert.id}
							to="/dashboard/general/notifications"
							className={cn(
								"flex items-center gap-3.5 rounded-[10px] px-5 py-3.5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)] transition-transform hover:-translate-y-0.5",
								isDanger
									? "bg-[rgba(172,83,64,0.1)]"
									: "bg-[rgba(204,224,248,0.3)]",
							)}
						>
							<Icon
								className={cn(
									"size-6 shrink-0",
									isDanger ? "text-[#ac5340]" : "text-[#18325e]",
								)}
							/>
							<div className="min-w-0">
								<p
									className={cn(
										"truncate text-[17px] font-semibold",
										isDanger ? "text-[#ac5340]" : "text-black",
									)}
								>
									{alert.title}
								</p>
								<p className="truncate text-[14px] text-[#666]">
									{alert.description}
								</p>
							</div>
						</Link>
					);
				})}
			</div>
		</section>
	);
}

export function FleetAlertsCard(props: FleetAlertsCardProps) {
	return (
		<Suspense fallback={<FleetAlertsSkeleton className={props.className} />}>
			<FleetAlertsContent {...props} />
		</Suspense>
	);
}
