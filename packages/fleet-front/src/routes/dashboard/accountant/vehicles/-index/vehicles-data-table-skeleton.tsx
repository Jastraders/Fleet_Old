import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 5;
const COLUMNS = 5;

export function VehiclesDataTableSkeleton() {
	return (
		<div className="w-full">
			<div className="overflow-hidden rounded-lg border">
				<table className="w-full caption-bottom text-sm">
					<thead className="[&_tr]:border-b">
						<tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
							{Array.from({ length: COLUMNS }, (_, index) => (
								<th
									// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items don't have real identities
									key={`col-${index}`}
									className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0"
								>
									<Skeleton className="h-4 w-24" />
								</th>
							))}
						</tr>
					</thead>
					<tbody className="[&_tr:last-child]:border-0">
						{Array.from({ length: ROWS }, (_, index) => (
							<tr
								// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items don't have real identities
								key={`row-${index}`}
								className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
							>
								{/* Vehicle column */}
								<td className="p-2 align-middle whitespace-nowrap">
									<div className="space-y-1.5">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-24" />
									</div>
								</td>
								{/* Type / Fuel column */}
								<td className="p-2 align-middle whitespace-nowrap">
									<div className="space-y-1.5">
										<Skeleton className="h-4 w-20" />
										<Skeleton className="h-3 w-16" />
									</div>
								</td>
								{/* Status column */}
								<td className="p-2 align-middle whitespace-nowrap">
									<Skeleton className="h-4 w-16" />
								</td>
								{/* Created column */}
								<td className="p-2 align-middle whitespace-nowrap">
									<Skeleton className="h-4 w-24" />
								</td>
								{/* Created By column */}
								<td className="p-2 align-middle whitespace-nowrap">
									<div className="flex items-center gap-2">
										<Skeleton className="h-8 w-8 rounded-full" />
										<Skeleton className="h-4 w-20" />
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
