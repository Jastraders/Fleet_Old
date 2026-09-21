import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	CheckCircle2Icon,
	ClockIcon,
	CoinsIcon,
	SearchIcon,
	UserIcon,
} from "lucide-react";
import { Suspense, useDeferredValue, useState } from "react";
import * as v from "valibot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseDateValue } from "@/lib/date";
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";
import {
	AccountantDownloadButton,
	downloadExcelCompatibleCsv,
} from "@/routes/dashboard/accountant/-shared/admin-helpers";

const statusSchema = v.fallback(v.picklist(["all", "paid", "unpaid"]), "all");
const periodSchema = v.fallback(
	v.picklist(["all_time", "last_7d", "last_30d", "last_6m", "last_12m", "custom"]),
	"all_time",
);

const querySchema = v.object({
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 20), 20),
	search: v.optional(v.string()),
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
	loaderDeps: ({ search: { offset, limit, search, status, period, startDate, endDate, sortBy, sortOrder } }) => ({
		offset,
		limit,
		search,
		status,
		period,
		startDate,
		endDate,
		sortBy,
		sortOrder,
	}),
	loader: ({ context: { orpc, queryClient }, deps: query }) => {
		queryClient.prefetchQuery(
			(orpc as any).accountant.bata.list.queryOptions({
				input: query,
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
			<div className="grid gap-4 md:grid-cols-3">
				{[1, 2, 3].map((i) => (
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

	const { data } = useSuspenseQuery<BataListResponse>({
		...(orpc as any).accountant.bata.list.queryOptions({
			input: {
				limit: query.limit,
				offset: query.offset,
				search: query.search,
				status: query.status,
				period: query.period,
				startDate: query.startDate,
				endDate: query.endDate,
				sortBy: query.sortBy,
				sortOrder: query.sortOrder,
			},
		}),
	});

	const [searchInput, setSearchInput] = useState(query.search || "");

	const handleStatusChange = (newStatus: string) => {
		navigate({
			to: "/dashboard/accountant/bata",
			search: { ...query, status: newStatus as "all" | "paid" | "unpaid", offset: 0 },
		});
	};

	const handlePeriodChange = (newPeriod: string) => {
		navigate({
			to: "/dashboard/accountant/bata",
			search: { ...query, period: newPeriod as any, offset: 0 },
		});
	};

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		navigate({
			to: "/dashboard/accountant/bata",
			search: { ...query, search: searchInput || undefined, offset: 0 },
		});
	};

	const handleSort = (sortBy: string, sortOrder: string) => {
		navigate({
			to: "/dashboard/accountant/bata",
			search: { ...query, sortBy: sortBy as any, sortOrder: sortOrder as any },
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
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => {
				const isPaid = row.original.status === "paid";
				return isPaid ? (
					<Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30 gap-1.5">
						<CheckCircle2Icon className="h-3.5 w-3.5" />
						Paid
					</Badge>
				) : (
					<Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 border-amber-500/30 gap-1.5">
						<ClockIcon className="h-3.5 w-3.5" />
						Unpaid
					</Badge>
				);
			},
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
	const table = useReactTable({
		data: items,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const exportCsv = () => {
		const exportData = items.map((item) => ({
			"Driver Name": item.driver_name || "",
			"Vehicle Name": item.vehicle_name || "",
			"License Plate": item.vehicle_license_plate || "",
			"Transaction Date": item.transaction_date || "",
			"Product Name": item.product_name || "",
			"Bata Amount (INR)": item.bata_amount,
			"Status": item.status.toUpperCase(),
			"Paid By": item.paid_by_name || "",
			"Paid At": item.paid_at || "",
		}));
		downloadExcelCompatibleCsv(exportData, `Bata_Records_${new Date().toISOString().slice(0, 10)}.csv`);
	};

	return (
		<div className="space-y-6">
			{/* KPI Summary Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Bata</CardTitle>
						<CoinsIcon className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatINR(data?.meta.totalBata ?? 0)}</div>
						<p className="text-xs text-muted-foreground mt-1">Total Bata across recorded entries</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Paid Bata</CardTitle>
						<CheckCircle2Icon className="h-4 w-4 text-emerald-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
							{formatINR(data?.meta.paidBata ?? 0)}
						</div>
						<p className="text-xs text-muted-foreground mt-1">Settled & linked to expenses</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Unpaid Bata</CardTitle>
						<ClockIcon className="h-4 w-4 text-amber-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
							{formatINR(data?.meta.unpaidBata ?? 0)}
						</div>
						<p className="text-xs text-muted-foreground mt-1">Pending payment to drivers</p>
					</CardContent>
				</Card>
			</div>

			{/* Filters & Control Bar */}
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<Tabs value={query.status || "all"} onValueChange={handleStatusChange} className="w-full md:w-auto">
					<TabsList>
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="paid">Paid</TabsTrigger>
						<TabsTrigger value="unpaid">Unpaid</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="flex flex-wrap items-center gap-3">
					<form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-64">
						<SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search driver, vehicle, product..."
							className="pl-8"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
						/>
					</form>

					<Select value={query.period || "all_time"} onValueChange={handlePeriodChange}>
						<SelectTrigger className="w-[160px]">
							<SelectValue placeholder="Period" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all_time">All Time</SelectItem>
							<SelectItem value="last_7d">Last 7 Days</SelectItem>
							<SelectItem value="last_30d">Last 30 Days</SelectItem>
							<SelectItem value="last_6m">Last 6 Months</SelectItem>
							<SelectItem value="last_12m">Last 12 Months</SelectItem>
						</SelectContent>
					</Select>

					<AccountantDownloadButton onDownload={exportCsv} />
				</div>
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
		</div>
	);
}
