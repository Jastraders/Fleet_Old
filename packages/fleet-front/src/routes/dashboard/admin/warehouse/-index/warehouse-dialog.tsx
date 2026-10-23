import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, PencilIcon, InfoIcon, Settings2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import * as v from "valibot";
import { ManageProductsDialog } from "./manage-products-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/orpc";

const warehouseFormSchema = v.object({
	section: v.picklist(["JAS", "JKM", "General"]),
	recordDate: v.pipe(v.string(), v.minLength(1, "Date is required")),
	productName: v.optional(v.string()),
	workersCount: v.union([v.number(), v.string()]),
	unionCount: v.union([v.number(), v.string()]),
	ratePerUnload: v.union([v.number(), v.string()]),
	totalUnloads: v.union([v.number(), v.string()]),
	status: v.optional(v.picklist(["paid", "unpaid"])),
	reason: v.optional(v.string()),
});

export type WarehouseSection = "JAS" | "JKM" | "General";

export interface WarehouseDialogProps {
	mode: "create" | "edit";
	defaultSection?: WarehouseSection;
	initialValues?: {
		id: string;
		section: WarehouseSection;
		recordDate: string;
		firmName?: string;
		productName?: string;
		workersCount: number;
		unionCount: number;
		ratePerUnload: number;
		totalUnloads: number;
		unionSum?: number;
		ownStaffAmount?: number;
		status?: "paid" | "unpaid";
		reason?: string;
	};
	onSuccess?: () => void;
}

