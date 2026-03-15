import { useRouter } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { parseDateValue } from "@/lib/date";
import { cn, formatINR } from "@/lib/utils";
import { EntriesDataTableActionCell } from "@/routes/dashboard/accountant/journal-entries/-index/entries-data-table/entries-data-table-action-cell";

interface JournalEntryItem {
	id: string;
	transactionDate: Date;
	type: "credit" | "debit";
	amount: string;
	expenseCategoryId: string | null;
}

interface JournalEntry {
	id: string;
	vehicleId: string;
	createdBy: string | null;
	notes: string | null;
	createdAt: Date;
	vehicle?: {
		id: string;
		name: string;
		licensePlate: string | null;
	} | null;
	items?: JournalEntryItem[];
	createdByUser?: {
		id: string;
		name: string;
		image?: string | null;
	} | null;
}

const getTotalAmount = (items?: JournalEntryItem[]): number => {
	if (!items || items.length === 0) return 0;
	return items.reduce((sum, item) => {
		const amount = parseFloat(item.amount) || 0;
		return item.type === "credit" ? sum + amount : sum - amount;
	}, 0);
};

const getRevenue = (items?: JournalEntryItem[]): number => {
	if (!items || items.length === 0) return 0;
	return items.reduce((sum, item) => {
		if (item.type === "credit") {
			return sum + (parseFloat(item.amount) || 0);
		}
		return sum;
	}, 0);
};

const getExpenses = (items?: JournalEntryItem[]): number => {
	if (!items || items.length === 0) return 0;
	return items.reduce((sum, item) => {
		if (item.type === "debit") {
			return sum + (parseFloat(item.amount) || 0);
		}
		return sum;
	}, 0);
};

const createSortHeader = (
	label: string,
	sortKey:
		| "vehicleName"
		| "revenue"
		| "expenses"
		| "amount"
		| "createdBy"
		| "createdAt",
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
					"h-4 w-4 transition-colors",
					isActive ? "text-foreground" : "text-muted-foreground",
				)}
			/>
		</Button>
	);
};

