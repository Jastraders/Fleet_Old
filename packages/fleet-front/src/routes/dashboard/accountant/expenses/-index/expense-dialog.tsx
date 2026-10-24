import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Loader2Icon, ReceiptTextIcon } from "lucide-react";
import { orpc } from "@/orpc";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CategorySelectField } from "@/routes/dashboard/accountant/journal-entries/-index/select-fields/category-select-field";
import { VehicleSelectField } from "@/routes/dashboard/accountant/journal-entries/-index/select-fields/vehicle-select-field";
import { DriverSelectField } from "@/routes/dashboard/accountant/journal-entries/-index/select-fields/driver-select-field";
import { AccountingProductField } from "@/routes/dashboard/accountant/-shared/accounting-product-field";

interface ExpenseDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function ExpenseDialog({
	isOpen,
	onOpenChange,
	onSuccess,
}: ExpenseDialogProps) {
	const queryClient = useQueryClient();

	const [expenseCategoryId, setExpenseCategoryId] = useState("");
	const [transactionDate, setTransactionDate] = useState(
		new Date().toISOString().split("T")[0],
	);
	const [vehicleId, setVehicleId] = useState("");
	const [driverId, setDriverId] = useState("");
	const [handler, setHandler] = useState("Driver");
	const [productName, setProductName] = useState("");
	const [amountMode, setAmountMode] = useState<"direct" | "calculated">("direct");
	const [amount, setAmount] = useState("");
	const [quantity, setQuantity] = useState("");
	const [perItemRate, setPerItemRate] = useState("");
	const [hasManuallyEditedAmount, setHasManuallyEditedAmount] = useState(false);
	const [depo, setDepo] = useState("");
	const [deliveryLocation, setDeliveryLocation] = useState("");
	const [nextRenewalDate, setNextRenewalDate] = useState("");
	const [notes, setNotes] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);

	// Reset state when opening
	useEffect(() => {
		if (isOpen) {
			setExpenseCategoryId("");
			setTransactionDate(new Date().toISOString().split("T")[0]);
			setVehicleId("");
			setDriverId("");
			setHandler("Driver");
			setProductName("");
			setAmountMode("direct");
			setAmount("");
			setQuantity("");
			setPerItemRate("");
			setHasManuallyEditedAmount(false);
			setDepo("");
			setDeliveryLocation("");
			setNextRenewalDate("");
			setNotes("");
			setValidationError(null);
		}
	}, [isOpen]);

	// Auto-calculate amount when in calculated mode unless user manually overrides
	useEffect(() => {
		if (amountMode === "calculated" && !hasManuallyEditedAmount) {
			const q = parseFloat(quantity) || 0;
			const r = parseFloat(perItemRate) || 0;
			if (q > 0 && r > 0) {
				setAmount((q * r).toFixed(2));
			}
		}
	}, [amountMode, quantity, perItemRate, hasManuallyEditedAmount]);

	const createExpenseMutation = useMutation({
		...orpc.accountant.expenses.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			onOpenChange(false);
			if (onSuccess) onSuccess();
		},
		// biome-ignore lint/suspicious/noExplicitAny: error object
		onError: (err: any) => {
			setValidationError(err?.message || "Failed to create expense");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setValidationError(null);

		if (!expenseCategoryId) {
			setValidationError("Please select an Expense Category.");
			return;
		}

		const parsedAmount = parseFloat(amount);
		if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
			setValidationError("Please enter a valid expense amount greater than 0.");
			return;
		}

		createExpenseMutation.mutate({
			expenseCategoryId,
			transactionDate,
			vehicleId: vehicleId || undefined,
			driverId: driverId || undefined,
			handler: handler.trim() || "Driver",
			productName: productName.trim() || undefined,
			amount: parsedAmount.toString(),
			quantity: amountMode === "calculated" && quantity ? quantity : undefined,
			perItemRate: amountMode === "calculated" && perItemRate ? perItemRate : undefined,
			depo: depo.trim() || undefined,
			deliveryLocation: deliveryLocation.trim() || undefined,
			nextRenewalDate: nextRenewalDate || undefined,
			notes: notes.trim() || undefined,
			// biome-ignore lint/suspicious/noExplicitAny: payload structure
		} as any);
	};

	const calcValue = (parseFloat(quantity) || 0) * (parseFloat(perItemRate) || 0);

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<div className="rounded-md bg-destructive/10 p-1.5 text-destructive">
							<ReceiptTextIcon className="h-4 w-4" />
						</div>
						<DialogTitle className="text-lg">Add New Expense</DialogTitle>
					</div>
					<DialogDescription className="text-xs">
						Record a standalone vehicle or company expense directly in the Expenses ledger.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 pt-2">
					{validationError && (
						<Alert variant="destructive" className="py-2 px-3 text-xs">
							<AlertDescription>{validationError}</AlertDescription>
						</Alert>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{/* Category */}
						<div>
							<Field>
								<FieldLabel htmlFor="expense-category">
									Expense Category <span className="text-destructive">*</span>
								</FieldLabel>
								<CategorySelectField
									fieldId="expense-category"
									value={expenseCategoryId}
									onChange={(val) => {
										setExpenseCategoryId(val);
										setValidationError(null);
									}}
									onBlur={() => {}}
								/>
							</Field>
						</div>

						{/* Transaction Date */}
						<div>
							<Field>
								<FieldLabel htmlFor="expense-date">
									Expense Date <span className="text-destructive">*</span>
								</FieldLabel>
								<Input
									id="expense-date"
									type="date"
									value={transactionDate}
									onChange={(e) => setTransactionDate(e.target.value)}
									required
								/>
							</Field>
						</div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{/* Vehicle */}
						<div>
							<Field>
								<FieldLabel htmlFor="expense-vehicle">Vehicle</FieldLabel>
								<VehicleSelectField
									fieldId="expense-vehicle"
									value={vehicleId}
									onChange={(val) => setVehicleId(val)}
									onBlur={() => {}}
								/>
							</Field>
						</div>

						{/* Driver */}
						<div>
							<Field>
								<FieldLabel htmlFor="expense-driver">Driver</FieldLabel>
								<DriverSelectField
									fieldId="expense-driver"
									value={driverId}
									onChange={(val) => setDriverId(val)}
									onBlur={() => {}}
								/>
							</Field>
						</div>
					</div>

					{/* Product Name with Dropdown & Manage Products */}
					<AccountingProductField
						value={productName}
						onChange={(val) => setProductName(val)}
					/>

					{/* Amount Entry Mode */}
					<div className="space-y-3 p-3 rounded-lg border bg-muted/20">
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Field>
								<FieldLabel>Amount Entry Mode</FieldLabel>
								<select
									value={amountMode}
									onChange={(e) => {
										const mode = e.target.value as "direct" | "calculated";
										setAmountMode(mode);
										setHasManuallyEditedAmount(false);
										if (mode === "calculated") {
											const q = parseFloat(quantity) || 0;
											const r = parseFloat(perItemRate) || 0;
											if (q > 0 && r > 0) {
												setAmount((q * r).toFixed(2));
											}
										}
									}}
									className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								>
									<option value="direct">Direct Amount</option>
									<option value="calculated">Calculated Amount (Qty × Rate)</option>
								</select>
							</Field>

							{/* Final Expense Amount Input (Always editable) */}
							<Field>
								<FieldLabel htmlFor="expense-amount">
									Amount (₹) <span className="text-destructive">*</span>
								</FieldLabel>
								<InputGroup>
									<InputGroupAddon>₹</InputGroupAddon>
									<InputGroupInput
										id="expense-amount"
										type="number"
										step="0.01"
										min="0.01"
										value={amount}
										onChange={(e) => {
											setAmount(e.target.value);
											setHasManuallyEditedAmount(true);
										}}
										placeholder="0.00"
										required
									/>
								</InputGroup>
							</Field>
						</div>

						{/* Calculated Mode Subfields */}
						{amountMode === "calculated" && (
							<div className="grid grid-cols-2 gap-4 pt-1">
								<Field>
									<FieldLabel htmlFor="expense-qty">Quantity</FieldLabel>
									<Input
										id="expense-qty"
										type="number"
										step="0.01"
										min="0"
										value={quantity}
										onChange={(e) => {
											setQuantity(e.target.value);
											const q = parseFloat(e.target.value) || 0;
											const r = parseFloat(perItemRate) || 0;
											setAmount((q * r).toFixed(2));
											setHasManuallyEditedAmount(false);
										}}
										placeholder="e.g. 50"
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="expense-rate">Per Item Rate (₹)</FieldLabel>
									<Input
										id="expense-rate"
										type="number"
										step="0.01"
										min="0"
										value={perItemRate}
										onChange={(e) => {
											setPerItemRate(e.target.value);
											const q = parseFloat(quantity) || 0;
											const r = parseFloat(e.target.value) || 0;
											setAmount((q * r).toFixed(2));
											setHasManuallyEditedAmount(false);
										}}
										placeholder="e.g. 25.00"
									/>
								</Field>
								{calcValue > 0 && (
									<div className="col-span-2 text-xs text-muted-foreground flex justify-between bg-muted/40 p-2 rounded">
										<span>Calculated Value: ₹{calcValue.toFixed(2)}</span>
										<span className="text-primary">Prefilled into Amount above (editable)</span>
									</div>
								)}
							</div>
						)}
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{/* Handler */}
						<Field>
							<FieldLabel htmlFor="expense-handler">Handler</FieldLabel>
							<Input
								id="expense-handler"
								value={handler}
								onChange={(e) => setHandler(e.target.value)}
								placeholder="Driver"
							/>
						</Field>

						{/* Next Renewal Date */}
						<Field>
							<FieldLabel htmlFor="expense-renewal">Next Renewal Date (Optional)</FieldLabel>
							<Input
								id="expense-renewal"
								type="date"
								value={nextRenewalDate}
								onChange={(e) => setNextRenewalDate(e.target.value)}
							/>
						</Field>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{/* Depo */}
						<Field>
							<FieldLabel htmlFor="expense-depo">Depot (Optional)</FieldLabel>
							<Input
								id="expense-depo"
								value={depo}
								onChange={(e) => setDepo(e.target.value)}
								placeholder="Enter depo name"
							/>
						</Field>

						{/* Delivery Location */}
						<Field>
							<FieldLabel htmlFor="expense-delivery">Delivery Location (Optional)</FieldLabel>
							<Input
								id="expense-delivery"
								value={deliveryLocation}
								onChange={(e) => setDeliveryLocation(e.target.value)}
								placeholder="Enter delivery location"
							/>
						</Field>
					</div>

					{/* Notes */}
					<Field>
						<FieldLabel htmlFor="expense-notes">Notes (Optional)</FieldLabel>
						<Textarea
							id="expense-notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Add any additional notes about this expense..."
							rows={2}
						/>
					</Field>

					<DialogFooter className="pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={createExpenseMutation.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={createExpenseMutation.isPending}>
							{createExpenseMutation.isPending && (
								<Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
							)}
							Save Expense
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
