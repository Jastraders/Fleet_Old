import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import {
	Building2Icon,
	BoxesIcon,
	WarehouseIcon,
	ArrowLeftIcon,
	CheckCircle2Icon,
	XCircleIcon,
	CalendarIcon,
	UserIcon,
	ClockIcon,
	PencilIcon,
	Trash2Icon,
	InfoIcon,
} from "lucide-react";
import { orpc } from "@/orpc";
import { WarehouseDialog, formatWarehouseCurrency, type WarehouseSection } from "@/routes/dashboard/admin/warehouse/-index/warehouse-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsAdmin, useRowAccess, AccessDeniedDialog } from "@/routes/dashboard/accountant/-shared/admin-helpers";

export const Route = createFileRoute("/dashboard/admin/warehouse/$recordId/")({
	loader: ({ context: { orpc, queryClient }, params }) => {
		queryClient.prefetchQuery(
			orpc.admin.warehouse.get.queryOptions({
				input: { id: params.recordId },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Suspense fallback={<div className="p-6">Loading Warehouse record details...</div>}>
			<WarehouseDetailView />
		</Suspense>
	);
}

function SectionBadge({ section }: { section: WarehouseSection }) {
	switch (section) {
		case "JAS":
			return (
				<Badge className="bg-blue-600 text-white hover:bg-blue-700 gap-1.5 px-3 py-1 font-semibold">
					<span className="flex h-5 w-5 items-center justify-center rounded bg-white/20 text-xs font-bold">J</span>
					JAS Warehouse (Primary)
				</Badge>
			);
		case "JKM":
			return (
				<Badge className="bg-purple-600 text-white hover:bg-purple-700 gap-1.5 px-3 py-1 font-semibold">
					<Building2Icon className="h-4 w-4" />
					JKM Warehouse
				</Badge>
			);
		case "General":
			return (
				<Badge className="bg-orange-600 text-white hover:bg-orange-700 gap-1.5 px-3 py-1 font-semibold">
					<BoxesIcon className="h-4 w-4" />
					General Warehouse
				</Badge>
			);
	}
}

function WarehouseDetailView() {
	const { recordId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const isAdmin = useIsAdmin();
	const { canAccess } = useRowAccess();

	const [isAccessDeniedOpen, setIsAccessDeniedOpen] = useState(false);
	const [accessAction, setAccessAction] = useState<"edit" | "delete">("edit");

	const { data: record } = useSuspenseQuery({
		...orpc.admin.warehouse.get.queryOptions({
			input: { id: recordId },
		}),
	});

	const updateStatusMutation = useMutation({
		...orpc.admin.warehouse.update_status.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
		},
	});

	const deleteMutation = useMutation({
		...orpc.admin.warehouse.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			navigate({ to: "/dashboard/admin/warehouse" });
		},
	});

	const handleToggleStatus = () => {
		const nextStatus = record.status === "paid" ? "unpaid" : "paid";
		updateStatusMutation.mutate({ id: recordId, status: nextStatus });
	};

	const handleDelete = async () => {
		if (!isAdmin) {
			const hasPermission = await canAccess({
				pageName: "warehouse",
				resourceType: "warehouse_record",
				resourceId: recordId,
				action: "delete",
			});
			if (!hasPermission) {
				setAccessAction("delete");
				setIsAccessDeniedOpen(true);
				return;
			}
		}

		const reason = prompt("Please provide a reason for deleting this record:");
		if (reason === null) return; // user cancelled
		if (!reason.trim()) {
			alert("Reason is required to delete a warehouse record.");
			return;
		}

		deleteMutation.mutate({ id: recordId, reason });
	};

	const section = (record.section || "JAS") as WarehouseSection;

	return (
		<div className="w-full space-y-6">
			{/* Top Bar */}
			<div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						size="icon"
						onClick={() => navigate({ to: "/dashboard/admin/warehouse" })}
					>
						<ArrowLeftIcon className="h-4 w-4" />
					</Button>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-2xl font-bold tracking-tight">Warehouse Record Detail</h1>
							<SectionBadge section={section} />
						</div>
						<p className="text-sm text-muted-foreground">
							Record Date: {record.recordDate} | Added on {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "N/A"}
						</p>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant={record.status === "paid" ? "outline" : "default"}
						onClick={handleToggleStatus}
						disabled={updateStatusMutation.isPending}
						className={cn(
							record.status === "unpaid" && "bg-green-600 hover:bg-green-700 text-white"
						)}
					>
						{record.status === "paid" ? (
							<>
								<XCircleIcon className="h-4 w-4 mr-1 text-amber-600" />
								Mark as Unpaid
							</>
						) : (
							<>
								<CheckCircle2Icon className="h-4 w-4 mr-1" />
								Mark as Paid
							</>
						)}
					</Button>

					<WarehouseDialog
						mode="edit"
						initialValues={{
							id: record.id,
							section: section,
							recordDate: record.recordDate,
							firmName: record.firmName,
							productName: record.productName,
							workersCount: record.workersCount,
							unionCount: record.unionCount,
							ratePerUnload: record.ratePerUnload,
							totalUnloads: record.totalUnloads,
							unionSum: record.unionSum,
							ownStaffAmount: record.ownStaffAmount,
							status: record.status,
						}}
					/>

					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
					>
						<Trash2Icon className="h-4 w-4 mr-1" />
						Delete
					</Button>
				</div>
			</div>

			{/* Summary Stat Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total Value</CardDescription>
						<CardTitle className="text-2xl font-bold text-foreground">
							{formatWarehouseCurrency(record.totalValue)}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-xs text-muted-foreground">
						Rate: {formatWarehouseCurrency(record.ratePerUnload)} × {record.totalUnloads} unloads
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Own Staff Salary</CardDescription>
						<CardTitle className="text-2xl font-bold text-primary">
							{formatWarehouseCurrency(record.totalWorkersSalary)}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-xs text-muted-foreground">
						Regular Workers: {record.workersCount}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Union Salary</CardDescription>
						<CardTitle className="text-2xl font-bold text-purple-600 dark:text-purple-400">
							{formatWarehouseCurrency(record.totalUnionSalary)}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-xs text-muted-foreground">
						Union Workers: {record.unionCount}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Payment Status</CardDescription>
						<CardTitle className="text-2xl font-bold capitalize">
							<span
								className={cn(
									"inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-semibold select-none",
									record.status === "paid"
										? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
								)}
							>
								<span className={cn("h-2 w-2 rounded-full", record.status === "paid" ? "bg-green-500" : "bg-amber-500")} />
								{record.status}
							</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="text-xs text-muted-foreground">
						{record.status === "paid" && record.paidByName ? `Paid by ${record.paidByName}` : "Awaiting payment"}
					</CardContent>
				</Card>
			</div>

			{/* Record Details Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Labor & Product Details</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Warehouse Section:</span>
							<span className="font-semibold">{record.section}</span>
						</div>
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Record Date:</span>
							<span className="font-semibold">{record.recordDate}</span>
						</div>
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Firm Name:</span>
							<span className="font-semibold">{record.firmName || "N/A"}</span>
						</div>
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Product Name:</span>
							<span className="font-semibold">{record.productName || "N/A"}</span>
						</div>
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Regular Worker Count:</span>
							<span className="font-semibold">{record.workersCount}</span>
						</div>
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Union Worker Count:</span>
							<span className="font-semibold">{record.unionCount}</span>
						</div>
						<div className="flex justify-between pb-1">
							<span className="text-muted-foreground font-semibold">Total Labours:</span>
							<span className="font-bold text-primary">{record.totalLabours}</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Financial Breakdown & Payment Info</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Per Bag Price / Rate:</span>
							<span className="font-semibold">{formatWarehouseCurrency(record.ratePerUnload)}</span>
						</div>
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Quantity (Unloads):</span>
							<span className="font-semibold">{record.totalUnloads}</span>
						</div>
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Total Value:</span>
							<span className="font-bold text-foreground">{formatWarehouseCurrency(record.totalValue)}</span>
						</div>
						<div className="flex justify-between border-b pb-2">
							<span className="text-muted-foreground">Own Staff Salary:</span>
							<span className="font-bold text-primary">{formatWarehouseCurrency(record.totalWorkersSalary)}</span>
						</div>
						<div className="flex justify-between pb-1">
							<span className="text-muted-foreground">Union Salary:</span>
							<span className="font-bold text-purple-600 dark:text-purple-400">{formatWarehouseCurrency(record.totalUnionSalary)}</span>
						</div>
					</CardContent>
				</Card>

				{/* Metadata & Audit Trail */}
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="text-lg">Audit & Payment Metadata</CardTitle>
					</CardHeader>
					<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-muted-foreground">
								<CheckCircle2Icon className="h-4 w-4 text-green-600" />
								<span>Payment Status:</span>
								<strong className="text-foreground capitalize">{record.status}</strong>
							</div>
							{record.status === "paid" && (
								<>
									<div className="flex items-center gap-2 text-muted-foreground">
										<UserIcon className="h-4 w-4" />
										<span>Marked as Paid By:</span>
										<strong className="text-foreground">{record.paidByName || record.paidBy || "Admin"}</strong>
									</div>
									<div className="flex items-center gap-2 text-muted-foreground">
										<ClockIcon className="h-4 w-4" />
										<span>Marked as Paid On:</span>
										<strong className="text-foreground">
											{record.paidAt ? new Date(record.paidAt).toLocaleString() : "N/A"}
										</strong>
									</div>
								</>
							)}
						</div>

						<div className="space-y-2">
							<div className="flex items-center gap-2 text-muted-foreground">
								<UserIcon className="h-4 w-4" />
								<span>Created By:</span>
								<strong className="text-foreground">{record.createdByUser?.name || "System"}</strong>
							</div>
							<div className="flex items-center gap-2 text-muted-foreground">
								<CalendarIcon className="h-4 w-4" />
								<span>Created At:</span>
								<strong className="text-foreground">
									{record.createdAt ? new Date(record.createdAt).toLocaleString() : "N/A"}
								</strong>
							</div>
							{record.reason && (
								<div className="flex items-start gap-2 text-muted-foreground pt-1">
									<InfoIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
									<div>
										<span>Last Edit Reason:</span>
										<p className="text-foreground font-medium italic mt-0.5">{record.reason}</p>
									</div>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			<AccessDeniedDialog
				open={isAccessDeniedOpen}
				onOpenChange={setIsAccessDeniedOpen}
				pageName="warehouse"
				resourceType="warehouse_record"
				resourceId={recordId}
				primaryLabel={`${record.section} Warehouse Record (${record.recordDate})`}
			/>
		</div>
	);
}
