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
	sortKey: "vehicleName" | "createdAt" | "createdBy",
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
): ColumnDef<Vehicle>[] => [
	{
		accessorKey: "name",
		header: () =>
			createSortHeader(
				"Vehicle",
				"vehicleName",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => {
			const vehicle = row.original;
			return (
				<div className="flex items-center gap-3">
					{vehicle.color && (
						<div
							className="h-8 w-8 rounded"
							style={{ backgroundColor: `#${vehicle.color}` }}
						/>
					)}
					<div>
						<div className="font-medium">{vehicle.name}</div>
						<div className="text-muted-foreground text-xs">
							{vehicle.licensePlate}
						</div>
					</div>
				</div>
			);
		},
	},
	{
		accessorKey: "createdAt",
		header: () =>
			createSortHeader(
				"Created",
				"createdAt",
				currentSortBy,
				currentSortOrder,
				onSort,
			),
		cell: ({ row }) => {
			const date = new Date(row.original.createdAt);
			return (
				<time
					className="text-muted-foreground text-sm"
					dateTime={date.toISOString()}
				>
					{date.toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric",
					})}
				</time>
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
		cell: ({ row }) => {
			return <VehiclesDataTableActionCell vehicle={row.original} />;
		},
	},
];

export interface VehiclesDataTableProps {
	data: Vehicle[];
	total: number;
	offset: number;
	limit: number;
	sortBy: "vehicleName" | "createdAt" | "createdBy";
	sortOrder: "asc" | "desc";
}

export function VehiclesDataTable({
	data,
	total,
	offset,
	limit,
	sortBy,
	sortOrder,
}: VehiclesDataTableProps) {
	const router = useRouter();
	const currentPage = Math.floor(offset / limit) + 1;
	const totalPages = Math.ceil(total / limit);

	const handleSort = (newSortBy: string, newSortOrder: string) => {
		void router.navigate({
			to: ".",
			search: (prev) => ({
				...prev,
				sortBy: newSortBy as "vehicleName" | "createdAt" | "createdBy",
				sortOrder: newSortOrder as "asc" | "desc",
				offset: 0,
			}),
		});
	};

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

	const columns = createColumns(sortBy, sortOrder, handleSort);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<>
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
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No vehicles found.
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
		</>
	);
}
