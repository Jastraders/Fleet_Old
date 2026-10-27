import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertCircleIcon,
	Building2Icon,
	CalendarIcon,
	CheckIcon,
	DownloadIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	PackageIcon,
	PencilIcon,
	PlusIcon,
	RotateCcwIcon,
	SearchIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import * as v from "valibot";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	type ExportColumn,
	exportStatementToExcel,
	exportStatementToPdf,
	type StatementExportOptions,
} from "@/lib/statement-export";
import { cn } from "@/lib/utils";
import { orpc } from "@/orpc";
import {
	AccessDeniedDialog,
	useIsAdmin,
	useRowAccess,
} from "@/routes/dashboard/accountant/-shared/admin-helpers";
import {
	formatWarehouseCurrency,
	WarehouseDialog,
	type WarehouseSection,
} from "@/routes/dashboard/admin/warehouse/-index/warehouse-dialog";
import {
	type WarehouseItem,
	WarehouseManagementDialog,
} from "@/routes/dashboard/admin/warehouse/-index/warehouse-management-dialog";

const periodSchema = v.fallback(
	v.picklist([
		"all_time",
		"last_7d",
		"last_30d",
		"last_6m",
		"last_12m",
		"custom",
	]),
	"all_time",
);

const periodOptions = [
	{ value: "all_time", label: "All Time" },
	{ value: "last_7d", label: "Last 7 Days" },
	{ value: "last_30d", label: "Last 30 Days" },
	{ value: "last_6m", label: "Last 6 Months" },
	{ value: "last_12m", label: "Last 12 Months" },
	{ value: "custom", label: "Custom Range" },
] as const;

const querySchema = v.object({
	section: v.optional(v.fallback(v.string(), "JAS"), "JAS"),
	status: v.optional(
		v.fallback(v.picklist(["all", "paid", "unpaid"]), "all"),
		"all",
	),
	product: v.optional(v.string()),
	period: v.optional(periodSchema, "all_time"),
	startDate: v.optional(v.string()),
	endDate: v.optional(v.string()),
	search: v.optional(v.string()),
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 100), 100),
});

