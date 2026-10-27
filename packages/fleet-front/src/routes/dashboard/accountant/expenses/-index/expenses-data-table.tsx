import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	AlertCircleIcon,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	CalendarIcon,
	MoreHorizontalIcon,
	PlusIcon,
	ReceiptTextIcon,
	RotateCcwIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";
import {
	AccessDeniedDialog,
	AccountantDownloadButton,
	downloadExcelCompatibleCsv,
	useIsAdmin,
	useRowAccess,
} from "@/routes/dashboard/accountant/-shared/admin-helpers";
import { ExpenseDialog } from "./expense-dialog";

interface ExpenseRow {
	id: string;
	journal_entry_id: string;
	voucher_id: number | null;
	category_name: string | null;
	expense_date: string | null;
	amount: string;
	handler: string | null;
	next_renewal_date: string | null;
	category_impact: string | null;
	vehicle_name: string | null;
	driver_name: string | null;
	created_by_name: string | null;
	created_at: string;
}

export interface ExpensesDataTableProps {
	data: ExpenseRow[];
	total: number;
	totalAmount: number;
	offset: number;
	limit: number;
	search?: string;
	period?:
		| "all_time"
		| "last_7d"
		| "last_30d"
		| "last_6m"
		| "last_12m"
		| "custom";
	startDate?: string;
	endDate?: string;
	sortBy:
		| "voucherId"
		| "expenseCategory"
		| "amount"
		| "handler"
		| "nextRenewalDate"
		| "expenseImpact"
		| "vehicle"
		| "driver"
		| "createdBy"
		| "createdAt";
	sortOrder: "asc" | "desc";
}

type ExpensesSearchState = {
	offset: number;
	limit: number;
	search?: string;
	period?: ExpensesDataTableProps["period"];
	startDate?: string;
	endDate?: string;
	sortBy: ExpensesDataTableProps["sortBy"];
	sortOrder: "asc" | "desc";
};

const periodOptions = [
	{ value: "last_7d", label: "Last 7 days" },
	{ value: "last_30d", label: "Last 30 days" },
	{ value: "last_6m", label: "Last 6 months" },
	{ value: "last_12m", label: "Last 12 months" },
	{ value: "all_time", label: "All time" },
	{ value: "custom", label: "Custom date range" },
] as const;

const createSortHeader = (
	label: string,
	sortKey: ExpensesDataTableProps["sortBy"],
	currentSortBy: string,
	currentSortOrder: string,
	onSort: (sortBy: string, sortOrder: string) => void,
) => {
	const isActive = currentSortBy === sortKey;
	const nextOrder = isActive && currentSortOrder === "desc" ? "asc" : "desc";
	const Icon =
		isActive && currentSortOrder === "asc"
			? ArrowUp
			: isActive && currentSortOrder === "desc"
				? ArrowDown
				: ArrowUpDown;

	return (
		<Button
			variant="ghost"
			size="sm"
			className="gap-2 px-0"
			onClick={() => onSort(sortKey, nextOrder)}
		>
			{label}
			<Icon
				className={cn(
					"h-4 w-4",
					isActive ? "text-foreground" : "text-muted-foreground",
				)}
			/>
		</Button>
	);
};

const formatExpenseDate = (value: string | null) =>
	value
		? new Intl.DateTimeFormat("en-GB", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			}).format(new Date(value))
		: "-";

