import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	AlertCircleIcon,
	CalendarIcon,
	DownloadIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	PackageIcon,
	RotateCcwIcon,
	TrendingUpIcon,
	TruckIcon,
	UserIcon,
} from "lucide-react";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	FilterAutocomplete,
	type FilterOption,
} from "@/components/ui/filter-autocomplete";
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
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";

const periodSchema = v.picklist([
	"all_time",
	"last_7d",
	"last_30d",
	"last_3m",
	"last_6m",
	"last_12m",
	"custom",
]);

type Period = v.InferOutput<typeof periodSchema>;

const querySchema = v.object({
	period: v.optional(v.fallback(periodSchema, "all_time"), "all_time"),
	startDate: v.optional(v.string()),
	endDate: v.optional(v.string()),
	driverId: v.optional(v.string()),
	driverSearch: v.optional(v.string()),
	vehicleId: v.optional(v.string()),
	vehicleSearch: v.optional(v.string()),
	product: v.optional(v.string()),
	search: v.optional(v.string()),
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 20), 20),
});

export const Route = createFileRoute("/dashboard/admin/revenue/")({
	validateSearch: querySchema,
	loaderDeps: ({
		search: {
			period,
			startDate,
			endDate,
			driverId,
			driverSearch,
			vehicleId,
			vehicleSearch,
			product,
			search,
			offset,
			limit,
		},
	}) => ({
		period,
		startDate,
		endDate,
		driverId,
		driverSearch,
		vehicleId,
		vehicleSearch,
		product,
		search,
		offset,
		limit,
	}),
	loader: ({ context: { orpc: orpcClient, queryClient }, deps: query }) => {
		const isDateRangeInvalid = !!(
			query.period === "custom" &&
			query.startDate &&
			query.endDate &&
			query.startDate > query.endDate
		);
		queryClient.prefetchQuery(
			orpcClient.admin.revenue.list.queryOptions({
				input: {
					period: query.period,
					startDate: isDateRangeInvalid ? undefined : query.startDate,
					endDate: isDateRangeInvalid ? undefined : query.endDate,
					driverId: query.driverId,
					driverSearch: query.driverSearch,
					vehicleId: query.vehicleId,
					vehicleSearch: query.vehicleSearch,
					product: query.product,
					search: query.search,
					limit: query.limit,
					offset: query.offset,
				},
			}),
		);
	},
	component: RouteComponent,
});

const periodOptions = [
	{ value: "all_time", label: "All time" },
	{ value: "last_7d", label: "Last 7 days" },
	{ value: "last_30d", label: "Last 30 days" },
	{ value: "last_3m", label: "Last 3 months" },
	{ value: "last_6m", label: "Last 6 months" },
	{ value: "last_12m", label: "Last 12 months" },
	{ value: "custom", label: "Custom date range" },
] as const;

function RouteComponent() {
	return (
		<Suspense
			fallback={
				<div className="p-6 text-sm text-muted-foreground">
					Loading Revenue records...
				</div>
			}
		>
			<RevenueTableContent />
		</Suspense>
	);
}

