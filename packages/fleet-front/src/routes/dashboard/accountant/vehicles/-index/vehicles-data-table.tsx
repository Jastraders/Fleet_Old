import { useRouter } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/models/vehicle";
import { VehiclesDataTableActionCell } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-data-table/vehicles-data-table-action-cell";

const createSortHeader = (
	label: string,
	sortKey:
		| "vehicleName"
		| "model"
		| "year"
		| "investmentMode"
		| "createdBy",
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
			<Icon className={cn("h-4 w-4 transition-colors", isActive ? "text-foreground" : "text-muted-foreground")} />
		</Button>
	);
};

const createColumns = (
	currentSortBy: string,
	currentSortOrder: string,
	onSort: (sortBy: string, sortOrder: string) => void,
): ColumnDef<Vehicle>[] => [
	{
		accessorKey: "name",
		header: () => createSortHeader("Vehicle", "vehicleName", currentSortBy, currentSortOrder, onSort),
		cell: ({ row }) => {
			const vehicle = row.original;
			return (
				<div className="flex items-center gap-3">
					{vehicle.color && <div className="h-8 w-8 rounded" style={{ backgroundColor: `#${vehicle.color}` }} />}
					<div>
						<div className="font-medium">{vehicle.name}</div>
						<div className="text-muted-foreground text-xs">{vehicle.licensePlate}</div>
					</div>
				</div>
			);
		},
	},
	{
		accessorKey: "model",
		header: () => createSortHeader("Model / Year", "model", currentSortBy, currentSortOrder, onSort),
		cell: ({ row }) => (
			<div className="text-sm">
				<div>{row.original.model || "-"}</div>
				<div className="text-muted-foreground">{row.original.year ?? "-"}</div>
			</div>
		),
	},
	{
		accessorKey: "investmentMode",
		header: () => createSortHeader("Investment Mode", "investmentMode", currentSortBy, currentSortOrder, onSort),
		cell: ({ row }) => {
			const labels: Record<Vehicle["investmentMode"], string> = {
				full_amount: "Full Amount",
				full_loan: "Full Loan",
				flexible: "Flexible",
			};
			return <span>{labels[row.original.investmentMode]}</span>;
		},
	},
	{
		accessorKey: "createdByUser",
		header: () => createSortHeader("Created By", "createdBy", currentSortBy, currentSortOrder, onSort),
		cell: ({ row }) => {
			const user = row.original.createdByUser;
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
					<Avatar size="sm">
						{user.image && <AvatarImage src={user.image} alt={user.name} />}
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<span className="text-sm">{user.name}</span>
				</div>
			);
		},
	},
	{
		id: "actions",
		header: () => <span className="sr-only">Actions</span>,
		cell: ({ row }) => <VehiclesDataTableActionCell vehicle={row.original} />,
	},
];

export interface VehiclesDataTableProps {
	data: Vehicle[];
	total: number;
	offset: number;
	limit: number;
	sortBy:
		| "vehicleName"
		| "model"
		| "year"
		| "investmentMode"
		| "createdBy";
	sortOrder: "asc" | "desc";
}

export function VehiclesDataTable({ data, total, offset, limit, sortBy, sortOrder }: VehiclesDataTableProps) {
	const router = useRouter();
	const currentPage = Math.floor(offset / limit) + 1;
	const totalPages = Math.ceil(total / limit);

	const handleSort = (newSortBy: string, newSortOrder: string) => {
		void router.navigate({
			to: ".",
			search: (prev) => ({
				...prev,
				sortBy: newSortBy as VehiclesDataTableProps["sortBy"],
				sortOrder: newSortOrder as "asc" | "desc",
				offset: 0,
			}),
		});
	};

	const columns = createColumns(sortBy, sortOrder, handleSort);
	const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

	return (
		<>
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted sticky top-0 z-10">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id} className={cn("last:w-0")}>
										{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">No vehicles found.</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-end gap-4">
				<div className="text-muted-foreground text-sm">Page {currentPage} of {totalPages}</div>
				<div className="flex items-center gap-2">
					<button type="button" onClick={() => void router.navigate({ to: ".", search: (prev) => ({ ...prev, offset: Math.max(0, offset - limit) }) })} disabled={offset === 0} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 py-2">Previous</button>
					<button type="button" onClick={() => void router.navigate({ to: ".", search: (prev) => ({ ...prev, offset: offset + limit }) })} disabled={offset + limit >= total} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 py-2">Next</button>
				</div>
			</div>
		</>
	);
}
