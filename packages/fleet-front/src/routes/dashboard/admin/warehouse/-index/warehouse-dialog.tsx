import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, PencilIcon, InfoIcon } from "lucide-react";
import { useCallback, useState } from "react";
import * as v from "valibot";
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
	firmName: v.optional(v.string()),
	productName: v.optional(v.string()),
	workersCount: v.union([v.number(), v.string()]),
	unionCount: v.union([v.number(), v.string()]),
	ratePerUnload: v.union([v.number(), v.string()]),
	totalUnloads: v.union([v.number(), v.string()]),
	unionSum: v.union([v.number(), v.string()]),
	ownStaffAmount: v.union([v.number(), v.string()]),
	status: v.picklist(["paid", "unpaid"]),
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
		status: "paid" | "unpaid";
		reason?: string;
	};
	onSuccess?: () => void;
}

export function formatWarehouseCurrency(amount: number): string {
	if (isNaN(amount)) return "₹0";
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(amount);
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
			firmName: initialValues?.firmName ?? "",
			productName: initialValues?.productName ?? "",
			workersCount: mode === "edit" ? initialValues?.workersCount ?? "" : "",
			unionCount: mode === "edit" ? initialValues?.unionCount ?? "" : "",
			ratePerUnload: mode === "edit" ? initialValues?.ratePerUnload ?? "" : "",
			totalUnloads: mode === "edit" ? initialValues?.totalUnloads ?? "" : "",
			unionSum: mode === "edit" ? initialValues?.unionSum ?? "" : "",
			ownStaffAmount: mode === "edit" ? initialValues?.ownStaffAmount ?? "" : "",
			status: initialValues?.status ?? "unpaid",
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
			const uSum = value.unionSum === "" ? 0 : Number(value.unionSum);
			const oStaff = value.ownStaffAmount === "" ? 0 : Number(value.ownStaffAmount);

			if (wc < 0 || uc < 0 || rate < 0 || unloads < 0 || uSum < 0 || oStaff < 0) {
				setValidationError("Numeric values cannot be negative");
				return;
			}

			if (mode === "edit" && !value.reason?.trim()) {
				setValidationError("A reason is required to edit this record");
				return;
			}

			const payload = {
				section: value.section as WarehouseSection,
				recordDate: value.recordDate,
				firmName: value.firmName,
				productName: value.productName,
				workersCount: wc,
				unionCount: uc,
				ratePerUnload: rate,
				totalUnloads: unloads,
				unionSum: uSum,
				ownStaffAmount: oStaff,
				status: value.status as "paid" | "unpaid",
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
							<div className="grid grid-cols-2 gap-4">
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

								<form.Field name="status">
									{(field) => (
										<Field>
											<FieldLabel>Payment Status</FieldLabel>
											<select
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value as "paid" | "unpaid")}
												className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
											>
												<option value="unpaid">Unpaid</option>
												<option value="paid">Paid</option>
											</select>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									)}
								</form.Field>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<form.Field name="firmName">
									{(field) => (
										<Field>
											<FieldLabel>Firm Name</FieldLabel>
											<Input
												placeholder="e.g. ABC Traders"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									)}
								</form.Field>

								<form.Field name="productName">
									{(field) => (
										<Field>
											<FieldLabel>Product Name</FieldLabel>
											<Input
												placeholder="e.g. Rice Bags"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
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
												placeholder="0.00"
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

							<div className="grid grid-cols-2 gap-4">
								<form.Field name="unionSum">
									{(field) => (
										<Field>
											<FieldLabel>Union Sum (Total Union Amount)</FieldLabel>
											<Input
												type="number"
												step="any"
												placeholder="0.00"
												value={field.state.value}
												onWheel={handleWheel}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									)}
								</form.Field>

								<form.Field name="ownStaffAmount">
									{(field) => (
										<Field>
											<FieldLabel>Own Staff Amount</FieldLabel>
											<Input
												type="number"
												step="any"
												placeholder="0.00"
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
									const wc = values.workersCount === "" ? 0 : Number(values.workersCount) || 0;
									const uc = values.unionCount === "" ? 0 : Number(values.unionCount) || 0;
									const rate = values.ratePerUnload === "" ? 0 : Number(values.ratePerUnload) || 0;
									const unloads = values.totalUnloads === "" ? 0 : Number(values.totalUnloads) || 0;
									const uSum = values.unionSum === "" ? 0 : Number(values.unionSum) || 0;
									const oStaff = values.ownStaffAmount === "" ? 0 : Number(values.ownStaffAmount) || 0;

									const totalLabours = wc + uc;
									const totalValue = rate * unloads;

									let workersSalary = 0;
									if (oStaff > 0) {
										workersSalary = oStaff;
									} else if (totalLabours > 0) {
										workersSalary = (totalValue / totalLabours) * wc;
									}

									let unionSalary = 0;
									if (uSum > 0) {
										unionSalary = uSum;
									} else if (totalLabours > 0) {
										unionSalary = (totalValue / totalLabours) * uc;
									}

									return (
										<div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
											<h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Calculations Preview</h3>
											<div className="grid grid-cols-2 gap-y-2 pt-1 border-t">
												<div>Total Labours:</div>
												<div className="font-medium text-right">{totalLabours}</div>
												<div>Total Sum of Unloads:</div>
												<div className="font-medium text-right">{formatWarehouseCurrency(totalValue)}</div>
												<div className="font-semibold text-primary">Total Workers Salary:</div>
												<div className="font-bold text-right text-primary">{formatWarehouseCurrency(workersSalary)}</div>
												<div className="font-semibold text-purple-600 dark:text-purple-400">Total Union Salary:</div>
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