const createColumns = (
	currentSortBy: string,
	currentSortOrder: string,
	onSort: (sortBy: string, sortOrder: string) => void,
): ColumnDef<JournalEntry>[] => [
	{
		accessorKey: "vehicle",
		header: () =>
			createSortHeader(
				"Vehicle",
				"vehicleName",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => {
			const vehicle = row.original.vehicle;
			if (!vehicle) {
				return <div className="text-muted-foreground text-sm">-</div>;
			}
			return (
				<div>
					<div className="font-medium">{vehicle.name}</div>
					<div className="text-muted-foreground text-xs">
						{vehicle.licensePlate}
					</div>
				</div>
			);
		},
	},
	{
		accessorKey: "revenue",
		header: () =>
			createSortHeader(
				"Revenue",
				"revenue",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => {
			const revenue = getRevenue(row.original.items);
			return <div className="font-medium">{formatINR(revenue)}</div>;
		},
	},
	{
		accessorKey: "expenses",
		header: () =>
			createSortHeader(
				"Expenses",
				"expenses",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => {
			const expenses = getExpenses(row.original.items);
			return <div className="font-medium">{formatINR(expenses)}</div>;
		},
	},
	{
		accessorKey: "amount",
		header: () =>
			createSortHeader(
				"Total Amount",
				"amount",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => {
			const totalAmount = getTotalAmount(row.original.items);
			const isNegative = totalAmount < 0;
			return (
				<div
					className={
						isNegative ? "text-destructive font-medium" : "font-medium"
					}
				>
					{formatINR(totalAmount)}
				</div>
			);
		},
	},
	{
		accessorKey: "createdByUser",
		header: () =>
			createSortHeader(
				"Created By",
				"createdBy",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => {
			const user = row.original.createdByUser;
			const date = parseDateValue(row.original.createdAt);

			if (!user) {
				return <div className="text-muted-foreground text-sm">-</div>;
			}

			const initials = user.name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase();

			return (
				<div className="flex items-center gap-2">
					<Avatar>
						{user.image && <AvatarImage src={user.image} alt={user.name} />}
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div className="grid flex-1 text-left text-sm leading-tight">
						<span className="truncate font-medium">{user.name}</span>
						{date ? (
							<time
								className="text-muted-foreground truncate text-xs"
								dateTime={date.toISOString()}
							>
								{date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
									year: "numeric",
								})}
							</time>
						) : (
							<span className="text-muted-foreground truncate text-xs">-</span>
						)}
					</div>
				</div>
			);
		},
	},
	{
		id: "actions",
		header: () => <span className="sr-only">Actions</span>,
		cell: ({ row }) => {
			return <EntriesDataTableActionCell entry={row.original} />;
		},
	},
];

export interface EntriesDataTableProps {
	data: JournalEntry[];
	total: number;
	offset: number;
	limit: number;
	search?: string;
	sortBy: "vehicleName" | "revenue" | "expenses" | "amount" | "createdBy" | "createdAt";
	sortOrder: "asc" | "desc";
}

export function EntriesDataTable({
	data,
	total,
	offset,
	limit,
	search,
	sortBy,
	sortOrder,
}: EntriesDataTableProps) {
	const router = useRouter();
	const currentPage = Math.floor(offset / limit) + 1;
	const totalPages = Math.ceil(total / limit);

	const [searchValue, setSearchValue] = useState(search ?? "");

	useEffect(() => {
		setSearchValue(search ?? "");
	}, [search]);

	useEffect(() => {
		const timer = setTimeout(() => {
			handleSearch(searchValue);
		}, 300);

		return () => clearTimeout(timer);
	}, [searchValue]);

	const handleSort = (newSortBy: string, newSortOrder: string) => {
		void router.navigate({
			to: ".",
			search: (prev) => ({
				...prev,
				sortBy: newSortBy as EntriesDataTableProps["sortBy"],
				sortOrder: newSortOrder as "asc" | "desc",
				offset: 0,
			}),
		});
	};

	const handleSearch = (value: string) => {
		void router.navigate({
			to: ".",
			search: (prev) => ({
				...prev,
				search: value || undefined,
				offset: 0,
			}),
		});
	};

	const columns = createColumns(sortBy, sortOrder, handleSort);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const handlePreviousPage = () => {
		const newOffset = Math.max(0, offset - limit);
		void router.navigate({
			to: ".",
			search: (prev) => ({ ...prev, offset: newOffset }),
		});
	};

	const handleNextPage = () => {
		if (offset + limit < total) {
			const newOffset = offset + limit;
			void router.navigate({
				to: ".",
				search: (prev) => ({ ...prev, offset: newOffset }),
			});
		}
	};

	const handleCreateEntry = () => {
		void router.navigate({
			to: "/dashboard/accountant/journal-entries/new",
		});
	};

	return (
		<div className="w-full space-y-4">
			<div className="flex flex-wrap justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
					<p className="text-muted-foreground text-sm">
						Track your vehicle transactions and expenses
					</p>
				</div>
				<div className="flex gap-4 max-sm:w-full max-sm:flex-col">
					<Input
						placeholder="Search journal entries..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.currentTarget.value)}
					/>
					<Button onClick={handleCreateEntry}>
						<PlusIcon className="h-4 w-4" />
						New Entry
					</Button>
				</div>
			</div>
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted sticky top-0 z-10">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id} className={cn("last:w-0")}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
								>
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
								<TableCell colSpan={columns.length} className="h-24 text-center">
									No entries found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-end gap-4">
				<div className="text-muted-foreground text-sm">
					Page {currentPage} of {totalPages}
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handlePreviousPage}
						disabled={offset === 0}
						className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 py-2"
					>
						Previous
					</button>
					<button
						type="button"
						onClick={handleNextPage}
						disabled={offset + limit >= total}
						className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 py-2"
					>
						Next
					</button>
				</div>
			</div>
		</div>
	);
}
