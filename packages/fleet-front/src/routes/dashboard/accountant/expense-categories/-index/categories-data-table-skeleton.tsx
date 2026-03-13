import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export function CategoriesDataTableSkeleton() {
	return (
		<div className="w-full space-y-4">
			<div className="flex justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Categories</h1>
					<p className="text-muted-foreground text-sm">
						Manage your expense categories
					</p>
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted sticky top-0 z-10">
						<TableRow>
							<TableHead>Category</TableHead>
							<TableHead>Created</TableHead>
							<TableHead className="w-10">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 5 }).map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no meaningful IDs
							<TableRow key={`skeleton-${i}`}>
								<TableCell>
									<div className="flex items-center gap-3">
										<Skeleton className="h-8 w-8 rounded" />
										<Skeleton className="h-4 w-32" />
									</div>
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-20" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-8 w-8" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
