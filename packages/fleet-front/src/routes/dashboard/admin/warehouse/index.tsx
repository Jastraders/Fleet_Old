import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useDeferredValue, useState, useMemo } from "react";
import * as v from "valibot";
import {
	Building2Icon,
	BoxesIcon,
	WarehouseIcon,
	Trash2Icon,
	CheckCircle2Icon,
	CalendarIcon,
	SearchIcon,
	XIcon,
	PackageIcon,
} from "lucide-react";
import { orpc } from "@/orpc";
import { WarehouseDialog, formatWarehouseCurrency, type WarehouseSection } from "@/routes/dashboard/admin/warehouse/-index/warehouse-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useIsAdmin, useRowAccess, AccessDeniedDialog } from "@/routes/dashboard/accountant/-shared/admin-helpers";

const querySchema = v.object({
	section: v.optional(v.fallback(v.picklist(["JAS", "JKM", "General"]), "JAS"), "JAS"),
	status: v.optional(v.fallback(v.picklist(["all", "paid", "unpaid"]), "all"), "all"),
	product: v.optional(v.string()),
	startDate: v.optional(v.string()),
	endDate: v.optional(v.string()),
	search: v.optional(v.string()),
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 100), 100),
});

export const Route = createFileRoute("/dashboard/admin/warehouse/")({
	validateSearch: querySchema,
	loaderDeps: ({ search: { section, status, product, startDate, endDate, search, offset, limit } }) => ({
		section,
		status,
		product,
		startDate,
		endDate,
		search,
		offset,
		limit,
	}),
	loader: ({ context: { orpc, queryClient }, deps: query }) => {
		queryClient.prefetchQuery(
			orpc.admin.warehouse.list.queryOptions({
				input: {
					section: query.section,
					status: query.status,
					product: query.product,
					startDate: query.startDate,
					endDate: query.endDate,
					search: query.search,
					limit: query.limit,
					offset: query.offset,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Suspense fallback={<div className="p-6">Loading Warehouse records...</div>}>
			<WarehouseList />
		</Suspense>
	);
}

function WarehouseList() {
	const navigate = useNavigate();
	const query = Route.useSearch();
	const deferredQuery = useDeferredValue(query);
	const queryClient = useQueryClient();
	const isAdmin = useIsAdmin();
	const { canAccess } = useRowAccess();

	const activeSection: WarehouseSection = (query.section as WarehouseSection) || "JAS";
	const activeStatus = query.status || "all";
	const activeProduct = query.product || "all";
	const startDate = query.startDate || "";
	const endDate = query.endDate || "";
	const search = query.search || "";

	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [accessDeniedState, setAccessDeniedState] = useState<{ open: boolean; recordId: string; label: string }>({
		open: false,
		recordId: "",
		label: "",
	});

	const { data: productsData } = useQuery({
		...orpc.admin.warehouse.products.list.queryOptions({
			input: { section: activeSection, includeArchived: true },
		}),
	});
	const productList: string[] = productsData?.products || [];

	const { data } = useSuspenseQuery({
		...orpc.admin.warehouse.list.queryOptions({
			input: {
				section: activeSection,
				status: activeStatus,
				product: deferredQuery.product,
				startDate: deferredQuery.startDate,
				endDate: deferredQuery.endDate,
				search: deferredQuery.search,
				limit: deferredQuery.limit,
				offset: deferredQuery.offset,
			},
		}),
	});

	const deleteMutation = useMutation({
		...orpc.admin.warehouse.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setSelectedIds([]);
		},
	});

	const bulkStatusMutation = useMutation({
		...orpc.admin.warehouse.bulk_update_status.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setSelectedIds([]);
		},
	});

	const selectedRecords = useMemo(() => {
		if (!data) return [];
		return data.data.filter((r: any) => selectedIds.includes(r.id));
	}, [data, selectedIds]);

	const selectedStats = useMemo(() => {
		let totalUnloads = 0;
		let totalWorkersSalary = 0;
		let totalUnionSalary = 0;
		let totalValue = 0;

		for (const record of selectedRecords) {
			totalUnloads += record.totalUnloads;
			totalWorkersSalary += record.totalWorkersSalary;
			totalUnionSalary += record.totalUnionSalary;
			totalValue += record.totalValue;
		}

		return {
			count: selectedRecords.length,
			totalUnloads,
			totalWorkersSalary,
			totalUnionSalary,
			totalValue,
		};
	}, [selectedRecords]);

	const handleSectionChange = (section: WarehouseSection) => {
		setSelectedIds([]);
		navigate({
			search: (prev) => ({
				...prev,
				section,
				product: undefined,
				offset: 0,
			}),
		});
	};

	const handleStatusChange = (status: "all" | "paid" | "unpaid") => {
		setSelectedIds([]);
		navigate({
			search: (prev) => ({
				...prev,
				status,
				offset: 0,
			}),
		});
	};

	const handleProductChange = (product: string) => {
		setSelectedIds([]);
		navigate({
			search: (prev) => ({
				...prev,
				product: product === "all" ? undefined : product,
				offset: 0,
			}),
		});
	};

	const handleDateChange = (field: "startDate" | "endDate", value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				[field]: value || undefined,
				offset: 0,
			}),
		});
	};

	const handleSearchChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				search: value || undefined,
				offset: 0,
			}),
		});
	};

	const handleDelete = async (id: string, label: string) => {
		if (!isAdmin) {
			const hasPermission = await canAccess({
				pageName: "warehouse",
				resourceType: "warehouse_record",
				resourceId: id,
				action: "delete",
			});
			if (!hasPermission) {
				setAccessDeniedState({ open: true, recordId: id, label });
				return;
			}
		}

		const reason = prompt("Please enter a reason for deleting this warehouse record:");
		if (reason === null) return; // cancelled
		if (!reason.trim()) {
			alert("Reason is required to delete a warehouse record.");
			return;
		}

		deleteMutation.mutate({ id, reason });
	};

	const handleBulkMarkAsPaid = () => {
		if (selectedIds.length === 0) return;
		if (confirm(`Are you sure you want to mark ${selectedIds.length} records as PAID?`)) {
			bulkStatusMutation.mutate({ ids: selectedIds, status: "paid" });
		}
	};

	const handleSelectAll = (checked: boolean) => {
		if (checked && data) {
			setSelectedIds(data.data.map((r: any) => r.id));
		} else {
			setSelectedIds([]);
		}
	};

	const handleSelectRow = (id: string, checked: boolean) => {
		if (checked) {
			setSelectedIds((prev) => [...prev, id]);
		} else {
			setSelectedIds((prev) => prev.filter((item) => item !== id));
		}
	};

	const handleRowClick = (id: string) => {
		navigate({ to: "/dashboard/admin/warehouse/$recordId", params: { recordId: id } });
	};

	const isEmpty = !data || data.meta.total === 0;

	// Theme color styles per warehouse
	const getThemeConfig = (sec: WarehouseSection) => {
		switch (sec) {
			case "JAS":
				return {
					label: "JAS Warehouse",
					sub: "Owner's Business (Primary)",
					activeTab: "border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:text-blue-400 font-bold",
					badge: "bg-blue-600 text-white",
					colorHex: "#2563EB",
					icon: (
						<span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white font-black text-xs shadow-xs">
							J
						</span>
					),
				};
			case "JKM":
				return {
					label: "JKM Warehouse",
					sub: "Secondary Warehouse",
					activeTab: "border-purple-600 text-purple-600 bg-purple-50/50 dark:bg-purple-950/30 dark:text-purple-400 font-semibold",
					badge: "bg-purple-600 text-white",
					colorHex: "#7C3AED",
					icon: <Building2Icon className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
				};
			case "General":
				return {
					label: "General Warehouse",
					sub: "General / Third-Party",
					activeTab: "border-orange-600 text-orange-600 bg-orange-50/50 dark:bg-orange-950/30 dark:text-orange-400 font-semibold",
					badge: "bg-orange-600 text-white",
					colorHex: "#EA580C",
					icon: <BoxesIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />,
				};
		}
	};

	const activeTheme = getThemeConfig(activeSection);

	return (
		<div className="w-full space-y-6">
			{/* Header */}
			<div className="flex flex-wrap justify-between items-center gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						{activeTheme.icon}
						<h1 className="text-2xl font-bold tracking-tight">{activeTheme.label}</h1>
					</div>
					<p className="text-muted-foreground text-sm">
						Independent warehouse records, labour wages, and unloading logs.
					</p>
				</div>
				<div className="flex gap-4">
					<WarehouseDialog mode="create" defaultSection={activeSection} />
				</div>
			</div>

			{/* 3 Independent Warehouse Section Switcher */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				{(["JAS", "JKM", "General"] as const).map((sec) => {
					const cfg = getThemeConfig(sec);
					const isSelected = activeSection === sec;
					return (
						<button
							key={sec}
							type="button"
							onClick={() => handleSectionChange(sec)}
							className={cn(
								"flex items-center gap-3 p-4 rounded-xl border text-left transition-all shadow-2xs hover:shadow-md",
								isSelected
									? cn("border-2 shadow-sm bg-card", cfg.activeTab)
									: "bg-card hover:border-muted-foreground/40 text-muted-foreground"
							)}
						>
							<div className="shrink-0">{cfg.icon}</div>
							<div>
								<div className="font-bold text-sm text-foreground flex items-center gap-1.5">
									{cfg.label}
									{sec === "JAS" && (
										<span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
											Primary
										</span>
									)}
								</div>
								<div className="text-xs text-muted-foreground">{cfg.sub}</div>
							</div>
						</button>
					);
				})}
			</div>

			{/* Summary Salary Totals Following Active Filters */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<Card className="border bg-card shadow-2xs">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Total Own Staff Salary
						</CardDescription>
						<CardTitle className="text-2xl sm:text-3xl font-extrabold text-primary">
							{formatWarehouseCurrency(data.meta.totalOwnStaffSalary ?? 0)}
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-0 text-xs text-muted-foreground">
						{activeTheme.label} • Regular staff labour wages (filtered)
					</CardContent>
				</Card>

				<Card className="border bg-card shadow-2xs">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Total Union Salary
						</CardDescription>
						<CardTitle className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">
							{formatWarehouseCurrency(data.meta.totalUnionSalary ?? 0)}
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-0 text-xs text-muted-foreground">
						{activeTheme.label} • Union labour wages (filtered)
					</CardContent>
				</Card>
			</div>

			{/* Filters & Search Bar */}
			<div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border bg-card">
				{/* Status Tabs */}
				<div className="flex gap-1 bg-muted p-1 rounded-md">
					{(["all", "unpaid", "paid"] as const).map((tab) => (
						<button
							key={tab}
							onClick={() => handleStatusChange(tab)}
							className={cn(
								"px-3 py-1 text-xs font-semibold rounded-sm capitalize transition-colors",
								activeStatus === tab
									? "bg-background text-foreground shadow-2xs"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							{tab} Records
						</button>
					))}
				</div>

				{/* Search, Product Filter & Custom Date Filter */}
				<div className="flex flex-wrap items-center gap-3 text-sm">
					{/* Product Filter */}
					<div className="flex items-center gap-1.5">
						<PackageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
						<select
							value={activeProduct}
							onChange={(e) => handleProductChange(e.target.value)}
							className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-36 sm:w-44"
						>
							<option value="all">All Products</option>
							{productList.map((p) => (
								<option key={p} value={p}>
									{p}
								</option>
							))}
						</select>
						{activeProduct !== "all" && (
							<Button
								variant="ghost"
								size="sm"
								className="h-9 px-2 text-xs text-muted-foreground"
								onClick={() => handleProductChange("all")}
							>
								Clear
							</Button>
						)}
					</div>

					{/* Search */}
					<div className="relative w-44 sm:w-56">
						<SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search Product..."
							value={search}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="pl-8 h-9 text-xs"
						/>
						{search && (
							<button
								onClick={() => handleSearchChange("")}
								className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
							>
								<XIcon className="h-4 w-4" />
							</button>
						)}
					</div>

					{/* Date Range Picker */}
					<div className="flex items-center gap-1.5">
						<CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
						<Input
							type="date"
							value={startDate}
							onChange={(e) => handleDateChange("startDate", e.target.value)}
							className="h-9 w-32 text-xs"
						/>
						<span className="text-muted-foreground text-xs">to</span>
						<Input
							type="date"
							value={endDate}
							onChange={(e) => handleDateChange("endDate", e.target.value)}
							className="h-9 w-32 text-xs"
						/>
						{(startDate || endDate) && (
							<Button
								variant="ghost"
								size="sm"
								className="h-9 px-2 text-xs text-muted-foreground"
								onClick={() => {
									handleDateChange("startDate", "");
									handleDateChange("endDate", "");
								}}
							>
								Clear
							</Button>
						)}
					</div>
				</div>
			</div>

			{/* Bulk Actions Header */}
			{selectedIds.length > 0 && (
				<div className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-lg bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-top-2">
					<div className="space-y-1 text-sm">
						<div className="font-semibold text-primary">
							{selectedStats.count} {activeSection} entry(s) selected
						</div>
						<div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
							<span>Total Quantity: <strong className="text-foreground">{selectedStats.totalUnloads}</strong></span>
							<span>Total Value: <strong className="text-foreground">{formatWarehouseCurrency(selectedStats.totalValue)}</strong></span>
							<span>Own Staff Salary: <strong className="text-primary">{formatWarehouseCurrency(selectedStats.totalWorkersSalary)}</strong></span>
							<span>Union Salary: <strong className="text-purple-600 dark:text-purple-400">{formatWarehouseCurrency(selectedStats.totalUnionSalary)}</strong></span>
						</div>
					</div>
					<div className="flex gap-2">
						<Button size="sm" onClick={handleBulkMarkAsPaid} className="bg-green-600 hover:bg-green-700 text-white">
							<CheckCircle2Icon className="h-4 w-4 mr-1" />
							Mark as Paid
						</Button>
						<Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>
							Clear Selection
						</Button>
					</div>
				</div>
			)}

			{/* Records Table */}
			{isEmpty ? (
				<div className="flex flex-col items-center justify-center p-12 border rounded-lg bg-card text-center space-y-2">
					<p className="text-muted-foreground text-sm">No {activeSection} records found under "{activeStatus}".</p>
					{(startDate || endDate || search) && (
						<p className="text-xs text-muted-foreground">Try clearing date or search filters.</p>
					)}
				</div>
			) : (
				<div className="rounded-lg border bg-card shadow-2xs overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/50">
								<TableHead className="w-10">
									<Checkbox
										checked={data.data.length > 0 && selectedIds.length === data.data.length}
										onCheckedChange={(checked) => handleSelectAll(!!checked)}
									/>
								</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Product Name</TableHead>
								<TableHead className="text-right">Regular Worker</TableHead>
								<TableHead className="text-right">Union Worker</TableHead>
								<TableHead className="text-right">Per Bag Price</TableHead>
								<TableHead className="text-right">Quantity</TableHead>
								<TableHead className="text-right">Total Value</TableHead>
								<TableHead className="text-right">Union Salary</TableHead>
								<TableHead className="text-right">Own Staff Salary</TableHead>
								<TableHead className="text-center">Status</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.data.map((record: any) => {
								const isSelected = selectedIds.includes(record.id);
								return (
									<TableRow
										key={record.id}
										onClick={() => handleRowClick(record.id)}
										className={cn(
											"cursor-pointer transition-colors hover:bg-muted/60",
											isSelected && "bg-muted/40"
										)}
									>
										<TableCell onClick={(e) => e.stopPropagation()}>
											<Checkbox
												checked={isSelected}
												onCheckedChange={(checked) => handleSelectRow(record.id, !!checked)}
											/>
										</TableCell>
										<TableCell className="font-medium whitespace-nowrap">
											<div className="flex items-center gap-1.5">
												<CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
												{record.recordDate}
											</div>
										</TableCell>
										<TableCell className="font-medium">{record.productName || "—"}</TableCell>
										<TableCell className="text-right font-medium">{record.workersCount}</TableCell>
										<TableCell className="text-right text-purple-600 dark:text-purple-400 font-medium">{record.unionCount}</TableCell>
										<TableCell className="text-right">{formatWarehouseCurrency(record.ratePerUnload)}</TableCell>
										<TableCell className="text-right font-semibold">{record.totalUnloads}</TableCell>
										<TableCell className="text-right font-bold text-foreground">{formatWarehouseCurrency(record.totalValue)}</TableCell>
										<TableCell className="text-right text-purple-600 dark:text-purple-400">{formatWarehouseCurrency(record.totalUnionSalary)}</TableCell>
										<TableCell className="text-right font-bold text-primary">{formatWarehouseCurrency(record.totalWorkersSalary)}</TableCell>
										<TableCell className="text-center whitespace-nowrap">
											<span
												className={cn(
													"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold select-none",
													record.status === "paid"
														? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
														: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
												)}
											>
												<span className={cn("h-1.5 w-1.5 rounded-full", record.status === "paid" ? "bg-green-500" : "bg-amber-500")} />
												{record.status}
											</span>
										</TableCell>
										<TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
											<div className="flex items-center justify-end gap-1">
												<WarehouseDialog
													mode="edit"
													defaultSection={activeSection}
													initialValues={{
														id: record.id,
														section: record.section,
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
													variant="ghost"
													size="icon"
													onClick={() => handleDelete(record.id, `${record.section} Record (${record.recordDate})`)}
													className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
												>
													<Trash2Icon className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}

			<AccessDeniedDialog
				open={accessDeniedState.open}
				onOpenChange={(open) => setAccessDeniedState((prev) => ({ ...prev, open }))}
				pageName="warehouse"
				resourceType="warehouse_record"
				resourceId={accessDeniedState.recordId}
				primaryLabel={accessDeniedState.label}
			/>
		</div>
	);
}