import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	AlertCircleIcon,
	ArrowUpDown,
	CalendarIcon,
	CoinsIcon,
	RotateCcwIcon,
	UserIcon,
	DownloadIcon,
	FileTextIcon,
	FileSpreadsheetIcon,
} from "lucide-react";
import { Suspense, useDeferredValue, useState } from "react";
import * as v from "valibot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BataSearchAutocomplete } from "./-index/bata-search-autocomplete";
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
import { parseDateValue } from "@/lib/date";
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";
import {
	exportStatementToPdf,
	exportStatementToExcel,
	type ExportColumn,
	type StatementExportOptions,
} from "@/lib/statement-export";

const statusSchema = v.fallback(v.picklist(["all", "paid", "unpaid"]), "all");
const periodSchema = v.fallback(
	v.picklist(["all_time", "last_7d", "last_30d", "last_6m", "last_12m", "custom"]),
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
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 20), 20),
	search: v.optional(v.string()),
	driverId: v.optional(v.string()),
	status: v.optional(statusSchema, "all"),
	period: v.optional(periodSchema, "all_time"),
	startDate: v.optional(v.string()),
	endDate: v.optional(v.string()),
	sortBy: v.optional(
		v.fallback(
			v.picklist([
				"driverName",
				"vehicleName",
				"bataAmount",
				"transactionDate",
				"createdAt",
				"status",
			]),
			"transactionDate",
		),
		"transactionDate",
	),
	sortOrder: v.optional(v.fallback(v.picklist(["asc", "desc"]), "desc"), "desc"),
});

interface BataItem {
	id: string;
	journal_entry_id: string;
	driver_id: string;
	vehicle_id: string;
	product_name: string | null;
	bata_amount: number;
	status: "paid" | "unpaid";
	paid_by: string | null;
	paid_at: string | null;
	transaction_date?: string;
	gross_revenue?: number;
	quantity?: number;
	per_item_rate?: number;
	vehicle_name?: string;
	vehicle_license_plate?: string;
	driver_name?: string;
	driver_phone_number?: string;
	created_by_name?: string;
	created_by_image?: string;
	paid_by_name?: string;
}

interface BataListResponse {
	data: BataItem[];
	meta: {
		total: number;
		totalBata?: number;
		paidBata?: number;
		unpaidBata?: number;
	};
}

