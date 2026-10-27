import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CalendarIcon,
	EditIcon,
	PackageIcon,
	PhoneIcon,
	ReceiptTextIcon,
	TruckIcon,
	UserIcon,
} from "lucide-react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { parseDateValue } from "@/lib/date";
import { formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";
import {
	AccessDeniedDialog,
	useIsAdmin,
} from "@/routes/dashboard/accountant/-shared/admin-helpers";

interface BataDetailData {
	id: string;
	journal_entry_id: string;
	driver_id: string;
	vehicle_id: string;
	product_name: string | null;
	bata_amount: number;
	status: "paid" | "unpaid";
	paid_by: string | null;
	paid_at: string | null;
	journal_notes: string | null;
	transaction_date?: string;
	gross_revenue?: number;
	quantity?: number;
	per_item_rate?: number;
	revenue_mode?: string;
	vehicle_name?: string;
	vehicle_license_plate?: string;
	driver_name?: string;
	driver_phone_number?: string;
	created_by_name?: string;
	paid_by_name?: string;
}

export const Route = createFileRoute("/dashboard/accountant/bata/$bataId/")({
	loader: ({ context: { orpc, queryClient }, params: { bataId } }) => {
		queryClient.prefetchQuery(
			(orpc as any).accountant.bata.get.queryOptions({
				input: { id: bataId },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Suspense fallback={<BataDetailSkeleton />}>
			<BataDetail />
		</Suspense>
	);
}

function BataDetailSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			<div className="h-8 w-32 bg-muted/40 rounded" />
			<div className="h-48 bg-muted/20 rounded-lg" />
			<div className="grid gap-4 md:grid-cols-2">
				<div className="h-40 bg-muted/20 rounded-lg" />
				<div className="h-40 bg-muted/20 rounded-lg" />
			</div>
		</div>
	);
}

function BataDetail() {
	const { bataId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const isAdmin = useIsAdmin();

	const [accessDeniedOpen, setAccessDeniedOpen] = useState(false);

	const { data: bata } = useSuspenseQuery<BataDetailData>({
		...(orpc as any).accountant.bata.get.queryOptions({
			input: { id: bataId },
		}),
	});

	const formattedTxDate = parseDateValue(
		bata.transaction_date,
	)?.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});

	return (
		<div className="space-y-6 max-w-4xl">
			{/* Top Navigation */}
			<div className="flex items-center justify-between">
				<Button
					variant="ghost"
					className="gap-2"
					onClick={() => navigate({ to: "/dashboard/accountant/bata" })}
				>
					<ArrowLeftIcon className="h-4 w-4" />
					Back to Bata List
				</Button>

				<Button
					variant="outline"
					className="gap-2"
					onClick={() =>
						navigate({
							to: `/dashboard/accountant/journal-entries/$entryId`,
							params: { entryId: bata.journal_entry_id },
						})
					}
				>
					<EditIcon className="h-4 w-4" />
					Edit Journal Entry
				</Button>
			</div>

			{/* Main Highlight Card */}
			<Card className="border-2 border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10">
				<CardHeader className="pb-2">
					<div>
						<CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
							Bata Amount
						</CardTitle>
						<div className="text-4xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
							{formatINR(bata.bata_amount)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Separator className="my-4" />

					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="text-sm text-muted-foreground flex items-center gap-2">
							<CalendarIcon className="h-4 w-4" />
							Journal Entry Date:{" "}
							<span className="font-semibold text-foreground">
								{formattedTxDate || "N/A"}
							</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Details Grid */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Driver & Vehicle */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base font-semibold flex items-center gap-2">
							<UserIcon className="h-4 w-4 text-primary" />
							Driver & Vehicle Info
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-start justify-between">
							<span className="text-sm text-muted-foreground">Driver:</span>
							<div className="text-right">
								<span className="font-semibold text-sm">
									{bata.driver_name || "Unassigned"}
								</span>
								{bata.driver_phone_number && (
									<div className="text-xs text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
										<PhoneIcon className="h-3 w-3" />
										{bata.driver_phone_number}
									</div>
								)}
							</div>
						</div>

						<Separator />

						<div className="flex items-start justify-between">
							<span className="text-sm text-muted-foreground">Vehicle:</span>
							<div className="text-right">
								<span className="font-semibold text-sm flex items-center justify-end gap-1.5">
									<TruckIcon className="h-4 w-4 text-muted-foreground" />
									{bata.vehicle_name || "N/A"}
								</span>
								{bata.vehicle_license_plate && (
									<div className="text-xs text-muted-foreground uppercase mt-0.5">
										{bata.vehicle_license_plate}
									</div>
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Financial & Trip Info */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base font-semibold flex items-center gap-2">
							<ReceiptTextIcon className="h-4 w-4 text-primary" />
							Revenue & Cargo Details
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">
								Gross Revenue:
							</span>
							<span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
								{formatINR(bata.gross_revenue ?? 0)}
							</span>
						</div>

						{bata.revenue_mode === "calculated" && (
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<span>Calculation Mode:</span>
								<span>
									{bata.quantity ?? 0} qty ×{" "}
									{formatINR(bata.per_item_rate ?? 0)}/unit
								</span>
							</div>
						)}

						<Separator />

						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground flex items-center gap-1.5">
								<PackageIcon className="h-4 w-4 text-muted-foreground" />
								Product Name:
							</span>
							<span className="font-semibold text-sm">
								{bata.product_name || "—"}
							</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Access Denied / Request Dialog for Non-Admin */}
			<AccessDeniedDialog
				open={accessDeniedOpen}
				onOpenChange={setAccessDeniedOpen}
				pageName="Bata"
				resourceType="bata"
				resourceId={bata.id}
				primaryLabel={`Bata for ${bata.driver_name || "Driver"} (${formatINR(bata.bata_amount)})`}
			/>
		</div>
	);
}
