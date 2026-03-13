import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 5;
const COLUMNS = 5;

export function EntriesDataTableSkeleton() {
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
									<Skeleton className="h-4 w-40" />
								</td>
								{/* Items count column */}
								<td className="p-2 align-middle whitespace-nowrap">
									<Skeleton className="h-4 w-12" />
								</td>
								{/* Amount column */}
								<td className="p-2 align-middle whitespace-nowrap">
									<Skeleton className="h-4 w-20" />
								</td>
								{/* Created column */}
								<td className="p-2 align-middle whitespace-nowrap">
									<Skeleton className="h-4 w-24" />
								</td>
								{/* Actions column */}
								<td className="p-2 align-middle whitespace-nowrap">
									<Skeleton className="h-4 w-16" />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