export function formatWarehouseCurrency(amount: number): string {
	if (isNaN(amount) || !isFinite(amount)) return "₹0";
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

function ProductField({
	section,
	value,
	onChange,
	errors,
}: {
	section: WarehouseSection;
	value: string;
	onChange: (val: string) => void;
	errors?: any;
}) {
	const queryClient = useQueryClient();
	const [isAdding, setIsAdding] = useState(false);
	const [isManageOpen, setIsManageOpen] = useState(false);
	const [newProductName, setNewProductName] = useState("");
	const [addError, setAddError] = useState<string | null>(null);

	const { data: productsData, isLoading } = useQuery({
		...orpc.admin.warehouse.products.list.queryOptions({
			input: { section, includeArchived: false },
		}),
	});

	const products: string[] = productsData?.products || [];

	const createProductMutation = useMutation({
		...orpc.admin.warehouse.products.create.mutationOptions(),
		onSuccess: (res: any) => {
			const createdName = res.name;
			queryClient.setQueryData(
				orpc.admin.warehouse.products.list.key({ input: { section, includeArchived: false } }),
				(old: any) => {
					if (!old) return { products: [createdName] };
					const currentProducts: string[] = old.products || [];
					if (currentProducts.some((p) => p.toLowerCase() === createdName.toLowerCase())) {
						return old;
					}
					return {
						...old,
						products: [...currentProducts, createdName].sort((a, b) => a.localeCompare(b)),
					};
				}
			);
			queryClient.invalidateQueries({
				queryKey: orpc.admin.warehouse.products.list.key({ input: { section, includeArchived: false } }),
			});
			queryClient.invalidateQueries();
			onChange(createdName);
			setIsAdding(false);
			setNewProductName("");
			setAddError(null);
		},
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

		createProductMutation.mutate({ section, name: trimmed } as any);
	};

	return (
		<Field className="space-y-1.5">
			<div className="flex items-center justify-between">
				<FieldLabel>Product Name</FieldLabel>
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
						Add New Product for {section} Warehouse
					</div>
					<div className="flex gap-2">
						<Input
							placeholder="Enter product name (e.g. Rice Bags)"
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
						<option value={value}>{value} (Archived)</option>
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
			<FieldError errors={errors} />

			<ManageProductsDialog
				section={section}
				isOpen={isManageOpen}
				onOpenChange={setIsManageOpen}
				onSelectProduct={(selectedName) => onChange(selectedName)}
			/>
		</Field>
	);
}

export function WarehouseDialog({ mode, defaultSection = "JAS", initialValues, onSuccess }: WarehouseDialogProps) {
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);

	const section = initialValues?.section ?? defaultSection;

	const createMutation = useMutation({
		...orpc.admin.warehouse.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setIsOpen(false);
			form.reset();
			if (onSuccess) onSuccess();
		},
	});

	const updateMutation = useMutation({
		...orpc.admin.warehouse.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setIsOpen(false);
			if (onSuccess) onSuccess();
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;
	const serverError = createMutation.error?.message || updateMutation.error?.message;

	const form = useForm({
		defaultValues: {
			section: section,
			recordDate: initialValues?.recordDate ?? new Date().toISOString().split("T")[0],
			productName: initialValues?.productName ?? "",
			workersCount: mode === "edit" ? (initialValues?.workersCount ?? "") : "",
			unionCount: mode === "edit" ? (initialValues?.unionCount ?? "") : "",
			ratePerUnload: mode === "edit" ? (initialValues?.ratePerUnload ?? "") : "3.50",
			totalUnloads: mode === "edit" ? (initialValues?.totalUnloads ?? "") : "",
			status: initialValues?.status ?? "paid",
			reason: "",
		},
		validators: {
			onSubmit: warehouseFormSchema,
		},
		onSubmit: async ({ value }) => {
			setValidationError(null);
			const wc = value.workersCount === "" ? 0 : Number(value.workersCount);
			const uc = value.unionCount === "" ? 0 : Number(value.unionCount);
			const rate = value.ratePerUnload === "" ? 0 : Number(value.ratePerUnload);
			const unloads = value.totalUnloads === "" ? 0 : Number(value.totalUnloads);

			if (isNaN(wc) || isNaN(uc) || isNaN(rate) || isNaN(unloads) || wc < 0 || uc < 0 || rate < 0 || unloads < 0) {
				setValidationError("Numeric values cannot be negative or invalid");
				return;
			}

			if (mode === "edit" && !value.reason?.trim()) {
				setValidationError("A reason is required to edit this record");
				return;
			}

			const totalLabours = wc + uc;
			const totalValue = rate * unloads;
			const perPersonSalary = totalLabours > 0 ? totalValue / totalLabours : 0;
			const ownStaffSalary = perPersonSalary * wc;
			const unionSalary = perPersonSalary * uc;

			const payload = {
				section: value.section as WarehouseSection,
				recordDate: value.recordDate,
				firmName: initialValues?.firmName || "",
				productName: value.productName,
				workersCount: wc,
				unionCount: uc,
				ratePerUnload: rate,
				totalUnloads: unloads,
				unionSum: unionSalary,
				ownStaffAmount: ownStaffSalary,
				status: (value.status || initialValues?.status || "paid") as "paid" | "unpaid",
				reason: value.reason,
			};

			if (mode === "create") {
				createMutation.mutate(payload as any);
			} else {
				updateMutation.mutate({ ...payload, id: initialValues?.id } as any);
			}
		},
	});

	const handleOpenChange = useCallback((open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setValidationError(null);
			form.reset();
		}
	}, [form]);

	// Prevent wheel scroll changing numbers
	const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
		e.currentTarget.blur();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					mode === "create" ? (
						<Button>
							<PlusIcon className="h-4 w-4 mr-1" />
							Add Record
						</Button>
					) : (
						<Button variant="outline" size="sm">
							<PencilIcon className="h-4 w-4 mr-1" />
							Edit
						</Button>
					)
				}
			/>
			<DialogContent className="p-0 max-w-lg">
				<ScrollArea className="max-h-[calc(100svh-2rem)]" scrollFade>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
						className="p-6"
					>
						<DialogHeader>
							<DialogTitle>{mode === "create" ? `Add ${section} Warehouse Record` : `Edit ${section} Warehouse Record`}</DialogTitle>
							<DialogDescription>
								Fill in the warehouse details. All calculations update automatically.
							</DialogDescription>
						</DialogHeader>

						<FieldGroup className="my-4 space-y-4">
							<div>
								<form.Field name="recordDate">
									{(field) => (
										<Field>
											<FieldLabel>Date *</FieldLabel>
											<Input
												type="date"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									)}
								</form.Field>
							</div>

							<div>
								<form.Field name="productName">
									{(field) => (
										<ProductField
											section={section}
											value={field.state.value || ""}
											onChange={(val) => field.handleChange(val)}
											errors={field.state.meta.errors}
										/>
									)}
								</form.Field>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<form.Field name="workersCount">
									{(field) => (
										<Field>
											<FieldLabel>Regular Worker</FieldLabel>
											<Input
												type="number"
												step="any"
												placeholder="0"
												value={field.state.value}
												onWheel={handleWheel}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									)}
								</form.Field>

								<form.Field name="unionCount">
									{(field) => (
										<Field>
											<FieldLabel>Union Worker</FieldLabel>
											<Input
												type="number"
												step="any"
												placeholder="0"
												value={field.state.value}
												onWheel={handleWheel}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									)}
								</form.Field>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<form.Field name="ratePerUnload">
									{(field) => (
										<Field>
											<FieldLabel>Per Bag Price / Rate per Unload</FieldLabel>
											<Input
												type="number"
												step="any"
												placeholder="3.50"
												value={field.state.value}
												onWheel={handleWheel}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									)}
								</form.Field>

								<form.Field name="totalUnloads">
									{(field) => (
										<Field>
											<FieldLabel>Quantity (Unloads)</FieldLabel>
											<Input
												type="number"
												step="any"
												placeholder="0"
												value={field.state.value}
												onWheel={handleWheel}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									)}
								</form.Field>
							</div>

							{mode === "edit" && (
								<form.Field name="reason">
									{(field) => (
										<Field>
											<FieldLabel>Edit Reason *</FieldLabel>
											<Input
												placeholder="State reason for editing record..."
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									)}
								</form.Field>
							)}

							{/* Calculations Preview */}
							<form.Subscribe selector={(state) => state.values}>
								{(values) => {
									const wc = values.workersCount === "" || values.workersCount === undefined ? 0 : Number(values.workersCount) || 0;
									const uc = values.unionCount === "" || values.unionCount === undefined ? 0 : Number(values.unionCount) || 0;
									const rate = values.ratePerUnload === "" || values.ratePerUnload === undefined ? 0 : Number(values.ratePerUnload) || 0;
									const unloads = values.totalUnloads === "" || values.totalUnloads === undefined ? 0 : Number(values.totalUnloads) || 0;

									const totalLabours = wc + uc;
									const totalValue = rate * unloads;
									const perPersonSalary = totalLabours > 0 ? totalValue / totalLabours : 0;
									const ownStaffSalary = perPersonSalary * wc;
									const unionSalary = perPersonSalary * uc;

									return (
										<div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
											<h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Calculations Preview</h3>
											<div className="grid grid-cols-2 gap-y-2 pt-1 border-t">
												<div>Total Labours:</div>
												<div className="font-medium text-right">{totalLabours}</div>
												<div>Total Sum of Unloads:</div>
												<div className="font-medium text-right">{formatWarehouseCurrency(totalValue)}</div>
												<div className="font-semibold text-primary">Own Staff Salary:</div>
												<div className="font-bold text-right text-primary">{formatWarehouseCurrency(ownStaffSalary)}</div>
												<div className="font-semibold text-purple-600 dark:text-purple-400">Union Salary:</div>
												<div className="font-bold text-right text-purple-600 dark:text-purple-400">{formatWarehouseCurrency(unionSalary)}</div>
											</div>
										</div>
									);
								}}
							</form.Subscribe>

							{(validationError || serverError) && (
								<Alert variant="destructive">
									<InfoIcon className="h-4 w-4" />
									<AlertDescription>{validationError || serverError}</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter className="mt-4">
							<Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Saving..." : "Save Record"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}