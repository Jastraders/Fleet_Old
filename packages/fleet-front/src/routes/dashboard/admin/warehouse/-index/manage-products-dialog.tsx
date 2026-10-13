import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
	ArchiveIcon,
	RotateCcwIcon,
	Trash2Icon,
	PlusIcon,
	SearchIcon,
	PackageIcon,
	AlertTriangleIcon,
} from "lucide-react";
import { orpc } from "@/orpc";
import type { WarehouseSection } from "@/routes/dashboard/admin/warehouse/-index/warehouse-dialog";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProductItem {
	id: string;
	section: string;
	name: string;
	status: "active" | "archived";
	inUse: boolean;
	recordCount: number;
	createdAt: string;
}

interface ManageProductsDialogProps {
	section: WarehouseSection;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectProduct?: (name: string) => void;
}

export function ManageProductsDialog({
	section,
	isOpen,
	onOpenChange,
	onSelectProduct,
}: ManageProductsDialogProps) {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
	const [newProductName, setNewProductName] = useState("");
	const [addError, setAddError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);

	const { data, isLoading } = useQuery({
		...orpc.admin.warehouse.products.manage_list.queryOptions({
			input: { section },
		}),
		enabled: isOpen,
	});

	const products: ProductItem[] = data?.products || [];

	const invalidateAll = () => {
		queryClient.invalidateQueries();
	};

	const createMutation = useMutation({
		...orpc.admin.warehouse.products.create.mutationOptions(),
		onSuccess: (res: any) => {
			invalidateAll();
			setNewProductName("");
			setAddError(null);
			if (onSelectProduct && res.name) {
				onSelectProduct(res.name);
			}
		},
		onError: (err: any) => {
			setAddError(err?.message || "Failed to create product");
		},
	});

	const archiveMutation = useMutation({
		...orpc.admin.warehouse.products.archive.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			setActionError(null);
		},
		onError: (err: any) => {
			setActionError(err?.message || "Failed to archive product");
		},
	});

	const restoreMutation = useMutation({
		...orpc.admin.warehouse.products.restore.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			setActionError(null);
		},
		onError: (err: any) => {
			setActionError(err?.message || "Failed to restore product");
		},
	});

	const deleteMutation = useMutation({
		...orpc.admin.warehouse.products.delete.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			setProductToDelete(null);
			setActionError(null);
		},
		onError: (err: any) => {
			setActionError(err?.message || "Failed to delete product");
			setProductToDelete(null);
		},
	});

	const handleAddProduct = () => {
		const trimmed = newProductName.trim();
		if (!trimmed) {
			setAddError("Product name cannot be empty");
			return;
		}

		createMutation.mutate({ section, name: trimmed } as any);
	};

	const filteredProducts = useMemo(() => {
		return products.filter((p) => {
			if (statusFilter !== "all" && p.status !== statusFilter) {
				return false;
			}
			if (search.trim()) {
				return p.name.toLowerCase().includes(search.trim().toLowerCase());
			}
			return true;
		});
	}, [products, statusFilter, search]);

	const activeCount = useMemo(() => products.filter((p) => p.status === "active").length, [products]);
	const archivedCount = useMemo(() => products.filter((p) => p.status === "archived").length, [products]);

	return (
		<>
			<Dialog open={isOpen} onOpenChange={onOpenChange}>
				<DialogContent className="p-0 max-w-2xl max-h-[90vh] flex flex-col">
					<div className="p-6 pb-2">
						<DialogHeader>
							<div className="flex items-center gap-2">
								<PackageIcon className="h-5 w-5 text-primary" />
								<DialogTitle className="text-lg">Manage {section} Products</DialogTitle>
							</div>
							<DialogDescription className="text-xs">
								Manage active and archived product names for {section} Warehouse.
							</DialogDescription>
						</DialogHeader>

						{/* Quick Add Product Bar */}
						<div className="mt-4 p-3 rounded-lg border bg-muted/40 space-y-2">
							<div className="text-xs font-semibold text-foreground">
								Add Product to {section} Warehouse
							</div>
							<div className="flex gap-2">
								<Input
									placeholder="Enter product name (e.g. Cement 50kg)"
									value={newProductName}
									onChange={(e) => {
										setNewProductName(e.target.value);
										setAddError(null);
									}}
									className="h-8 text-xs"
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleAddProduct();
										}
									}}
								/>
								<Button
									size="sm"
									onClick={handleAddProduct}
									disabled={createMutation.isPending || !newProductName.trim()}
									className="h-8 text-xs shrink-0"
								>
									<PlusIcon className="h-3.5 w-3.5 mr-1" />
									{createMutation.isPending ? "Adding..." : "Add Product"}
								</Button>
							</div>
							{addError && <p className="text-xs text-destructive">{addError}</p>}
						</div>

						{actionError && (
							<div className="mt-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
								<AlertTriangleIcon className="h-4 w-4 shrink-0" />
								<span>{actionError}</span>
							</div>
						)}

						{/* Filter & Search Bar */}
						<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
							<div className="flex rounded-md border bg-muted/30 p-0.5 text-xs">
								<button
									type="button"
									onClick={() => setStatusFilter("all")}
									className={`px-3 py-1 rounded-sm font-medium transition-colors cursor-pointer ${
										statusFilter === "all"
											? "bg-background text-foreground shadow-2xs font-semibold"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									All ({products.length})
								</button>
								<button
									type="button"
									onClick={() => setStatusFilter("active")}
									className={`px-3 py-1 rounded-sm font-medium transition-colors cursor-pointer ${
										statusFilter === "active"
											? "bg-background text-foreground shadow-2xs font-semibold"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Active ({activeCount})
								</button>
								<button
									type="button"
									onClick={() => setStatusFilter("archived")}
									className={`px-3 py-1 rounded-sm font-medium transition-colors cursor-pointer ${
										statusFilter === "archived"
											? "bg-background text-foreground shadow-2xs font-semibold"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Archived ({archivedCount})
								</button>
							</div>

							<div className="relative w-48 sm:w-56">
								<SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									placeholder="Filter products..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-8 h-8 text-xs"
								/>
							</div>
						</div>
					</div>

					{/* Products Table */}
					<div className="flex-1 min-h-0 px-6 pb-6">
						<ScrollArea className="h-[340px] rounded-md border">
							{isLoading ? (
								<div className="p-8 text-center text-xs text-muted-foreground">
									Loading products...
								</div>
							) : filteredProducts.length === 0 ? (
								<div className="p-8 text-center text-xs text-muted-foreground">
									No products found matching your filter.
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="text-xs">Product Name</TableHead>
											<TableHead className="text-xs w-28">Status</TableHead>
											<TableHead className="text-xs w-36">Usage</TableHead>
											<TableHead className="text-xs text-right w-36">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredProducts.map((prod) => (
											<TableRow key={prod.id}>
												<TableCell className="text-xs font-medium">
													{prod.name}
												</TableCell>
												<TableCell>
													{prod.status === "active" ? (
														<Badge
															variant="outline"
															className="text-[10px] py-0 px-2 text-emerald-600 bg-emerald-500/10 border-emerald-500/20 font-medium"
														>
															Active
														</Badge>
													) : (
														<Badge
															variant="outline"
															className="text-[10px] py-0 px-2 text-muted-foreground bg-muted font-medium"
														>
															Archived
														</Badge>
													)}
												</TableCell>
												<TableCell className="text-xs">
													{prod.recordCount > 0 ? (
														<span className="text-muted-foreground font-medium">
															Used in {prod.recordCount}{" "}
															{prod.recordCount === 1 ? "record" : "records"}
														</span>
													) : (
														<span className="text-muted-foreground/50 italic">
															Unused
														</span>
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1">
														{prod.status === "active" ? (
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	archiveMutation.mutate({
																		section,
																		id: prod.id,
																	} as any)
																}
																disabled={archiveMutation.isPending}
																title="Archive this product (hides from new records)"
																className="h-7 px-2 text-xs"
															>
																<ArchiveIcon className="h-3 w-3 mr-1" />
																Archive
															</Button>
														) : (
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	restoreMutation.mutate({
																		section,
																		id: prod.id,
																	} as any)
																}
																disabled={restoreMutation.isPending}
																title="Restore this product to active"
																className="h-7 px-2 text-xs"
															>
																<RotateCcwIcon className="h-3 w-3 mr-1" />
																Restore
															</Button>
														)}

														{prod.inUse ? (
															<Button
																variant="ghost"
																size="sm"
																disabled
																title={`Cannot delete: used in ${prod.recordCount} record(s). Archive it instead.`}
																className="h-7 px-2 text-xs opacity-40 cursor-not-allowed"
															>
																<Trash2Icon className="h-3 w-3" />
															</Button>
														) : (
															<Button
																variant="ghost"
																size="sm"
																onClick={() => setProductToDelete(prod)}
																title="Permanently delete unused product"
																className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
															>
																<Trash2Icon className="h-3 w-3" />
															</Button>
														)}
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</ScrollArea>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Alert Dialog */}
			<AlertDialog
				open={!!productToDelete}
				onOpenChange={(open) => !open && setProductToDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Permanently Delete Product?</AlertDialogTitle>
						<AlertDialogDescription className="text-xs">
							Are you sure you want to permanently delete{" "}
							<span className="font-semibold text-foreground">
								&quot;{productToDelete?.name}&quot;
							</span>{" "}
							from {section} Warehouse? This product is unused and has no recorded transactions. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								if (productToDelete) {
									deleteMutation.mutate({
										section,
										id: productToDelete.id,
									} as any);
								}
							}}
							disabled={deleteMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