export const Route = createFileRoute("/dashboard/accountant/bata/")({
	validateSearch: querySchema,
	loaderDeps: ({ search: { offset, limit, search, driverId, status, period, startDate, endDate, sortBy, sortOrder } }) => ({
		offset,
		limit,
		search,
		driverId,
		status,
		period,
		startDate,
		endDate,
		sortBy,
		sortOrder,
	}),
	loader: ({ context: { orpc, queryClient }, deps: query }) => {
		const isCustomInvalid = Boolean(
			query.period === "custom" && query.startDate && query.endDate && query.startDate > query.endDate
		);
		queryClient.prefetchQuery(
			(orpc as any).accountant.bata.list.queryOptions({
				input: {
					...query,
					status: "all",
					search: query.driverId ? undefined : query.search,
					startDate: isCustomInvalid ? undefined : query.startDate,
					endDate: isCustomInvalid ? undefined : query.endDate,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Suspense fallback={<BataListSkeleton />}>
			<BataList />
		</Suspense>
	);
}

function BataListSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-2">
				{[1, 2].map((i) => (
					<Card key={i} className="animate-pulse">
						<CardHeader className="h-16 bg-muted/40" />
						<CardContent className="h-12 bg-muted/20" />
					</Card>
				))}
			</div>
			<div className="h-64 rounded-lg bg-muted/20 animate-pulse" />
		</div>
	);
}

function BataList() {
	const _query = Route.useSearch();
	const query = useDeferredValue(_query);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [isExporting, setIsExporting] = useState(false);

	const isCustom = query.period === "custom";
	const isDateRangeInvalid = Boolean(
		isCustom && query.startDate && query.endDate && query.startDate > query.endDate
	);

	const { data } = useSuspenseQuery<BataListResponse>({
		...(orpc as any).accountant.bata.list.queryOptions({
			input: {
				limit: query.limit,
				offset: query.offset,
				search: query.driverId ? undefined : query.search,
				driverId: query.driverId,
				status: "all",
				period: query.period,
				startDate: isDateRangeInvalid ? undefined : query.startDate,
				endDate: isDateRangeInvalid ? undefined : query.endDate,
				sortBy: query.sortBy,
				sortOrder: query.sortOrder,
			},
		}),
	});

	const handlePeriodChange = (newPeriod: string) => {
		navigate({
			to: "/dashboard/accountant/bata",
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
		navigate({
			to: "/dashboard/accountant/bata",
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

	const handleSearchChange = (newSearch: string | undefined, newDriverId: string | undefined) => {
		navigate({
			to: "/dashboard/accountant/bata",
			search: (prev) => {
				const next = { ...prev, offset: 0 };
				if (newSearch) {
					next.search = newSearch;
				} else {
					delete next.search;
				}
				if (newDriverId) {
					next.driverId = newDriverId;
				} else {
					delete next.driverId;
				}
				return next;
			},
		});
	};

	const handleSort = (sortBy: string, sortOrder: string) => {
		navigate({
			to: "/dashboard/accountant/bata",
			search: (prev) => ({ ...prev, sortBy: sortBy as any, sortOrder: sortOrder as any }),
		});
	};

	const columns: ColumnDef<BataItem>[] = [
		{
			accessorKey: "driver_name",
			header: () => (
				<Button
					variant="ghost"
					size="sm"
					className="gap-2 px-0 font-medium"
					onClick={() => handleSort("driverName", query.sortOrder === "desc" ? "asc" : "desc")}
				>
					Driver
					<ArrowUpDown className="h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => (
				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
						{row.original.driver_name ? row.original.driver_name.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
					</div>
					<div>
						<div className="font-medium text-sm">{row.original.driver_name || "Unassigned"}</div>
						{row.original.driver_phone_number && (
							<div className="text-xs text-muted-foreground">{row.original.driver_phone_number}</div>
						)}
					</div>
				</div>
			),
		},
		{
			accessorKey: "vehicle_name",
			header: () => (
				<Button
					variant="ghost"
					size="sm"
					className="gap-2 px-0 font-medium"
					onClick={() => handleSort("vehicleName", query.sortOrder === "desc" ? "asc" : "desc")}
				>
					Vehicle
					<ArrowUpDown className="h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => (
				<div>
					<div className="font-medium text-sm">{row.original.vehicle_name || "Vehicle"}</div>
					{row.original.vehicle_license_plate && (
						<div className="text-xs text-muted-foreground uppercase">{row.original.vehicle_license_plate}</div>
					)}
				</div>
			),
		},
		{
			accessorKey: "transaction_date",
			header: () => (
				<Button
					variant="ghost"
					size="sm"
					className="gap-2 px-0 font-medium"
					onClick={() => handleSort("transactionDate", query.sortOrder === "desc" ? "asc" : "desc")}
				>
					Date
					<ArrowUpDown className="h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const dateVal = parseDateValue(row.original.transaction_date);
				return (
					<div className="text-sm">
						{dateVal ? dateVal.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
					</div>
				);
			},
		},
		{
			accessorKey: "product_name",
			header: "Product Name",
			cell: ({ row }) => (
				<div className="text-sm font-medium">{row.original.product_name || "—"}</div>
			),
		},
		{
			accessorKey: "bata_amount",
			header: () => (
				<Button
					variant="ghost"
					size="sm"
					className="gap-2 px-0 font-medium"
					onClick={() => handleSort("bataAmount", query.sortOrder === "desc" ? "asc" : "desc")}
				>
					Bata Amount
					<ArrowUpDown className="h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => (
				<div className="font-semibold text-sm text-amber-600 dark:text-amber-400">
					{formatINR(row.original.bata_amount)}
				</div>
			),
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => (
				<Button
					variant="outline"
					size="sm"
					onClick={(e) => {
						e.stopPropagation();
						navigate({ to: `/dashboard/accountant/bata/$bataId`, params: { bataId: row.original.id } });
					}}
				>
					View Detail
				</Button>
			),
		},
	];

	const items = data?.data ?? [];
	const total = data?.meta.total ?? 0;
	const offset = query.offset ?? 0;
	const limit = query.limit ?? 20;
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const currentPage = Math.floor(offset / limit) + 1;

	const table = useReactTable({
		data: items,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const handleExport = async (format: "pdf" | "excel") => {
		if (!data || data.meta.total === 0) {
			alert("No Bata records to export for the selected filters.");
			return;
		}

		setIsExporting(true);
		try {
			let exportRecords = data.data;
			if (data.meta.total > data.data.length) {
				const fullResult = await queryClient.fetchQuery<BataListResponse>(
					(orpc as any).accountant.bata.list.queryOptions({
						input: {
							limit: 10000,
							offset: 0,
							search: query.driverId ? undefined : query.search,
							driverId: query.driverId,
							status: "all",
							period: query.period,
							startDate: isDateRangeInvalid ? undefined : query.startDate,
							endDate: isDateRangeInvalid ? undefined : query.endDate,
							sortBy: query.sortBy,
							sortOrder: query.sortOrder,
						},
					}),
				);
				if (fullResult?.data) {
					exportRecords = fullResult.data;
				}
			}

			let grandTotalBata = 0;
			for (const r of exportRecords) {
				grandTotalBata += Number(r.bata_amount || 0);
			}

			const exportColumns: ExportColumn[] = [
				{ header: "Driver", key: "driverName", width: 140, align: "left" },
				{ header: "Vehicle", key: "vehicleName", width: 140, align: "left" },
				{ header: "Date", key: "transactionDate", width: 100, align: "left" },
				{ header: "Product Name", key: "productName", width: 170, align: "left" },
				{ header: "Bata Amount", key: "bataAmount", width: 120, align: "right" },
			];

			const rows = exportRecords.map((item) => {
				const dateVal = parseDateValue(item.transaction_date);
				const formattedDate = dateVal
					? dateVal.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
					: (item.transaction_date || "—");

				const vehicleLabel = item.vehicle_name
					? `${item.vehicle_name}${item.vehicle_license_plate ? ` (${item.vehicle_license_plate.toUpperCase()})` : ""}`
					: (item.vehicle_license_plate || "—");

				return {
					driverName: item.driver_name || "Unassigned",
					vehicleName: vehicleLabel,
					transactionDate: formattedDate,
					productName: item.product_name || "—",
					bataAmount: `Rs. ${Number(item.bata_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
				};
			});

			const grandTotalRow = {
				driverName: "GRAND TOTAL",
				vehicleName: `${exportRecords.length} Records`,
				transactionDate: "—",
				productName: "—",
				bataAmount: `Rs. ${grandTotalBata.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
			};

			const periodLabel =
				query.period === "custom" && query.startDate && query.endDate
					? `${query.startDate} to ${query.endDate}`
					: periodOptions.find((p) => p.value === query.period)?.label || query.period || "All Time";

			const activeDriver = exportRecords.find((r) => r.driver_id === query.driverId)?.driver_name;

			const options: StatementExportOptions = {
				filename: `Bata_Statement_${new Date().toISOString().split("T")[0]}`,
				title: "Driver Bata Statement",
				subtitle: "Driver Allowance & Trip Wage Statement",
				themeColor: { r: 0.85, g: 0.45, b: 0.05 },
				metadata: {
					"Driver Filter": activeDriver || query.search || "All Drivers",
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
		<div className="space-y-6">
			{/* KPI Summary Cards */}
			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Bata</CardTitle>
						<CoinsIcon className="h-4 w-4 text-amber-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatINR(data?.meta.totalBata ?? 0)}</div>
						<p className="text-xs text-muted-foreground mt-1">Total driver allowance across {total} entries</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Records</CardTitle>
						<UserIcon className="h-4 w-4 text-primary" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{total}</div>
						<p className="text-xs text-muted-foreground mt-1">Driver trip records under active filters</p>
					</CardContent>
				</Card>
			</div>

			{/* Filters & Control Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-3 flex-1">
					<BataSearchAutocomplete
						initialSearch={query.search}
						initialDriverId={query.driverId}
						onSearchChange={handleSearchChange}
						className="w-full sm:w-72"
					/>

					<Select value={query.period || "all_time"} onValueChange={handlePeriodChange}>
						<SelectTrigger className="w-[160px]">
							<SelectValue placeholder="Period" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{periodOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>

					{query.period === "custom" && (
						<div className="flex flex-wrap items-center gap-2">
							<div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-md border border-border">
								<CalendarIcon className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />
								<Input
									type="date"
									aria-label="Start date"
									value={query.startDate || ""}
									max={query.endDate || undefined}
									onChange={(e) => handleDateChange("startDate", e.target.value)}
									className={cn(
										"h-8 w-32 text-xs bg-background",
										isDateRangeInvalid && "border-destructive focus-visible:ring-destructive text-destructive",
									)}
								/>
								<span className="text-xs text-muted-foreground px-0.5">to</span>
								<Input
									type="date"
									aria-label="End date"
									value={query.endDate || ""}
									min={query.startDate || undefined}
									onChange={(e) => handleDateChange("endDate", e.target.value)}
									className={cn(
										"h-8 w-32 text-xs bg-background",
										isDateRangeInvalid && "border-destructive focus-visible:ring-destructive text-destructive",
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
								<div className="flex items-center gap-1 text-xs text-destructive font-medium w-full sm:w-auto">
									<AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
									<span>Start date cannot be later than end date</span>
								</div>
							)}
						</div>
					)}
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="outline" disabled={isExporting || total === 0}>
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

			{/* Data Table */}
			<div className="rounded-md border bg-card">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length > 0 ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									className="cursor-pointer hover:bg-muted/50"
									onClick={() =>
										navigate({ to: `/dashboard/accountant/bata/$bataId`, params: { bataId: row.original.id } })
									}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
									No Bata records found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination Controls */}
			{total > 0 && (
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground px-1">
					<div>
						Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} records
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								navigate({
									to: "/dashboard/accountant/bata",
									search: (prev) => ({ ...prev, offset: Math.max(0, offset - limit) }),
								})
							}
							disabled={offset === 0}
						>
							Previous
						</Button>
						<span className="text-xs font-medium px-2">
							Page {currentPage} of {totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								navigate({
									to: "/dashboard/accountant/bata",
									search: (prev) => ({ ...prev, offset: offset + limit }),
								})
							}
							disabled={offset + limit >= total}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