function RevenueTableContent() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const query = Route.useSearch();
	const deferredQuery = useDeferredValue(query);
	const [isExporting, setIsExporting] = useState(false);

	const period = query.period || "all_time";
	const startDate = query.startDate || "";
	const endDate = query.endDate || "";

	const isDateRangeInvalid = !!(
		query.period === "custom" &&
		query.startDate &&
		query.endDate &&
		query.startDate > query.endDate
	);

	// Primary Revenue list query
	const { data } = useSuspenseQuery({
		...orpc.admin.revenue.list.queryOptions({
			input: {
				period: deferredQuery.period,
				startDate: isDateRangeInvalid ? undefined : deferredQuery.startDate,
				endDate: isDateRangeInvalid ? undefined : deferredQuery.endDate,
				driverId: deferredQuery.driverId,
				driverSearch: deferredQuery.driverSearch,
				vehicleId: deferredQuery.vehicleId,
				vehicleSearch: deferredQuery.vehicleSearch,
				product: deferredQuery.product,
				search: deferredQuery.search,
				limit: deferredQuery.limit,
				offset: deferredQuery.offset,
			},
		}),
	});

	// Query Drivers list for Autocomplete
	const { data: driversDataRaw, isLoading: isLoadingDrivers } = useQuery({
		...orpc.accountant.drivers.list.queryOptions({
			input: {
				offset: 0,
				limit: 500,
			},
		}),
	});

	// Query Vehicles list for Autocomplete
	const { data: vehiclesDataRaw, isLoading: isLoadingVehicles } = useQuery({
		...orpc.accountant.vehicles.list.queryOptions({
			input: {
				offset: 0,
				limit: 500,
			},
		}),
	});

	// Query Distinct Products for Autocomplete
	const { data: productsDataRaw, isLoading: isLoadingProducts } = useQuery({
		...(orpc as any).accountant.products.distinct.queryOptions({
			input: {},
		}),
	});

	// Build Driver options
	const driverOptions: FilterOption[] = useMemo(() => {
		const list = (driversDataRaw as any)?.data || [];
		return list.map((d: any) => ({
			id: d.id,
			label: d.name,
			sublabel: d.phoneNumber || undefined,
		}));
	}, [driversDataRaw]);

	// Build Vehicle options
	const vehicleOptions: FilterOption[] = useMemo(() => {
		const list = (vehiclesDataRaw as any)?.data || [];
		return list.map((v: any) => ({
			id: v.id,
			label: v.name,
			sublabel: v.licensePlate || undefined,
		}));
	}, [vehiclesDataRaw]);

	// Build Product options
	const productOptions: FilterOption[] = useMemo(() => {
		const serverProducts = (productsDataRaw as any)?.products || [];
		const tableProducts = (data?.data || [])
			.map((r: any) => r.productName)
			.filter(Boolean);
		const set = new Set<string>([...serverProducts, ...tableProducts]);
		return Array.from(set)
			.filter(Boolean)
			.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
			.map((p) => ({ label: p, value: p }));
	}, [productsDataRaw, data]);

	// Active Driver display label
	const activeDriverLabel = useMemo(() => {
		if (query.driverId) {
			const found = driverOptions.find((d) => d.id === query.driverId);
			if (found) return found.label;
		}
		return query.driverSearch || "";
	}, [query.driverId, query.driverSearch, driverOptions]);

	// Active Vehicle display label
	const activeVehicleLabel = useMemo(() => {
		if (query.vehicleId) {
			const found = vehicleOptions.find((v) => v.id === query.vehicleId);
			if (found) return found.label;
		}
		return query.vehicleSearch || "";
	}, [query.vehicleId, query.vehicleSearch, vehicleOptions]);

	// Active Product display label
	const activeProductLabel = query.product || "";

	// Handlers for independent filters
	const handleDriverSelect = (opt: FilterOption | null) => {
		navigate({
			search: (prev) => {
				const next = { ...prev, offset: 0 };
				if (opt) {
					if (opt.id) {
						next.driverId = opt.id;
						delete next.driverSearch;
					} else {
						delete next.driverId;
						next.driverSearch = opt.label;
					}
				} else {
					delete next.driverId;
					delete next.driverSearch;
				}
				return next;
			},
		});
	};

	const handleVehicleSelect = (opt: FilterOption | null) => {
		navigate({
			search: (prev) => {
				const next = { ...prev, offset: 0 };
				if (opt) {
					if (opt.id) {
						next.vehicleId = opt.id;
						delete next.vehicleSearch;
					} else {
						delete next.vehicleId;
						next.vehicleSearch = opt.label;
					}
				} else {
					delete next.vehicleId;
					delete next.vehicleSearch;
				}
				return next;
			},
		});
	};

	const handleProductSelect = (opt: FilterOption | null) => {
		navigate({
			search: (prev) => {
				const next = { ...prev, offset: 0 };
				if (opt?.label) {
					next.product = opt.label;
				} else {
					delete next.product;
				}
				return next;
			},
		});
	};

	const handlePeriodChange = (value: Period | null) => {
		if (value === null) return;
		if (value === "custom") {
			const today = new Date().toISOString().split("T")[0];
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			navigate({
				search: (prev) => ({
					...prev,
					period: "custom",
					startDate: prev.startDate || thirtyDaysAgo,
					endDate: prev.endDate || today,
					offset: 0,
				}),
			});
		} else {
			navigate({
				search: (prev) => ({
					...prev,
					period: value,
					startDate: undefined,
					endDate: undefined,
					offset: 0,
				}),
			});
		}
	};

	const handleDateChange = (field: "startDate" | "endDate", value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				period: "custom" as any,
				[field]: value || undefined,
				offset: 0,
			}),
		});
	};

	const hasActiveFilters = Boolean(
		query.driverId ||
			query.driverSearch ||
			query.vehicleId ||
			query.vehicleSearch ||
			query.product ||
			query.search ||
			(query.period && query.period !== "all_time") ||
			query.startDate ||
			query.endDate,
	);

	const handleResetAllFilters = () => {
		navigate({
			search: () => ({
				period: "all_time",
				offset: 0,
				limit: query.limit || 20,
			}),
		});
	};

	const handleRowClick = (id: string) => {
		navigate({
			to: "/dashboard/admin/revenue/$revenueId",
			params: { revenueId: id },
		});
	};

	const totalRevenueAmount = data?.meta?.totalAmount ?? 0;
	const totalCount = data?.meta?.total ?? 0;
	const isEmpty = !data || data.data.length === 0;

	// Export statement generator
	const handleExport = async (format: "pdf" | "excel") => {
		if (!data || data.meta.total === 0) {
			alert("No Revenue records to export for the selected filters.");
			return;
		}

		setIsExporting(true);
		try {
			let exportRecords = data.data;
			if (data.meta.total > data.data.length) {
				const fullResult = await queryClient.fetchQuery<any>(
					orpc.admin.revenue.list.queryOptions({
						input: {
							limit: 10000,
							offset: 0,
							driverId: query.driverId,
							driverSearch: query.driverSearch,
							vehicleId: query.vehicleId,
							vehicleSearch: query.vehicleSearch,
							product: query.product,
							search: query.search,
							period: query.period,
							startDate: isDateRangeInvalid ? undefined : query.startDate,
							endDate: isDateRangeInvalid ? undefined : query.endDate,
						},
					}),
				);
				if (fullResult?.data) {
					exportRecords = fullResult.data;
				}
			}

			let grandTotalRevenue = 0;
			for (const r of exportRecords) {
				grandTotalRevenue += Number(r.amount || 0);
			}

			const exportColumns: ExportColumn[] = [
				{ header: "Vehicle", key: "vehicle", width: 140, align: "left" },
				{ header: "Driver", key: "driver", width: 130, align: "left" },
				{ header: "Date", key: "date", width: 100, align: "left" },
				{ header: "Product", key: "product", width: 140, align: "left" },
				{ header: "Depo", key: "depo", width: 100, align: "left" },
				{
					header: "Delivery Location",
					key: "location",
					width: 120,
					align: "left",
				},
				{ header: "Amount", key: "amount", width: 120, align: "right" },
			];

			const rows = exportRecords.map((item: any) => ({
				vehicle: item.vehicleName
					? `${item.vehicleName}${item.vehicleLicensePlate ? ` (${item.vehicleLicensePlate.toUpperCase()})` : ""}`
					: item.vehicleLicensePlate || "—",
				driver: item.driverName || "—",
				date: item.revenueDate
					? new Date(item.revenueDate).toLocaleDateString("en-IN", {
							day: "2-digit",
							month: "short",
							year: "numeric",
						})
					: "—",
				product: item.productName || "—",
				depo: item.depo || "—",
				location: item.deliveryLocation || "—",
				amount: `Rs. ${Number(item.amount || 0).toLocaleString("en-IN", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})}`,
			}));

			const grandTotalRow = {
				vehicle: "GRAND TOTAL",
				driver: `${exportRecords.length} Records`,
				date: "—",
				product: "—",
				depo: "—",
				location: "—",
				amount: `Rs. ${grandTotalRevenue.toLocaleString("en-IN", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})}`,
			};

			const periodLabel =
				query.period === "custom" && query.startDate && query.endDate
					? `${query.startDate} to ${query.endDate}`
					: periodOptions.find((p) => p.value === query.period)?.label ||
						query.period ||
						"All Time";

			const activeDriverName =
				driverOptions.find((d) => d.id === query.driverId)?.label ||
				query.driverSearch;
			const activeVehicleName =
				vehicleOptions.find((v) => v.id === query.vehicleId)?.label ||
				query.vehicleSearch;

			const options: StatementExportOptions = {
				filename: `Revenue_Statement_${new Date().toISOString().split("T")[0]}`,
				title: "Revenue Statement (Admin)",
				subtitle: "Admin Revenue Listing Derived from Journal Entries",
				themeColor: { r: 0.1, g: 0.65, b: 0.3 },
				metadata: {
					"Driver Filter": activeDriverName || "All Drivers",
					"Vehicle Filter": activeVehicleName || "All Vehicles",
					"Product Filter": query.product || "All Products",
					"Date Range": periodLabel,
					"Export Date": new Date().toLocaleString("en-IN"),
					"Total Records": `${exportRecords.length} entries`,
				},
				columns: exportColumns,
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

	return (
		<div className="w-full space-y-6">
			{/* Top Header & Overview */}
			<div className="flex flex-wrap justify-between items-center gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<TrendingUpIcon className="h-6 w-6 text-green-600" />
						<h1 className="text-2xl font-bold tracking-tight">
							Revenue Table (Admin)
						</h1>
					</div>
					<p className="text-muted-foreground text-sm">
						Admin-only view of all revenue entries derived directly from
						Journal.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<Card className="min-w-[200px]">
						<CardHeader className="p-4 pb-1">
							<CardDescription className="text-xs">
								Total Filtered Revenue
							</CardDescription>
							<CardTitle className="text-xl font-bold text-green-600">
								{formatINR(totalRevenueAmount)}
							</CardTitle>
						</CardHeader>
						<CardContent className="p-4 pt-0 text-xs text-muted-foreground">
							{totalCount} total revenue entries
						</CardContent>
					</Card>

					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant="outline"
									disabled={isExporting || totalCount === 0}
									className="h-10"
								>
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
				</div>
			</div>

			{/* Three Independent Autocomplete Search Bars + Date Filter */}
			<div className="flex flex-col gap-3 p-4 rounded-lg border bg-card shadow-2xs">
				<div className="flex flex-wrap items-center gap-3">
					{/* 1. Driver Autocomplete Search */}
					<FilterAutocomplete
						value={activeDriverLabel}
						selectedId={query.driverId}
						onSelect={handleDriverSelect}
						placeholder="Filter driver..."
						icon={<UserIcon className="h-4 w-4 text-muted-foreground" />}
						options={driverOptions}
						isLoading={isLoadingDrivers}
						className="flex-1 min-w-[200px]"
						ariaLabel="Filter by driver"
					/>

					{/* 2. Vehicle Autocomplete Search */}
					<FilterAutocomplete
						value={activeVehicleLabel}
						selectedId={query.vehicleId}
						onSelect={handleVehicleSelect}
						placeholder="Filter vehicle name / number..."
						icon={<TruckIcon className="h-4 w-4 text-muted-foreground" />}
						options={vehicleOptions}
						isLoading={isLoadingVehicles}
						className="flex-1 min-w-[220px]"
						ariaLabel="Filter by vehicle name or registration number"
					/>

					{/* 3. Product Autocomplete Search */}
					<FilterAutocomplete
						value={activeProductLabel}
						onSelect={handleProductSelect}
						placeholder="Filter product..."
						icon={<PackageIcon className="h-4 w-4 text-muted-foreground" />}
						options={productOptions}
						isLoading={isLoadingProducts}
						className="flex-1 min-w-[200px]"
						ariaLabel="Filter by product name"
					/>

					{/* 4. Date Range & Period Select */}
					<Select value={period} onValueChange={handlePeriodChange}>
						<SelectTrigger className="w-[160px] h-9 text-xs">
							<SelectValue placeholder="Select period" />
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

					{/* Reset All Filters Button */}
					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleResetAllFilters}
							className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
							title="Reset all filters"
						>
							<RotateCcwIcon className="h-3.5 w-3.5 mr-1" />
							Reset
						</Button>
					)}
				</div>

				{/* Custom Date Inputs if custom period is selected */}
				{period === "custom" && (
					<div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
						<div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-md border border-border">
							<CalendarIcon className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />
							<Input
								type="date"
								aria-label="Start date"
								value={startDate}
								max={endDate || undefined}
								onChange={(e) => handleDateChange("startDate", e.target.value)}
								className={cn(
									"h-8 w-32 text-xs bg-background",
									isDateRangeInvalid &&
										"border-destructive focus-visible:ring-destructive text-destructive",
								)}
							/>
							<span className="text-muted-foreground text-xs px-0.5">to</span>
							<Input
								type="date"
								aria-label="End date"
								value={endDate}
								min={startDate || undefined}
								onChange={(e) => handleDateChange("endDate", e.target.value)}
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

			{/* Table */}
			{isEmpty ? (
				<div className="flex flex-col items-center justify-center p-12 border rounded-lg bg-card text-center space-y-2">
					<p className="text-muted-foreground text-sm">
						No revenue entries found.
					</p>
					{hasActiveFilters && (
						<p className="text-xs text-muted-foreground">
							Try clearing or adjusting your active filters.
						</p>
					)}
				</div>
			) : (
				<div className="rounded-lg border bg-card shadow-2xs overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/50">
								<TableHead>Vehicle</TableHead>
								<TableHead>Driver</TableHead>
								<TableHead>Date</TableHead>
								<TableHead className="text-right">Revenue Amount</TableHead>
								<TableHead>Product Name</TableHead>
								<TableHead>Depo</TableHead>
								<TableHead>Delivery Location</TableHead>
								<TableHead>Created By</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.data.map((item: any) => (
								<TableRow
									key={item.id}
									onClick={() => handleRowClick(item.id)}
									className="cursor-pointer transition-colors hover:bg-muted/60"
								>
									<TableCell className="font-medium whitespace-nowrap">
										{item.vehicleName ? (
											<div>
												<div>{item.vehicleName}</div>
												{item.vehicleLicensePlate && (
													<div className="text-xs text-muted-foreground font-normal">
														{item.vehicleLicensePlate}
													</div>
												)}
											</div>
										) : (
											item.vehicleLicensePlate || "—"
										)}
									</TableCell>
									<TableCell>{item.driverName || "—"}</TableCell>
									<TableCell className="whitespace-nowrap">
										{item.revenueDate
											? new Date(item.revenueDate).toLocaleDateString("en-IN", {
													day: "2-digit",
													month: "short",
													year: "numeric",
												})
											: "—"}
									</TableCell>
									<TableCell className="text-right font-semibold text-green-600">
										{formatINR(item.amount)}
									</TableCell>
									<TableCell>{item.productName || "—"}</TableCell>
									<TableCell>{item.depo || "—"}</TableCell>
									<TableCell>{item.deliveryLocation || "—"}</TableCell>
									<TableCell className="text-xs text-muted-foreground">
										{item.createdByName || "—"}
									</TableCell>
									<TableCell
										className="text-right"
										onClick={(e) => e.stopPropagation()}
									>
										<div className="flex items-center justify-end gap-1">
											<Button
												variant="ghost"
												size="sm"
												className="h-8 px-2 text-xs"
												onClick={() => handleRowClick(item.id)}
											>
												Details
											</Button>
											{item.journalEntryId && (
												<Button
													variant="ghost"
													size="sm"
													className="h-8 px-2 text-xs"
													render={
														<Link
															to="/dashboard/accountant/journal/$journalId"
															params={{ journalId: item.journalEntryId }}
														>
															Journal
														</Link>
													}
												/>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
