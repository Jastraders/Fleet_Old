import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PlusIcon, Settings2Icon } from "lucide-react";
import { orpc } from "@/orpc";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AccountingManageProductsDialog } from "./accounting-manage-products-dialog";

interface AccountingProductFieldProps {
	value?: string | null;
	onChange: (val: string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: TanStack Form errors type
	errors?: any;
	label?: string;
	optional?: boolean;
}

export function AccountingProductField({
	value,
	onChange,
	errors,
	label = "Product Name",
	optional = true,
}: AccountingProductFieldProps) {
	const queryClient = useQueryClient();
	const [isAdding, setIsAdding] = useState(false);
	const [isManageOpen, setIsManageOpen] = useState(false);
	const [newProductName, setNewProductName] = useState("");
	const [addError, setAddError] = useState<string | null>(null);

	const { data: productsData, isLoading } = useQuery({
		...orpc.accountant.products.list.queryOptions({
			input: { includeArchived: false },
		}),
	});

	const products: string[] = productsData?.products || [];

	const createProductMutation = useMutation({
		...orpc.accountant.products.create.mutationOptions(),
		// biome-ignore lint/suspicious/noExplicitAny: response object
		onSuccess: (res: any) => {
			const createdName = res.name;
			queryClient.invalidateQueries();
			onChange(createdName);
			setIsAdding(false);
			setNewProductName("");
			setAddError(null);
		},
		// biome-ignore lint/suspicious/noExplicitAny: error object
		onError: (err: any) => {
			setAddError(err?.message || "Failed to add product");
		},
	});

	const handleAddProduct = () => {
		const trimmed = newProductName.trim();
		if (!trimmed) {
			setAddError("Product name cannot be empty");
			return;
		}

		const duplicate = products.find((p) => p.toLowerCase() === trimmed.toLowerCase());
		if (duplicate) {
			onChange(duplicate);
			setIsAdding(false);
			setNewProductName("");
			setAddError(null);
			return;
		}

		// biome-ignore lint/suspicious/noExplicitAny: payload structure
		createProductMutation.mutate({ name: trimmed } as any);
	};

	return (
		<Field className="space-y-1.5">
			<div className="flex items-center justify-between">
				<FieldLabel htmlFor="accounting-product-select">
					{label} {optional && <span className="text-muted-foreground font-normal">(Optional)</span>}
				</FieldLabel>
				<div className="flex items-center gap-3">
					{!isAdding && (
						<button
							type="button"
							onClick={() => {
								setIsAdding(true);
								setAddError(null);
							}}
							className="text-xs text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
						>
							<PlusIcon className="h-3 w-3" />
							Add New Product
						</button>
					)}
					<button
						type="button"
						onClick={() => setIsManageOpen(true)}
						className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium flex items-center gap-1 cursor-pointer"
					>
						<Settings2Icon className="h-3 w-3" />
						Manage Products
					</button>
				</div>
			</div>

			{isAdding ? (
				<div className="space-y-2 p-3 rounded-lg border bg-muted/40">
					<div className="text-xs font-semibold text-foreground">
						Add New Product
					</div>
					<div className="flex gap-2">
						<Input
							placeholder="Enter product name (e.g. Iron Sheets)"
							value={newProductName}
							onChange={(e) => {
								setNewProductName(e.target.value);
								setAddError(null);
							}}
							autoFocus
							className="h-8 text-xs"
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleAddProduct();
								}
							}}
						/>
						<Button
							type="button"
							size="sm"
							onClick={handleAddProduct}
							disabled={createProductMutation.isPending}
							className="h-8 text-xs shrink-0"
						>
							{createProductMutation.isPending ? "Adding..." : "Add"}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								setIsAdding(false);
								setNewProductName("");
								setAddError(null);
							}}
							className="h-8 text-xs shrink-0"
						>
							Cancel
						</Button>
					</div>
					{addError && <p className="text-xs text-destructive">{addError}</p>}
				</div>
			) : (
				<select
					id="accounting-product-select"
					value={value || ""}
					onChange={(e) => {
						if (e.target.value === "__add_new__") {
							setIsAdding(true);
							setAddError(null);
						} else if (e.target.value === "__manage__") {
							setIsManageOpen(true);
						} else {
							onChange(e.target.value);
						}
					}}
					className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<option value="">{isLoading ? "Loading products..." : "Select a product..."}</option>
					{value && !products.some((p) => p.toLowerCase() === value.toLowerCase()) && (
						<option value={value}>{value} (Historical / Custom)</option>
					)}
					{products.map((p) => (
						<option key={p} value={p}>
							{p}
						</option>
					))}
					<option value="__add_new__">+ Add New Product...</option>
					<option value="__manage__">⚙ Manage Products...</option>
				</select>
			)}
			{errors && <FieldError errors={errors} />}

			<AccountingManageProductsDialog
				isOpen={isManageOpen}
				onOpenChange={setIsManageOpen}
				onSelectProduct={(selectedName) => onChange(selectedName)}
			/>
		</Field>
	);
}