const createColumns = (
	currentSortBy: string,
	currentSortOrder: string,
	onSort: (sortBy: string, sortOrder: string) => void,
	onEditRow: (row: ExpenseRow) => void,
	onDeleteRow: (row: ExpenseRow) => void,
): ColumnDef<ExpenseRow>[] => [
	{
		accessorKey: "voucher_id",
		header: () =>
			createSortHeader(
				"Voucher",
				"voucherId",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
	},
	{
		accessorKey: "category_name",
		header: () =>
			createSortHeader(
				"Expense",
				"expenseCategory",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => row.original.category_name || "-",
	},
	{
		accessorKey: "expense_date",
		header: () =>
			createSortHeader(
				"Date",
				"createdAt",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => formatExpenseDate(row.original.expense_date),
	},
	{
		accessorKey: "amount",
		header: () =>
			createSortHeader(
				"Amount",
				"amount",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => formatINR(parseFloat(row.original.amount) || 0),
	},
	{
		accessorKey: "handler",
		header: () =>
			createSortHeader(
				"Handler",
				"handler",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => row.original.handler || "-",
	},
	{
		accessorKey: "next_renewal_date",
		header: () =>
			createSortHeader(
				"Next Renewal",
				"nextRenewalDate",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => formatExpenseDate(row.original.next_renewal_date),
	},
	{
		accessorKey: "category_impact",
		header: () =>
			createSortHeader(
				"Expense Impact",
				"expenseImpact",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => row.original.category_impact || "-",
	},
	{
		accessorKey: "vehicle_name",
		header: () =>
			createSortHeader(
				"Vehicle",
				"vehicle",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => row.original.vehicle_name || "-",
	},
	{
		accessorKey: "driver_name",
		header: () =>
			createSortHeader(
				"Driver Name",
				"driver",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => row.original.driver_name || "-",
	},
	{
		accessorKey: "created_by_name",
		header: () =>
			createSortHeader(
				"Created By",
				"createdBy",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => row.original.created_by_name || "-",
	},
	{
		id: "actions",
		header: "Actions",
		cell: ({ row }) => (
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="ghost" size="icon">
							<MoreHorizontalIcon className="h-4 w-4" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => onEditRow(row.original)}>
						Edit
					</DropdownMenuItem>
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onClick={() => onDeleteRow(row.original)}
					>
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		),
	},
];

export function ExpensesDataTable({
	data,
	total,
	totalAmount,
	offset,
	limit,
	search,
	period,
	startDate,
	endDate,
	sortBy,
	sortOrder,
}: ExpensesDataTableProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const isAdmin = useIsAdmin();
	const { canAccess } = useRowAccess();
	const [searchValue, setSearchValue] = useState(search ?? "");
	const [blockedRow, setBlockedRow] = useState<ExpenseRow | null>(null);
	const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const currentPage = Math.floor(offset / limit) + 1;
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const deleteEntryMutation = useMutation({
		...orpc.accountant.journalEntries.delete.mutationOptions(),
		onSuccess: () => queryClient.invalidateQueries(),
	});

	const onEditRow = async (row: ExpenseRow) => {
		if (
			!isAdmin &&
			!(await canAccess({
				pageName: "Expenses",
				resourceType: "journal_entry",
				resourceId: row.journal_entry_id,
				action: "edit",
			}))
		) {
			setBlockedRow(row);
			return;
		}
		void router.navigate({
			to: "/dashboard/accountant/journal-entries/$entryId",
			params: { entryId: row.journal_entry_id },
		});
	};

	const onDeleteRow = async (row: ExpenseRow) => {
		if (
			!isAdmin &&
			!(await canAccess({
				pageName: "Expenses",
				resourceType: "journal_entry",
				resourceId: row.journal_entry_id,
				action: "delete",
			}))
		) {
			setBlockedRow(row);
			return;
		}
		if (!row.journal_entry_id) return;
		deleteEntryMutation.mutate({ id: row.journal_entry_id } as never);
	};

	useEffect(() => setSearchValue(search ?? ""), [search]);
	useEffect(() => {
		const timer = setTimeout(() => {
			void router.navigate({
				to: ".",
				search: (prev: ExpensesSearchState) => ({
					...prev,
					search: searchValue || undefined,
					offset: 0,
				}),
			});
		}, 300);
		return () => clearTimeout(timer);
	}, [searchValue, router]);

	const handleSort = (newSortBy: string, newSortOrder: string) => {
		void router.navigate({
			to: ".",
			search: (prev: ExpensesSearchState) => ({
				...prev,
				sortBy: newSortBy as ExpensesDataTableProps["sortBy"],
				sortOrder: newSortOrder as "asc" | "desc",
				offset: 0,
			}),
		});
	};

	const handlePeriodChange = (value: typeof period | null) => {
		if (!value) return;
		if (value === "custom") {
			const today = new Date().toISOString().split("T")[0];
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			void router.navigate({
				to: ".",
				search: (prev: ExpensesSearchState) => ({
					...prev,
					period: "custom",
					startDate: prev.startDate || thirtyDaysAgo,
					endDate: prev.endDate || today,
					offset: 0,
				}),
			});
		} else {
			void router.navigate({
				to: ".",
				search: (prev: ExpensesSearchState) => ({
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
		void router.navigate({
			to: ".",
			search: (prev: ExpensesSearchState) => ({
				...prev,
				period: "custom",
				[field]: value,
				offset: 0,
			}),
		});
	};

	const handleDownload = async () => {
		if (total === 0) return;
		setIsDownloading(true);
		try {
			const isDateRangeInvalid = Boolean(
				period === "custom" && startDate && endDate && startDate > endDate,
			);
			let exportRecords = data;
			if (total > data.length) {
				const fullResult = await queryClient.fetchQuery(
					orpc.accountant.expenses.list.queryOptions({
						input: {
							limit: 10000,
							offset: 0,
							search: search,
							period: period,
							startDate: isDateRangeInvalid ? undefined : startDate,
							endDate: isDateRangeInvalid ? undefined : endDate,
							sortBy: sortBy,
							sortOrder: sortOrder,
						},
					}),
				);
				if (fullResult?.data) {
					exportRecords = fullResult.data;
				}
			}

			downloadExcelCompatibleCsv(
				"expenses",
				exportRecords.map((item) => ({
					Voucher: item.voucher_id ?? "",
					Expense: item.category_name ?? "",
					Date: item.expense_date ? String(item.expense_date).slice(0, 10) : "",
					Amount: parseFloat(item.amount) || 0,
					Handler: item.handler ?? "",
					"Next Renewal": item.next_renewal_date
						? String(item.next_renewal_date).slice(0, 10)
						: "",
					"Expense Impact": item.category_impact
						? item.category_impact.charAt(0).toUpperCase() +
							item.category_impact.slice(1)
						: "",
					Vehicle: item.vehicle_name ?? "",
					"Driver Name": item.driver_name ?? "",
					"Created By": item.created_by_name ?? "",
					"Created At": item.created_at
						? String(item.created_at).slice(0, 10)
						: "",
				})),
			);
		} finally {
			setIsDownloading(false);
		}
	};

	const columns = createColumns(
		sortBy,
		sortOrder,
		handleSort,
		onEditRow,
		onDeleteRow,
	);
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="w-full min-w-0 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
					<p className="text-muted-foreground text-sm">
						Expense register with voucher-level tracking
					</p>
				</div>
				<div className="flex items-center gap-3 flex-wrap max-sm:w-full">
					<AccountantDownloadButton
						disabled={isDownloading || total === 0}
						onDownload={handleDownload}
					/>
					<Input
						placeholder="Search expenses..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.currentTarget.value)}
						className="w-[200px] max-sm:w-full"
					/>
					<Button onClick={() => setIsExpenseDialogOpen(true)}>
						<PlusIcon className="h-4 w-4" />
						Add Expense
					</Button>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-3 shadow-2xs">
				<div className="flex items-center gap-3">
					<div className="rounded-md bg-destructive/10 p-2 text-destructive">
						<ReceiptTextIcon className="h-5 w-5" />
					</div>
					<div>
						<p className="text-xs font-medium text-muted-foreground">
							{!period || period === "all_time"
								? "Total Expense (All Time)"
								: "Total Expense (Selected Period)"}
						</p>
						<p className="text-lg font-bold text-foreground">
							{formatINR(totalAmount)}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 flex-wrap max-sm:w-full justify-end">
					<Select
						items={periodOptions}
						value={period ?? "all_time"}
						onValueChange={handlePeriodChange}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Select period" />
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

					{(() => {
						const isDateRangeInvalid = !!(
							period === "custom" &&
							startDate &&
							endDate &&
							startDate > endDate
						);
						return period === "custom" ? (
							<div className="flex flex-wrap items-center gap-1.5 max-sm:w-full">
								<div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-md border border-border">
									<CalendarIcon className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />
									<Input
										type="date"
										aria-label="Start date"
										value={startDate || ""}
										max={endDate || undefined}
										onChange={(e) =>
											handleDateChange("startDate", e.target.value)
										}
										className={cn(
											"w-[130px] h-8 text-xs bg-background",
											isDateRangeInvalid &&
												"border-destructive focus-visible:ring-destructive text-destructive",
										)}
									/>
									<span className="text-xs text-muted-foreground px-0.5">
										to
									</span>
									<Input
										type="date"
										aria-label="End date"
										value={endDate || ""}
										min={startDate || undefined}
										onChange={(e) =>
											handleDateChange("endDate", e.target.value)
										}
										className={cn(
											"w-[130px] h-8 text-xs bg-background",
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
						) : null;
					})()}
				</div>
			</div>

			<div className="max-w-full overflow-x-auto rounded-lg border">
				<Table className="min-w-[1320px]">
					<TableHeader className="bg-muted sticky top-0 z-10">
						{table.getHeaderGroups().map((hg) => (
							<TableRow key={hg.id}>
								{hg.headers.map((h) => (
									<TableHead key={h.id}>
										{h.isPlaceholder
											? null
											: flexRender(h.column.columnDef.header, h.getContext())}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-28 text-center text-muted-foreground"
								>
									No expenses found for the selected period or filter.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-end gap-4">
				<div className="text-sm text-muted-foreground">
					Page {currentPage} of {totalPages}
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() =>
							void router.navigate({
								to: ".",
								search: (prev: ExpensesSearchState) => ({
									...prev,
									offset: Math.max(0, offset - limit),
								}),
							})
						}
						disabled={offset === 0}
						className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
					>
						Previous
					</button>
					<button
						type="button"
						onClick={() =>
							void router.navigate({
								to: ".",
								search: (prev: ExpensesSearchState) => ({
									...prev,
									offset: offset + limit,
								}),
							})
						}
						disabled={offset + limit >= total}
						className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
					>
						Next
					</button>
				</div>
			</div>
			<AccessDeniedDialog
				open={Boolean(blockedRow)}
				onOpenChange={(open) => {
					if (!open) setBlockedRow(null);
				}}
				pageName="Expenses"
				resourceType="journal_entry"
				resourceId={blockedRow?.journal_entry_id ?? ""}
				primaryLabel={
					blockedRow?.voucher_id
						? String(blockedRow.voucher_id)
						: (blockedRow?.journal_entry_id ?? "")
				}
			/>
			<ExpenseDialog
				isOpen={isExpenseDialogOpen}
				onOpenChange={setIsExpenseDialogOpen}
			/>
		</div>
	);
}
