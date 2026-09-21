import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CalendarIcon,
	CheckCircle2Icon,
	ClockIcon,
	CoinsIcon,
	EditIcon,
	PackageIcon,
	PhoneIcon,
	ReceiptTextIcon,
	TruckIcon,
	UserIcon,
	XCircleIcon,
} from "lucide-react";
import { Suspense, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { parseDateValue } from "@/lib/date";
import { formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";
import { AccessDeniedDialog, useIsAdmin } from "@/routes/dashboard/accountant/-shared/admin-helpers";

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

	const markPaidMutation = useMutation({
		...(orpc as any).accountant.bata.markPaid.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
		},
	});

	const unmarkPaidMutation = useMutation({
		...(orpc as any).accountant.bata.unmarkPaid.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
		},
		onError: (err: any) => {
			if (err?.status === 403 || err?.message?.includes("Non-admin")) {
				setAccessDeniedOpen(true);
			}
		},
	});

	const isPaid = bata.status === "paid";
	const formattedTxDate = parseDateValue(bata.transaction_date)?.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
	const formattedPaidAt = parseDateValue(bata.paid_at)?.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	return (
		<div className="space-y-6 max-w-4xl">
			{/* Top Navigation */}
			<div className="flex items-center justify-between">
				<Button variant="ghost" className="gap-2" onClick={() => navigate({ to: "/dashboard/accountant/bata" })}>
					<ArrowLeftIcon className="h-4 w-4" />
					Back to Bata List
				</Button>

				<Button
					variant="outline"
					className="gap-2"
					onClick={() => navigate({ to: `/dashboard/accountant/journal-entries/$entryId`, params: { entryId: bata.journal_entry_id } })}
				>
					<EditIcon className="h-4 w-4" />
					Edit Journal Entry
				</Button>
			</div>

			{/* Main Highlight Card */}
			<Card className="border-2 border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10">
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<div>
						<CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
							Bata Amount
						</CardTitle>
						<div className="text-4xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
							{formatINR(bata.bata_amount)}
						</div>
					</div>

					<div className="flex flex-col items-end gap-2">
						{isPaid ? (
							<Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm px-3 py-1 gap-1.5 border-emerald-500/30">
								<CheckCircle2Icon className="h-4 w-4" />
								PAID
							</Badge>
						) : (
							<Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-sm px-3 py-1 gap-1.5 border-amber-500/30">
								<ClockIcon className="h-4 w-4" />
								UNPAID
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<Separator className="my-4" />

					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="text-sm text-muted-foreground flex items-center gap-2">
							<CalendarIcon className="h-4 w-4" />
							Journal Entry Date: <span className="font-semibold text-foreground">{formattedTxDate || "N/A"}</span>
						</div>

						<div>
							{!isPaid ? (
								<Button
									className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
									disabled={markPaidMutation.isPending}
									onClick={() => markPaidMutation.mutate({ id: bata.id } as never)}
								>
									<CheckCircle2Icon className="h-4 w-4" />
									Mark as Paid
								</Button>
							) : (
								<Button
									variant="destructive"
									className="gap-2"
									disabled={unmarkPaidMutation.isPending}
									onClick={() => unmarkPaidMutation.mutate({ id: bata.id } as never)}
								>
									<XCircleIcon className="h-4 w-4" />
									Unmark as Paid
								</Button>
							)}
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
								<span className="font-semibold text-sm">{bata.driver_name || "Unassigned"}</span>
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
							<span className="text-sm text-muted-foreground">Gross Revenue:</span>
							<span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
								{formatINR(bata.gross_revenue ?? 0)}
							</span>
						</div>

						{bata.revenue_mode === "calculated" && (
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<span>Calculation Mode:</span>
								<span>
									{bata.quantity ?? 0} qty × {formatINR(bata.per_item_rate ?? 0)}/unit
								</span>
							</div>
						)}

						<Separator />

						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground flex items-center gap-1.5">
								<PackageIcon className="h-4 w-4 text-muted-foreground" />
								Product Name:
							</span>
							<span className="font-semibold text-sm">{bata.product_name || "—"}</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Payment & Audit Info */}
			{isPaid && (
				<Card className="bg-emerald-500/5 border-emerald-500/20">
					<CardHeader>
						<CardTitle className="text-base font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
							<CheckCircle2Icon className="h-4 w-4" />
							Settlement Details
						</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-4 md:grid-cols-2 text-sm">
						<div>
							<span className="text-muted-foreground">Paid By:</span>{" "}
							<span className="font-semibold text-foreground">{bata.paid_by_name || "System"}</span>
						</div>
						<div>
							<span className="text-muted-foreground">Paid On:</span>{" "}
							<span className="font-semibold text-foreground">{formattedPaidAt || "N/A"}</span>
						</div>
					</CardContent>
				</Card>
			)}

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
