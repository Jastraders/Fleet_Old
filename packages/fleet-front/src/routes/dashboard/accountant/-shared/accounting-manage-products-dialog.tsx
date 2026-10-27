import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	ArchiveIcon,
	PackageIcon,
	PlusIcon,
	RotateCcwIcon,
	SearchIcon,
	Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/orpc";

interface ProductItem {
	id: string;
	name: string;
	status: "active" | "archived";
	inUse: boolean;
	recordCount: number;
	createdAt: string;
}

interface AccountingManageProductsDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectProduct?: (name: string) => void;
}

export function AccountingManageProductsDialog({
	isOpen,
	onOpenChange,
	onSelectProduct,
}: AccountingManageProductsDialogProps) {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		"all" | "active" | "archived"
	>("all");
	const [newProductName, setNewProductName] = useState("");
	const [addError, setAddError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [productToDelete, setProductToDelete] = useState<ProductItem | null>(
		null,
	);

	const { data, isLoading } = useQuery({
		...orpc.accountant.products.manage_list.queryOptions({
			input: {},
		}),
		enabled: isOpen,
	});

	const products: ProductItem[] = data?.products || [];

	const invalidateAll = () => {
		queryClient.invalidateQueries();
	};

	const createMutation = useMutation({
		...orpc.accountant.products.create.mutationOptions(),
		// biome-ignore lint/suspicious/noExplicitAny: response object
		onSuccess: (res: any) => {
			invalidateAll();
			setNewProductName("");
			setAddError(null);
			if (onSelectProduct && res.name) {
				onSelectProduct(res.name);
			}
		},
		// biome-ignore lint/suspicious/noExplicitAny: error object
		onError: (err: any) => {
			setAddError(err?.message || "Failed to create product");
		},
	});

	const archiveMutation = useMutation({
		...orpc.accountant.products.archive.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			setActionError(null);
		},
		// biome-ignore lint/suspicious/noExplicitAny: error object
		onError: (err: any) => {
			setActionError(err?.message || "Failed to archive product");
		},
	});

	const restoreMutation = useMutation({
		...orpc.accountant.products.restore.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			setActionError(null);
		},
		// biome-ignore lint/suspicious/noExplicitAny: error object
		onError: (err: any) => {
			setActionError(err?.message || "Failed to restore product");
		},
	});

	const deleteMutation = useMutation({
		...orpc.accountant.products.delete.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			setProductToDelete(null);
			setActionError(null);
		},
		// biome-ignore lint/suspicious/noExplicitAny: error object
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

		// biome-ignore lint/suspicious/noExplicitAny: mutation input
		createMutation.mutate({ name: trimmed } as any);
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

	const activeCount = useMemo(
		() => products.filter((p) => p.status === "active").length,
		[products],
	);
	const archivedCount = useMemo(
		() => products.filter((p) => p.status === "archived").length,
		[products],
	);

	return (
		<>
			<Dialog open={isOpen} onOpenChange={onOpenChange}>
				<DialogContent className="p-0 max-w-2xl max-h-[90vh] flex flex-col">
					<div className="p-6 pb-2">
						<DialogHeader>
							<div className="flex items-center gap-2">
								<PackageIcon className="h-5 w-5 text-primary" />
								<DialogTitle className="text-lg">
									Manage Accounting Products
								</DialogTitle>
							</div>
							<DialogDescription className="text-xs">
								Manage active and archived product names for Journal and
								Expenses.
							</DialogDescription>
						</DialogHeader>

						{/* Quick Add Product Bar */}
						<div className="mt-4 p-3 rounded-lg border bg-muted/40 space-y-2">
							<div className="text-xs font-semibold text-foreground">
								Add Product to Accounting Catalog
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
									disabled={createMutation.isPending}
									className="h-8 text-xs shrink-0"
								>
									<PlusIcon className="h-3.5 w-3.5 mr-1" />
									{createMutation.isPending ? "Adding..." : "Add"}
								</Button>
							</div>
							{addError && (
								<p className="text-xs text-destructive">{addError}</p>
							)}
						</div>

						{/* Search and Status Tabs */}
						<div className="mt-4 flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
							<div className="relative flex-1">
								<SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									placeholder="Search products..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="h-8 text-xs pl-8"
								/>
							</div>
							<div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
								<Button
									variant={statusFilter === "all" ? "default" : "ghost"}
									size="sm"
									onClick={() => setStatusFilter("all")}
									className="h-7 text-xs px-2.5"
								>
									All ({products.length})
								</Button>
								<Button
									variant={statusFilter === "active" ? "default" : "ghost"}
									size="sm"
									onClick={() => setStatusFilter("active")}
									className="h-7 text-xs px-2.5"
								>
									Active ({activeCount})
								</Button>
								<Button
									variant={statusFilter === "archived" ? "default" : "ghost"}
									size="sm"
									onClick={() => setStatusFilter("archived")}
									className="h-7 text-xs px-2.5"
								>
									Archived ({archivedCount})
								</Button>
							</div>
						</div>

						{actionError && (
							<div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
								<AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
								<span>{actionError}</span>
							</div>
						)}
					</div>

					{/* Product List Table */}
					<ScrollArea className="flex-1 max-h-[360px] px-6">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-xs">Product Name</TableHead>
									<TableHead className="text-xs w-[100px]">Status</TableHead>
									<TableHead className="text-xs w-[100px] text-center">
										Usage
									</TableHead>
									<TableHead className="text-xs w-[140px] text-right">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="text-center py-8 text-xs text-muted-foreground"
										>
											Loading products...
										</TableCell>
									</TableRow>
								) : filteredProducts.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="text-center py-8 text-xs text-muted-foreground"
										>
											{search
												? "No products match your search."
												: "No products found."}
										</TableCell>
									</TableRow>
								) : (
									filteredProducts.map((p) => {
										const isActive = p.status === "active";
										return (
											<TableRow key={p.id}>
												<TableCell className="text-xs font-medium">
													<div className="flex items-center gap-2">
														<span>{p.name}</span>
														{onSelectProduct && isActive && (
															<Button
																variant="ghost"
																size="sm"
																onClick={() => {
																	onSelectProduct(p.name);
																	onOpenChange(false);
																}}
																className="h-5 text-[10px] px-1.5 text-primary hover:text-primary"
															>
																Select
															</Button>
														)}
													</div>
												</TableCell>
												<TableCell>
													<Badge
														variant={isActive ? "default" : "secondary"}
														className="text-[10px] font-normal"
													>
														{isActive ? "Active" : "Archived"}
													</Badge>
												</TableCell>
												<TableCell className="text-xs text-center text-muted-foreground">
													{p.recordCount > 0 ? (
														<span className="font-medium text-foreground">
															{p.recordCount} entries
														</span>
													) : (
														<span className="text-muted-foreground/60">
															Unused
														</span>
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1">
														{isActive ? (
															<Button
																variant="ghost"
																size="icon"
																title="Archive product (keeps historical records safe)"
																disabled={archiveMutation.isPending}
																// biome-ignore lint/suspicious/noExplicitAny: mutation input
																onClick={() =>
																	archiveMutation.mutate({ id: p.id } as any)
																}
																className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
															>
																<ArchiveIcon className="h-3.5 w-3.5" />
															</Button>
														) : (
															<Button
																variant="ghost"
																size="icon"
																title="Restore product to active list"
																disabled={restoreMutation.isPending}
																// biome-ignore lint/suspicious/noExplicitAny: mutation input
																onClick={() =>
																	restoreMutation.mutate({ id: p.id } as any)
																}
																className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
															>
																<RotateCcwIcon className="h-3.5 w-3.5" />
															</Button>
														)}

														{!p.inUse && (
															<Button
																variant="ghost"
																size="icon"
																title="Permanently delete unused product"
																onClick={() => setProductToDelete(p)}
																className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
															>
																<Trash2Icon className="h-3.5 w-3.5" />
															</Button>
														)}
													</div>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</ScrollArea>

					<div className="p-4 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
						<span>
							Used products cannot be permanently deleted to protect ledger
							history.
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => onOpenChange(false)}
						>
							Close
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Alert */}
			<AlertDialog
				open={!!productToDelete}
				onOpenChange={(open) => !open && setProductToDelete(null)}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-sm">
							Delete Product?
						</AlertDialogTitle>
						<AlertDialogDescription className="text-xs">
							Are you sure you want to permanently delete{" "}
							<strong>{productToDelete?.name}</strong>? This product has never
							been used in accounting records.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="text-xs h-8">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (productToDelete) {
									// biome-ignore lint/suspicious/noExplicitAny: mutation input
									deleteMutation.mutate({ id: productToDelete.id } as any);
								}
							}}
							disabled={deleteMutation.isPending}
							className="text-xs h-8 bg-destructive hover:bg-destructive/90"
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