export const Route = createFileRoute("/dashboard/admin/warehouse/")({
	validateSearch: querySchema,
	loaderDeps: ({
		search: {
			section,
			status,
			product,
			period,
			startDate,
			endDate,
			search,
			offset,
			limit,
		},
	}) => ({
		section,
		status,
		product,
		period,
		startDate,
		endDate,
		search,
		offset,
		limit,
	}),
	loader: ({ context: { orpc, queryClient }, deps: query }) => {
		const isDateRangeInvalid = !!(
			query.period === "custom" &&
			query.startDate &&
			query.endDate &&
			query.startDate > query.endDate
		);
		queryClient.prefetchQuery(
			orpc.admin.warehouse.warehouses.list.queryOptions({}),
		);
		queryClient.prefetchQuery(
			orpc.admin.warehouse.list.queryOptions({
				input: {
					section: query.section,
					status: "all",
					product: query.product,
					period: query.period,
					startDate: isDateRangeInvalid ? undefined : query.startDate,
					endDate: isDateRangeInvalid ? undefined : query.endDate,
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
		<Suspense
			fallback={<div className="p-6">Loading Warehouse records...</div>}
		>
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

	const activeSection: WarehouseSection =
		(query.section as WarehouseSection) || "JAS";
	const activeStatus = query.status || "all";
	const activeProduct = query.product || "all";
	const period = query.period || "all_time";
	const startDate = query.startDate || "";
	const endDate = query.endDate || "";
	const search = query.search || "";

	const isDateRangeInvalid = !!(
		query.period === "custom" &&
		query.startDate &&
		query.endDate &&
		query.startDate > query.endDate
	);

	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [accessDeniedState, setAccessDeniedState] = useState<{
		open: boolean;
		recordId: string;
		label: string;
	}>({
		open: false,
		recordId: "",
		label: "",
	});

	const { data: warehousesData } = useQuery({
		...orpc.admin.warehouse.warehouses.list.queryOptions({}),
	});
	const warehouses: WarehouseItem[] = warehousesData?.warehouses || [
		{
			id: "jas",
			name: "JAS Warehouse",
			code: "JAS",
			description: "Owner's Business (Primary)",
			color: "#2563EB",
			isSystem: true,
			status: "active",
		},
		{
			id: "jkm",
			name: "JKM Warehouse",
			code: "JKM",
			description: "Secondary Warehouse",
			color: "#7C3AED",
			isSystem: true,
			status: "active",
		},
	];

	const [warehouseSearch, setWarehouseSearch] = useState("");
	const [managementModal, setManagementModal] = useState<{
		open: boolean;
		mode: "create" | "edit";
		warehouse?: WarehouseItem | null;
	}>({
		open: false,
		mode: "create",
		warehouse: null,
	});

	const [warehouseToDelete, setWarehouseToDelete] =
		useState<WarehouseItem | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const deleteWarehouseMutation = useMutation({
		...orpc.admin.warehouse.warehouses.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			if (
				warehouseToDelete &&
				activeSection.toLowerCase() === warehouseToDelete.code.toLowerCase()
			) {
				handleSectionChange("JAS");
			}
			setWarehouseToDelete(null);
			setDeleteError(null);
		},
		onError: (err: any) => {
			setDeleteError(err?.message || "Failed to delete warehouse");
		},
	});

	const filteredWarehouses = useMemo(() => {
		if (!warehouseSearch.trim()) return warehouses;
		const term = warehouseSearch.trim().toLowerCase();
		return warehouses.filter(
			(w) =>
				w.name.toLowerCase().includes(term) ||
				w.code.toLowerCase().includes(term) ||
				(w.description && w.description.toLowerCase().includes(term)),
		);
	}, [warehouses, warehouseSearch]);

	const activeWarehouse = useMemo(() => {
		return (
			warehouses.find(
				(w) => w.code.toLowerCase() === activeSection.toLowerCase(),
			) ||
			warehouses[0] || {
				id: "jas",
				name: "JAS Warehouse",
				code: "JAS",
				description: "Owner's Business (Primary)",
				color: "#2563EB",
				isSystem: true,
				status: "active",
			}
		);
	}, [warehouses, activeSection]);

	const { data: productsData } = useQuery({
		...orpc.admin.warehouse.products.list.queryOptions({
			input: { section: activeSection, includeArchived: true },
		}),
	});
	const productList: string[] = productsData?.products || [];

	const [isExporting, setIsExporting] = useState(false);

	const { data } = useSuspenseQuery({
		...orpc.admin.warehouse.list.queryOptions({
			input: {
				section: activeSection,
				status: "all",
				product: deferredQuery.product,
				period: deferredQuery.period,
				startDate: isDateRangeInvalid ? undefined : deferredQuery.startDate,
				endDate: isDateRangeInvalid ? undefined : deferredQuery.endDate,
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

	const handlePeriodChange = (newPeriod: string) => {
		setSelectedIds([]);
		navigate({
			search: (prev) => {
				const next = { ...prev, offset: 0, period: newPeriod as any };
				if (newPeriod === "custom") {
					const today = new Date().toISOString().split("T")[0];
					const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
						.toISOString()
						.split("T")[0];
					next.startDate = prev.startDate || thirtyDaysAgo;
					next.endDate = prev.endDate || today;
				} else {
					delete next.startDate;
					delete next.endDate;
				}
				return next;
			},
		});
	};

	const handleDateChange = (field: "startDate" | "endDate", value: string) => {
		setSelectedIds([]);
		navigate({
			search: (prev) => {
				const next = { ...prev, offset: 0, period: "custom" as any };
				if (value) {
					next[field] = value;
				} else {
					delete next[field];
				}
				return next;
			},
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

		const reason = prompt(
			"Please enter a reason for deleting this warehouse record:",
		);
		if (reason === null) return; // cancelled
		if (!reason.trim()) {
			alert("Reason is required to delete a warehouse record.");
			return;
		}

		deleteMutation.mutate({ id, reason });
	};

	const handleExport = async (format: "pdf" | "excel") => {
		if (!data || data.meta.total === 0) {
			alert("No records to export for the selected filters.");
			return;
		}

		setIsExporting(true);
		try {
			let exportRecords = data.data;
			if (data.meta.total > data.data.length) {
				const fullResult = await queryClient.fetchQuery(
					orpc.admin.warehouse.list.queryOptions({
						input: {
							section: activeSection,
							status: "all",
							product: deferredQuery.product,
							period: deferredQuery.period,
							startDate: isDateRangeInvalid
								? undefined
								: deferredQuery.startDate,
							endDate: isDateRangeInvalid ? undefined : deferredQuery.endDate,
							search: deferredQuery.search,
							limit: 10000,
							offset: 0,
						},
					}),
				);
				if (fullResult?.data) {
					exportRecords = fullResult.data;
				}
			}

			const formatCurrency = (val: number) => {
				return `Rs. ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
			};

			let grandTotalUnloads = 0;
			let grandTotalOwnSalary = 0;
			let grandTotalUnionSalary = 0;
			let grandTotalValue = 0;
			let grandTotalRegularWorkers = 0;
			let grandTotalUnionWorkers = 0;

			for (const r of exportRecords) {
				grandTotalUnloads += Number(r.totalUnloads || 0);
				grandTotalOwnSalary += Number(r.totalWorkersSalary || 0);
				grandTotalUnionSalary += Number(r.totalUnionSalary || 0);
				grandTotalValue += Number(r.totalValue || 0);
				grandTotalRegularWorkers += Number(r.workersCount || 0);
				grandTotalUnionWorkers += Number(r.unionCount || 0);
			}

			const columns: ExportColumn[] = [
				{ header: "Date", key: "recordDate", width: 70, align: "left" },
				{
					header: "Product Name",
					key: "productName",
					width: 100,
					align: "left",
				},
				{
					header: "Total Worker",
					key: "totalWorker",
					width: 65,
					align: "right",
				},
				{
					header: "Regular Worker",
					key: "regularWorker",
					width: 70,
					align: "right",
				},
				{
					header: "Union Worker",
					key: "unionWorker",
					width: 65,
					align: "right",
				},
				{
					header: "Per Bag Price",
					key: "ratePerUnload",
					width: 70,
					align: "right",
				},
				{
					header: "Quantity (Unloads)",
					key: "totalUnloads",
					width: 85,
					align: "right",
				},
				{
					header: "Own Staff Salary",
					key: "ownStaffSalary",
					width: 85,
					align: "right",
				},
				{
					header: "Union Salary",
					key: "unionSalary",
					width: 80,
					align: "right",
				},
				{ header: "Total Value", key: "totalValue", width: 80, align: "right" },
			];

			const rows = exportRecords.map((r: any) => ({
				recordDate: r.recordDate,
				productName: r.productName || "—",
				totalWorker: (r.workersCount || 0) + (r.unionCount || 0),
				regularWorker: r.workersCount || 0,
				unionWorker: r.unionCount || 0,
				ratePerUnload: formatCurrency(r.ratePerUnload),
				totalUnloads: r.totalUnloads || 0,
				ownStaffSalary: formatCurrency(r.totalWorkersSalary),
				unionSalary: formatCurrency(r.totalUnionSalary),
				totalValue: formatCurrency(r.totalValue),
			}));

			const grandTotalRow = {
				recordDate: "GRAND TOTAL",
				productName: "",
				totalWorker: grandTotalRegularWorkers + grandTotalUnionWorkers,
				regularWorker: grandTotalRegularWorkers,
				unionWorker: grandTotalUnionWorkers,
				ratePerUnload: "",
				totalUnloads: grandTotalUnloads,
				ownStaffSalary: formatCurrency(grandTotalOwnSalary),
				unionSalary: formatCurrency(grandTotalUnionSalary),
				totalValue: formatCurrency(grandTotalValue),
			};

			const periodLabel =
				period === "custom" && startDate && endDate
					? `${startDate} to ${endDate}`
					: periodOptions.find((p) => p.value === period)?.label || period;

			const options: StatementExportOptions = {
				filename: `${activeTheme.label.replace(/\s+/g, "_")}_Statement_${new Date().toISOString().split("T")[0]}`,
				title: `${activeTheme.label} Statement`,
				subtitle: "Labor Wages, Unload Logs and Financial Summary",
				themeColor: hexToRgb(activeTheme.colorHex),
				metadata: {
					Section: activeTheme.label,
					"Date Range": periodLabel,
					Product: activeProduct === "all" ? "All Products" : activeProduct,
					Search: search || "All",
					Generated: new Date().toLocaleString("en-IN"),
					"Total Entries": `${exportRecords.length} records`,
				},
				columns,
				rows,
				grandTotalRow,
			};

			if (format === "pdf") {
				exportStatementToPdf(options);
			} else {
				exportStatementToExcel(options);
			}
		} catch (err: any) {
			console.error("Export error:", err);
			alert("Failed to export statement: " + (err?.message || "Unknown error"));
		} finally {
			setIsExporting(false);
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
		navigate({
			to: "/dashboard/admin/warehouse/$recordId",
			params: { recordId: id },
		});
	};

	const isEmpty = !data || data.meta.total === 0;

	function hexToRgb(hex: string): { r: number; g: number; b: number } {
		let clean = hex.replace("#", "").trim();
		if (clean.length === 3) {
			clean = clean
				.split("")
				.map((c) => c + c)
				.join("");
		}
		if (clean.length !== 6) {
			return { r: 0.145, g: 0.388, b: 0.921 };
		}
		const num = parseInt(clean, 16);
		return {
			r: ((num >> 16) & 255) / 255,
			g: ((num >> 8) & 255) / 255,
			b: (num & 255) / 255,
		};
	}

	// Theme color styles per warehouse
	const getThemeConfig = (wh: WarehouseItem) => {
		const isJAS = wh.code.toUpperCase() === "JAS";
		const isJKM = wh.code.toUpperCase() === "JKM";
		const color = wh.color || "#2563EB";

		return {
			label: wh.name,
			sub:
				wh.description ||
				(isJAS
					? "Owner's Business (Primary)"
					: isJKM
						? "Secondary Warehouse"
						: "Independent Warehouse"),
			colorHex: color,
			badge: isJAS ? "Primary" : wh.isSystem ? "System" : null,
			icon: isJAS ? (
				<span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white font-black text-xs shadow-xs">
					J
				</span>
			) : isJKM ? (
				<Building2Icon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
			) : (
				<div
					className="flex h-6 w-6 items-center justify-center rounded text-white font-bold text-xs shadow-xs"
					style={{ backgroundColor: color }}
				>
					{wh.name.charAt(0).toUpperCase()}
				</div>
			),
		};
	};

	const activeTheme = getThemeConfig(activeWarehouse);

	return (
		<div className="w-full space-y-6">
			{/* Header */}
			<div className="flex flex-wrap justify-between items-center gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						{activeTheme.icon}
						<h1 className="text-2xl font-bold tracking-tight">
							{activeTheme.label}
						</h1>
					</div>
					<p className="text-muted-foreground text-sm">
						Independent warehouse records, labour wages, and unloading logs.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="outline" disabled={isExporting || isEmpty}>
									<DownloadIcon className="h-4 w-4 mr-1.5" />
									{isExporting ? "Exporting..." : "Download"}
								</Button>
							}
						/>
						<DropdownMenuContent align="end" className="w-44">
							<DropdownMenuItem onClick={() => handleExport("pdf")}>
								<FileTextIcon className="h-4 w-4 mr-2 text-rose-500" />
								Download PDF
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport("excel")}>
								<FileSpreadsheetIcon className="h-4 w-4 mr-2 text-emerald-600" />
								Download Excel
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<WarehouseDialog
						key={activeSection}
						mode="create"
						defaultSection={activeSection}
					/>
				</div>
			</div>

			{/* Dynamic Warehouse Selection & Search Bar */}
			<div className="space-y-3">
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
					<div className="relative flex-1 max-w-md">
						<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
						<Input
							placeholder="Search warehouses by name or description..."
							value={warehouseSearch}
							onChange={(e) => setWarehouseSearch(e.target.value)}
							className="pl-9 pr-8 h-9"
						/>
						{warehouseSearch && (
							<button
								type="button"
								onClick={() => setWarehouseSearch("")}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								<XIcon className="h-4 w-4" />
							</button>
						)}
					</div>
					{isAdmin && (
						<Button
							size="sm"
							onClick={() => setManagementModal({ open: true, mode: "create" })}
							className="gap-1.5 shadow-xs"
						>
							<PlusIcon className="h-4 w-4" />
							Add Warehouse
						</Button>
					)}
				</div>

				{/* Dynamic Warehouse Cards Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
					{filteredWarehouses.map((wh) => {
						const cfg = getThemeConfig(wh);
						const isSelected =
							activeSection.toLowerCase() === wh.code.toLowerCase();
						return (
							<div
								key={wh.id}
								className={cn(
									"group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all shadow-2xs hover:shadow-md",
									isSelected
										? "border-2 shadow-sm bg-card ring-1 ring-offset-1"
										: "bg-card hover:border-muted-foreground/40 text-muted-foreground",
								)}
								style={{
									borderColor: isSelected ? cfg.colorHex : undefined,
								}}
							>
								<div className="flex items-start justify-between gap-2">
									<button
										type="button"
										onClick={() => handleSectionChange(wh.code)}
										className="flex items-center gap-3 flex-1 text-left cursor-pointer outline-none focus-visible:underline"
									>
										<div className="shrink-0">{cfg.icon}</div>
										<div>
											<div className="font-bold text-sm text-foreground flex items-center gap-1.5">
												{cfg.label}
												{cfg.badge && (
													<span
														className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded"
														style={{
															backgroundColor: `${cfg.colorHex}20`,
															color: cfg.colorHex,
														}}
													>
														{cfg.badge}
													</span>
												)}
											</div>
											<div className="text-xs text-muted-foreground line-clamp-1">
												{cfg.sub}
											</div>
										</div>
									</button>

									{/* Custom warehouse actions for admin */}
									{isAdmin && !wh.isSystem && (
										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-muted-foreground hover:text-foreground"
												onClick={() =>
													setManagementModal({
														open: true,
														mode: "edit",
														warehouse: wh,
													})
												}
												title="Edit Warehouse"
											>
												<PencilIcon className="h-3.5 w-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-destructive hover:bg-destructive/10"
												onClick={() => setWarehouseToDelete(wh)}
												title="Delete Warehouse"
											>
												<Trash2Icon className="h-3.5 w-3.5" />
											</Button>
										</div>
									)}
								</div>

								<button
									type="button"
									onClick={() => handleSectionChange(wh.code)}
									className="mt-3 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground w-full cursor-pointer outline-none"
								>
									<span>
										{wh.recordCount ?? 0} record
										{(wh.recordCount ?? 0) === 1 ? "" : "s"}
									</span>
									{isSelected && (
										<span
											className="font-semibold text-[11px] flex items-center gap-1"
											style={{ color: cfg.colorHex }}
										>
											<CheckIcon className="h-3 w-3" /> Active
										</span>
									)}
								</button>
							</div>
						);
					})}

					{/* Add New Warehouse Card at the end of the grid if user is admin */}
					{isAdmin && !warehouseSearch && (
						<button
							type="button"
							onClick={() => setManagementModal({ open: true, mode: "create" })}
							className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed hover:border-primary/60 bg-muted/20 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-center min-h-[100px] gap-2"
						>
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
								<PlusIcon className="h-4 w-4" />
							</div>
							<div className="font-semibold text-xs">Add New Warehouse</div>
						</button>
					)}
				</div>

				{filteredWarehouses.length === 0 && warehouseSearch && (
					<div className="p-6 text-center text-sm text-muted-foreground rounded-xl border border-dashed">
						No warehouses matching "
						<span className="font-semibold text-foreground">
							{warehouseSearch}
						</span>
						" found.
					</div>
				)}
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
				{/* Search, Product Filter & Custom Date Filter */}
				<div className="flex flex-wrap items-center gap-3 text-sm w-full">
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
								type="button"
								onClick={() => handleSearchChange("")}
								className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
							>
								<XIcon className="h-4 w-4" />
							</button>
						)}
					</div>

					{/* Date Filter & Period Select */}
					<div className="flex flex-wrap items-center gap-2">
						<Select value={period} onValueChange={handlePeriodChange}>
							<SelectTrigger className="w-[145px] h-9 text-xs">
								<SelectValue placeholder="Period" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{periodOptions.map((option) => (
										<SelectItem
											key={option.value}
											value={option.value}
											className="text-xs"
										>
											{option.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>

						{period === "custom" && (
							<div className="flex flex-wrap items-center gap-1.5">
								<div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-md border border-border">
									<CalendarIcon className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />
									<Input
										type="date"
										aria-label="Start date"
										value={startDate}
										max={endDate || undefined}
										onChange={(e) =>
											handleDateChange("startDate", e.target.value)
										}
										className={cn(
											"h-8 w-32 text-xs bg-background",
											isDateRangeInvalid &&
												"border-destructive focus-visible:ring-destructive text-destructive",
										)}
									/>
									<span className="text-muted-foreground text-xs px-0.5">
										to
									</span>
									<Input
										type="date"
										aria-label="End date"
										value={endDate}
										min={startDate || undefined}
										onChange={(e) =>
											handleDateChange("endDate", e.target.value)
										}
										className={cn(
											"h-8 w-32 text-xs bg-background",
											isDateRangeInvalid &&
												"border-destructive focus-visible:ring-destructive text-destructive",
										)}
									/>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handlePeriodChange("all_time")}
										title="Reset date range to All Time"
										className="h-8 w-8 text-muted-foreground hover:text-foreground"
									>
										<RotateCcwIcon className="h-3.5 w-3.5" />
									</Button>
								</div>
								{isDateRangeInvalid && (
									<div className="flex items-center gap-1 text-xs text-destructive font-medium">
										<AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
										<span>Start date cannot be later than end date</span>
									</div>
								)}
							</div>
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
							<span>
								Total Quantity:{" "}
								<strong className="text-foreground">
									{selectedStats.totalUnloads}
								</strong>
							</span>
							<span>
								Total Value:{" "}
								<strong className="text-foreground">
									{formatWarehouseCurrency(selectedStats.totalValue)}
								</strong>
							</span>
							<span>
								Own Staff Salary:{" "}
								<strong className="text-primary">
									{formatWarehouseCurrency(selectedStats.totalWorkersSalary)}
								</strong>
							</span>
							<span>
								Union Salary:{" "}
								<strong className="text-purple-600 dark:text-purple-400">
									{formatWarehouseCurrency(selectedStats.totalUnionSalary)}
								</strong>
							</span>
						</div>
					</div>
					<div className="flex gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => setSelectedIds([])}
						>
							Clear Selection
						</Button>
					</div>
				</div>
			)}

			{/* Records Table */}
			{isEmpty ? (
				<div className="flex flex-col items-center justify-center p-12 border rounded-lg bg-card text-center space-y-2">
					<p className="text-muted-foreground text-sm">
						No {activeTheme.label} records found.
					</p>
					{(startDate || endDate || search) && (
						<p className="text-xs text-muted-foreground">
							Try clearing date or search filters.
						</p>
					)}
				</div>
			) : (
				<div className="rounded-lg border bg-card shadow-2xs overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/50">
								<TableHead className="w-10">
									<Checkbox
										checked={
											data.data.length > 0 &&
											selectedIds.length === data.data.length
										}
										onCheckedChange={(checked) => handleSelectAll(!!checked)}
									/>
								</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Product Name</TableHead>
								<TableHead className="text-right">Total Worker</TableHead>
								<TableHead className="text-right">Regular Worker</TableHead>
								<TableHead className="text-right">Union Worker</TableHead>
								<TableHead className="text-right">Per Bag Price</TableHead>
								<TableHead className="text-right">Quantity (Unloads)</TableHead>
								<TableHead className="text-right">Own Staff Salary</TableHead>
								<TableHead className="text-right">Union Salary</TableHead>
								<TableHead className="text-right">Total Value</TableHead>
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
											isSelected && "bg-muted/40",
										)}
									>
										<TableCell onClick={(e) => e.stopPropagation()}>
											<Checkbox
												checked={isSelected}
												onCheckedChange={(checked) =>
													handleSelectRow(record.id, !!checked)
												}
											/>
										</TableCell>
										<TableCell className="font-medium whitespace-nowrap">
											<div className="flex items-center gap-1.5">
												<CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
												{record.recordDate}
											</div>
										</TableCell>
										<TableCell className="font-medium">
											{record.productName || "—"}
										</TableCell>
										<TableCell className="text-right font-semibold">
											{record.workersCount + record.unionCount}
										</TableCell>
										<TableCell className="text-right font-medium">
											{record.workersCount}
										</TableCell>
										<TableCell className="text-right text-purple-600 dark:text-purple-400 font-medium">
											{record.unionCount}
										</TableCell>
										<TableCell className="text-right">
											{formatWarehouseCurrency(record.ratePerUnload)}
										</TableCell>
										<TableCell className="text-right font-semibold">
											{record.totalUnloads}
										</TableCell>
										<TableCell className="text-right font-bold text-primary">
											{formatWarehouseCurrency(record.totalWorkersSalary)}
										</TableCell>
										<TableCell className="text-right text-purple-600 dark:text-purple-400">
											{formatWarehouseCurrency(record.totalUnionSalary)}
										</TableCell>
										<TableCell className="text-right font-bold text-foreground">
											{formatWarehouseCurrency(record.totalValue)}
										</TableCell>
										<TableCell
											className="text-right"
											onClick={(e) => e.stopPropagation()}
										>
											<div className="flex items-center justify-end gap-1">
												<WarehouseDialog
													key={`${record.id}-${record.updatedAt || ""}`}
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
													onClick={() =>
														handleDelete(
															record.id,
															`${record.section} Record (${record.recordDate})`,
														)
													}
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
				onOpenChange={(open) =>
					setAccessDeniedState((prev) => ({ ...prev, open }))
				}
				pageName="warehouse"
				resourceType="warehouse_record"
				resourceId={accessDeniedState.recordId}
				primaryLabel={accessDeniedState.label}
			/>

			<WarehouseManagementDialog
				mode={managementModal.mode}
				warehouse={managementModal.warehouse}
				open={managementModal.open}
				onOpenChange={(open) =>
					setManagementModal((prev) => ({ ...prev, open }))
				}
				onSuccess={(wh) => {
					handleSectionChange(wh.code);
				}}
			/>

			<AlertDialog
				open={!!warehouseToDelete}
				onOpenChange={(open) => {
					if (!open) {
						setWarehouseToDelete(null);
						setDeleteError(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {warehouseToDelete?.name}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this warehouse? This action cannot
							be undone.
							{(warehouseToDelete?.recordCount ?? 0) > 0 && (
								<span className="block mt-2 text-destructive font-medium">
									Warning: This warehouse contains{" "}
									{warehouseToDelete?.recordCount} record(s). You must delete or
									remove all records before this warehouse can be deleted.
								</span>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{deleteError && (
						<div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
							{deleteError}
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={() => {
								setWarehouseToDelete(null);
								setDeleteError(null);
							}}
						>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								if (warehouseToDelete) {
									deleteWarehouseMutation.mutate({
										id: warehouseToDelete.id,
									} as any);
								}
							}}
							disabled={
								deleteWarehouseMutation.isPending ||
								(warehouseToDelete?.recordCount ?? 0) > 0
							}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteWarehouseMutation.isPending
								? "Deleting..."
								: "Delete Warehouse"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
