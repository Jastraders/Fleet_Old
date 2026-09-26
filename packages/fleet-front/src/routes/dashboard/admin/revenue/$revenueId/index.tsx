import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CalendarIcon,
	CoinsIcon,
	ExternalLinkIcon,
	PackageIcon,
	TruckIcon,
	UserIcon,
	MapPinIcon,
	BuildingIcon,
	FileTextIcon,
	InfoIcon,
} from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";

interface RevenueDetailData {
	id: string;
	journalEntryId: string;
	voucherId: number | null;
	vehicleId: string | null;
	vehicleName: string | null;
	vehicleLicensePlate: string | null;
	driverId: string | null;
	driverName: string | null;
	revenueDate: string | null;
	amount: number;
	productName: string | null;
	depo: string | null;
	deliveryLocation: string | null;
	revenueMode: string | null;
	quantity: number | null;
	perItemRate: number | null;
	value: number | null;
	createdBy: string | null;
	createdByName: string | null;
	createdAt: string | null;
}

export const Route = createFileRoute("/dashboard/admin/revenue/$revenueId/")({
	loader: ({ context: { orpc: orpcClient, queryClient }, params: { revenueId } }) => {
		queryClient.prefetchQuery(
			(orpcClient as any).admin.revenue.get.queryOptions({
				input: { id: revenueId },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Suspense fallback={<RevenueDetailSkeleton />}>
			<RevenueDetail />
		</Suspense>
	);
}

function RevenueDetailSkeleton() {
	return (
		<div className="space-y-6 animate-pulse p-6">
			<div className="h-8 w-32 bg-muted/40 rounded" />
			<div className="h-48 bg-muted/20 rounded-lg" />
			<div className="grid gap-4 md:grid-cols-2">
				<div className="h-40 bg-muted/20 rounded-lg" />
				<div className="h-40 bg-muted/20 rounded-lg" />
			</div>
		</div>
	);
}

function RevenueDetail() {
	const { revenueId } = Route.useParams();
	const navigate = useNavigate();

	const { data: revenue } = useSuspenseQuery<RevenueDetailData>({
		...((orpc as any).admin.revenue.get.queryOptions({
			input: { id: revenueId },
		}) as any),
	});

	return (
		<div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
			{/* Top bar navigation */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						size="icon"
						onClick={() => navigate({ to: "/dashboard/admin/revenue" })}
						className="h-9 w-9"
					>
						<ArrowLeftIcon className="h-4 w-4" />
					</Button>
					<div>
						<h1 className="text-2xl font-bold tracking-tight">Revenue Record</h1>
						<p className="text-xs text-muted-foreground">
							{revenue.voucherId ? `Voucher #${revenue.voucherId}` : `ID: ${revenue.id.slice(0, 8)}...`}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" asChild className="gap-1.5">
						<Link
							to="/dashboard/accountant/journal-entries"
							search={{ search: revenue.voucherId ? String(revenue.voucherId) : revenue.journalEntryId }}
						>
							<ExternalLinkIcon className="h-4 w-4" />
							View Original Journal Entry
						</Link>
					</Button>
				</div>
			</div>

			{/* Read-only Information Banner */}
			<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
				<InfoIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
				<div className="text-xs leading-relaxed">
					<span className="font-semibold">Derived from Journal Entry:</span> Revenue entries are strictly synchronized read-only representations of Journal credit items. To edit or adjust this revenue record, please modify the corresponding Journal entry.
				</div>
			</div>

			{/* Main Amount Card */}
			<Card className="border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/10 dark:to-background">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
						Total Revenue Amount
					</CardDescription>
					<CardTitle className="text-3xl sm:text-4xl font-extrabold text-emerald-700 dark:text-emerald-400">
						{formatINR(revenue.amount)}
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2">
					<div className="flex items-center gap-1.5">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<span>Date: {revenue.revenueDate ? new Date(revenue.revenueDate).toLocaleDateString() : "—"}</span>
					</div>
					{revenue.voucherId && (
						<div className="flex items-center gap-1.5">
							<FileTextIcon className="h-4 w-4 text-muted-foreground" />
							<span>Voucher: #{revenue.voucherId}</span>
						</div>
					)}
					<div className="flex items-center gap-1.5">
						<UserIcon className="h-4 w-4 text-muted-foreground" />
						<span>Created By: {revenue.createdByName || "System"}</span>
					</div>
				</CardContent>
			</Card>

			{/* Detailed Grid */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Vehicle & Driver Details */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base font-semibold flex items-center gap-2">
							<TruckIcon className="h-4 w-4 text-primary" />
							Assignment Details
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						<div className="flex justify-between items-start border-b pb-3">
							<span className="text-muted-foreground text-xs font-medium">Vehicle</span>
							<div className="text-right">
								<div className="font-semibold">{revenue.vehicleName || "—"}</div>
								{revenue.vehicleLicensePlate && (
									<div className="text-xs text-muted-foreground">{revenue.vehicleLicensePlate}</div>
								)}
							</div>
						</div>

						<div className="flex justify-between items-center border-b pb-3">
							<span className="text-muted-foreground text-xs font-medium">Driver</span>
							<span className="font-semibold">{revenue.driverName || "—"}</span>
						</div>

						<div className="flex justify-between items-center">
							<span className="text-muted-foreground text-xs font-medium">Journal Entry ID</span>
							<span className="font-mono text-xs text-muted-foreground">{revenue.journalEntryId}</span>
						</div>
					</CardContent>
				</Card>

				{/* Product & Logistics Details */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base font-semibold flex items-center gap-2">
							<PackageIcon className="h-4 w-4 text-primary" />
							Product & Logistics
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						<div className="flex justify-between items-center border-b pb-3">
							<span className="text-muted-foreground text-xs font-medium flex items-center gap-1.5">
								<PackageIcon className="h-3.5 w-3.5 text-muted-foreground" />
								Product Name
							</span>
							<span className="font-semibold">{revenue.productName || "—"}</span>
						</div>

						<div className="flex justify-between items-center border-b pb-3">
							<span className="text-muted-foreground text-xs font-medium flex items-center gap-1.5">
								<BuildingIcon className="h-3.5 w-3.5 text-muted-foreground" />
								Depo
							</span>
							<span className="font-medium">{revenue.depo || "—"}</span>
						</div>

						<div className="flex justify-between items-center border-b pb-3">
							<span className="text-muted-foreground text-xs font-medium flex items-center gap-1.5">
								<MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" />
								Delivery Location
							</span>
							<span className="font-medium">{revenue.deliveryLocation || "—"}</span>
						</div>

						{revenue.revenueMode && (
							<div className="flex justify-between items-center">
								<span className="text-muted-foreground text-xs font-medium">Revenue Mode</span>
								<span className="font-medium capitalize">{revenue.revenueMode}</span>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Breakdown Details if available */}
				{(revenue.quantity !== null || revenue.perItemRate !== null || revenue.value !== null) && (
					<Card className="md:col-span-2">
						<CardHeader className="pb-3">
							<CardTitle className="text-base font-semibold flex items-center gap-2">
								<CoinsIcon className="h-4 w-4 text-primary" />
								Quantity & Rate Breakdown
							</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
							<div className="rounded-lg border p-3 bg-muted/20">
								<div className="text-xs text-muted-foreground font-medium">Quantity</div>
								<div className="text-lg font-bold mt-1">{revenue.quantity ?? "—"}</div>
							</div>
							<div className="rounded-lg border p-3 bg-muted/20">
								<div className="text-xs text-muted-foreground font-medium">Per Item Rate</div>
								<div className="text-lg font-bold mt-1">
									{revenue.perItemRate ? formatINR(revenue.perItemRate) : "—"}
								</div>
							</div>
							<div className="rounded-lg border p-3 bg-muted/20">
								<div className="text-xs text-muted-foreground font-medium">Calculated Value</div>
								<div className="text-lg font-bold mt-1">
									{revenue.value ? formatINR(revenue.value) : "—"}
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
