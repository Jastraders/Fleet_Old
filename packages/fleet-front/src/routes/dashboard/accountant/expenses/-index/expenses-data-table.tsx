import { useRouter } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn, formatINR } from "@/lib/utils";
import {
	AccountantDownloadButton,
	downloadExcelCompatibleCsv,
} from "@/routes/dashboard/accountant/-shared/admin-helpers";

interface ExpenseRow {
	id: string;
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

type ExpensesSearchState = {
	offset: number;
	limit: number;
	search?: string;
	sortBy: ExpensesDataTableProps["sortBy"];
	sortOrder: "asc" | "desc";
};

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
		<Button variant="ghost" size="sm" className="gap-2 px-0" onClick={() => onSort(sortKey, nextOrder)}>
			{label}
			<Icon className={cn("h-4 w-4", isActive ? "text-foreground" : "text-muted-foreground")} />
		</Button>
	);
};

const createColumns = (
	currentSortBy: string,
	currentSortOrder: string,
	onSort: (sortBy: string, sortOrder: string) => void,
): ColumnDef<ExpenseRow>[] => [
	{ accessorKey: "voucher_id", header: () => createSortHeader("Voucher", "voucherId", currentSortBy, currentSortOrder, onSort) },
	{ accessorKey: "category_name", header: () => createSortHeader("Expense", "expenseCategory", currentSortBy, currentSortOrder, onSort), cell: ({ row }) => row.original.category_name || "-" },
	{ accessorKey: "expense_date", header: () => createSortHeader("Date", "createdAt", currentSortBy, currentSortOrder, onSort), cell: ({ row }) => row.original.expense_date ? new Date(row.original.expense_date).toLocaleDateString() : "-" },
	{ accessorKey: "amount", header: () => createSortHeader("Amount", "amount", currentSortBy, currentSortOrder, onSort), cell: ({ row }) => formatINR(parseFloat(row.original.amount) || 0) },
	{ accessorKey: "handler", header: () => createSortHeader("Handler", "handler", currentSortBy, currentSortOrder, onSort), cell: ({ row }) => row.original.handler || "-" },
	{ accessorKey: "next_renewal_date", header: () => createSortHeader("Next Renewal", "nextRenewalDate", currentSortBy, currentSortOrder, onSort), cell: ({ row }) => row.original.next_renewal_date ? new Date(row.original.next_renewal_date).toLocaleDateString() : "-" },
	{ accessorKey: "category_impact", header: () => createSortHeader("Expense Impact", "expenseImpact", currentSortBy, currentSortOrder, onSort), cell: ({ row }) => row.original.category_impact || "-" },
	{ accessorKey: "vehicle_name", header: () => createSortHeader("Vehicle", "vehicle", currentSortBy, currentSortOrder, onSort), cell: ({ row }) => row.original.vehicle_name || "-" },
	{ accessorKey: "driver_name", header: () => createSortHeader("Driver Name", "driver", currentSortBy, currentSortOrder, onSort), cell: ({ row }) => row.original.driver_name || "-" },
	{ accessorKey: "created_by_name", header: () => createSortHeader("Created By", "createdBy", currentSortBy, currentSortOrder, onSort), cell: ({ row }) => row.original.created_by_name || "-" },
];

export interface ExpensesDataTableProps {
	data: ExpenseRow[];
	total: number;
	offset: number;
	limit: number;
	search?: string;
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

export function ExpensesDataTable({ data, total, offset, limit, search, sortBy, sortOrder }: ExpensesDataTableProps) {
	const router = useRouter();
	const [searchValue, setSearchValue] = useState(search ?? "");
	const currentPage = Math.floor(offset / limit) + 1;
	const totalPages = Math.max(1, Math.ceil(total / limit));

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
	const columns = createColumns(sortBy, sortOrder, handleSort);
	const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

	return (
		<div className="w-full min-w-0 space-y-4 overflow-x-hidden">
			<div className="flex flex-wrap justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
					<p className="text-muted-foreground text-sm">Expense register with voucher-level tracking</p>
				</div>
				<div className="flex gap-4 max-sm:w-full max-sm:flex-col">
					<AccountantDownloadButton
						onDownload={() =>
							downloadExcelCompatibleCsv(
								"expenses",
								data.map((item) => ({
									Voucher: item.voucher_id ?? "",
									Expense: item.category_name ?? "",
									Date: item.expense_date ?? "",
									Amount: item.amount,
									Handler: item.handler ?? "",
									"Next Renewal": item.next_renewal_date ?? "",
									"Expense Impact": item.category_impact ?? "",
									Vehicle: item.vehicle_name ?? "",
									"Driver Name": item.driver_name ?? "",
									"Created By": item.created_by_name ?? "",
									"Created At": item.created_at,
								})),
							)
						}
					/>
					<Input placeholder="Search expenses..." value={searchValue} onChange={(e) => setSearchValue(e.currentTarget.value)} />
					<Button onClick={() => void router.navigate({ to: "/dashboard/accountant/journal-entries/new" })}><PlusIcon className="h-4 w-4" />Add Expense</Button>
				</div>
			</div>
			<div className="max-w-full overflow-x-auto rounded-lg border">
				<Table className="min-w-[1100px]">
					<TableHeader className="bg-muted sticky top-0 z-10">
						{table.getHeaderGroups().map((hg) => <TableRow key={hg.id}>{hg.headers.map((h) => <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}</TableRow>)}
					</TableHeader>
				<TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No expenses found.</TableCell></TableRow>}</TableBody></Table>
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
		</div>
	);
}
