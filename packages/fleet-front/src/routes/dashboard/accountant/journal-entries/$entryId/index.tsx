import { useForm } from "@tanstack/react-form";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, Loader2Icon, TrashIcon } from "lucide-react";
import * as v from "valibot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";
import { CategorySelectField } from "@/routes/dashboard/accountant/journal-entries/-index/select-fields/category-select-field";

const expenseItemSchema = v.object({
	expenseCategoryId: v.pipe(
		v.string("Select a category"),
		v.minLength(1, "Category is required"),
	),
	amount: v.pipe(
		v.string(),
		v.minLength(1, "Amount is required"),
		v.transform((val) => parseFloat(val) || 0),
	),
	handler: v.pipe(v.string(), v.minLength(1, "Handler is required")),
	nextRenewalDate: v.optional(v.string()),
	depo: v.optional(v.string()),
	deliveryLocation: v.optional(v.string()),
});

const editEntryFormSchema = v.object({
	transactionDate: v.pipe(v.string(), v.minLength(1, "Date is required")),
	productName: v.optional(v.string()),
	revenueMode: v.optional(v.picklist(["direct", "calculated"]), "direct"),
	revenue: v.optional(v.string()),
	quantity: v.optional(v.string()),
	perItemRate: v.optional(v.string()),
	bataType: v.optional(v.picklist(["percentage", "fixed"]), "percentage"),
	bataPercentage: v.optional(v.string()),
	fixedBataAmount: v.optional(v.string()),
	revenueDepo: v.optional(v.string()),
	revenueDeliveryLocation: v.optional(v.string()),
	notes: v.optional(v.string()),
	expenses: v.array(expenseItemSchema),
});

type FormValues = v.InferInput<typeof editEntryFormSchema>;

export const Route = createFileRoute(
	"/dashboard/accountant/journal-entries/$entryId/",
)({
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { entryId } = Route.useParams();

	const { data: entry } = useSuspenseQuery({
		...orpc.accountant.journalEntries.get.queryOptions({
			input: { id: entryId },
		}),
	});

	const updateEntryMutation = useMutation({
		...orpc.accountant.journalEntries.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			void router.navigate({
				to: "/dashboard/accountant/journal-entries",
			});
		},
	});

	// Transform entry data to form values
	// biome-ignore lint/suspicious/noExplicitAny: type definition
	const creditItem = entry?.items?.find((item: any) => item.type === "credit");

	const defaultValues: FormValues = {
		transactionDate: entry?.items?.[0]?.transactionDate
			? new Date(entry.items[0].transactionDate).toISOString().split("T")[0]
			: new Date().toISOString().split("T")[0],
		productName: creditItem?.productName || "",
		revenueMode: creditItem?.revenueMode || "direct",
		revenue: creditItem?.amount !== undefined && creditItem?.amount !== null ? creditItem.amount.toString() : "",
		quantity: creditItem?.quantity !== undefined && creditItem?.quantity !== null ? creditItem.quantity.toString() : "",
		perItemRate: creditItem?.perItemRate !== undefined && creditItem?.perItemRate !== null ? creditItem.perItemRate.toString() : "",
		bataType: (creditItem?.bataType as "percentage" | "fixed") || "percentage",
		bataPercentage: creditItem?.bataPercentage !== undefined && creditItem?.bataPercentage !== null ? creditItem.bataPercentage.toString() : "",
		fixedBataAmount: creditItem?.fixedBataAmount !== undefined && creditItem?.fixedBataAmount !== null ? creditItem.fixedBataAmount.toString() : "",
		revenueDepo: creditItem?.depo || "",
		revenueDeliveryLocation: creditItem?.deliveryLocation || "",
		notes: entry?.notes || "",
		expenses:
			entry?.items
				?.filter((item: { type: string }) => item.type === "debit")
				.map((item: {
					expenseCategoryId?: string | null;
					amount: string;
					handler?: string | null;
					nextRenewalDate?: string | null;
					depo?: string | null;
					deliveryLocation?: string | null;
				}) => ({
					expenseCategoryId: item.expenseCategoryId || "",
					amount: item.amount,
					handler: item.handler || "",
					nextRenewalDate: item.nextRenewalDate
						? item.nextRenewalDate.split("T")[0]
						: "",
					depo: item.depo || "",
					deliveryLocation: item.deliveryLocation || "",
				})) || [],
	};

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: editEntryFormSchema,
		},
		onSubmit: async ({ value }) => {
			const isCalc = value.revenueMode === "calculated";
			const qty = isCalc ? (parseFloat(value.quantity || "0") || 0) : 0;
			const rate = isCalc ? (parseFloat(value.perItemRate || "0") || 0) : 0;
			const val = qty * rate;
			const bataType = value.bataType || "percentage";
			const bataPct = isCalc && bataType === "percentage" ? (parseFloat(value.bataPercentage || "0") || 0) : 0;
			const fixedBata = isCalc && bataType === "fixed" ? (parseFloat(value.fixedBataAmount || "0") || 0) : 0;

			let bataExpense = 0;
			if (isCalc) {
				if (bataType === "fixed") {
					bataExpense = fixedBata;
				} else {
					bataExpense = (val * bataPct) / 100;
				}
			}

			const calculatedAmount = isCalc ? Math.max(0, val - bataExpense) : (parseFloat(value.revenue || "0") || 0);

			const items = [
				{
					transactionDate: value.transactionDate,
					type: "credit" as const,
					amount: calculatedAmount.toString(),
					expenseCategoryId: undefined,
					revenueMode: value.revenueMode,
					quantity: isCalc ? qty : undefined,
					perItemRate: isCalc ? rate : undefined,
					productName: value.productName || undefined,
					bataType: isCalc ? bataType : undefined,
					bataPercentage: isCalc && bataType === "percentage" ? bataPct : undefined,
					fixedBataAmount: isCalc && bataType === "fixed" ? fixedBata : undefined,
					depo: value.revenueDepo || undefined,
					deliveryLocation: value.revenueDeliveryLocation || undefined,
				},
				...value.expenses.map((exp) => ({
					transactionDate: value.transactionDate,
					type: "debit" as const,
					amount: exp.amount.toString(),
					expenseCategoryId: exp.expenseCategoryId,
					handler: exp.handler || "Driver",
					nextRenewalDate: exp.nextRenewalDate || undefined,
					depo: exp.depo || undefined,
					deliveryLocation: exp.deliveryLocation || undefined,
				})),
			];

			updateEntryMutation.mutate({
				id: entryId,
				notes: value.notes || undefined,
				items,
			});
		},
	});

	const handleAddExpense = () => {
		form.pushFieldValue("expenses", {
			// biome-ignore lint/suspicious/noExplicitAny: default to unselected
			expenseCategoryId: null as any,
			amount: "",
			handler: "",
			nextRenewalDate: "",
		});
	};

	const handleRemoveExpense = (index: number) => {
		form.removeFieldValue("expenses", index);
	};

	const createRemoveExpenseHandler = (index: number) => {
		return () => handleRemoveExpense(index);
	};

	const handleGoBack = () => {
		void router.navigate({
			to: "/dashboard/accountant/journal-entries",
		});
	};

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button
					variant="outline"
					size="icon"
					onClick={handleGoBack}
					type="button"
				>
					<ArrowLeftIcon className="h-4 w-4" />
				</Button>
				<div>
					<h1 className="text-2xl font-bold tracking-tight">
						Edit Journal Entry
					</h1>
					<p className="text-muted-foreground text-sm">
						Update journal entry details and transactions
					</p>
				</div>
			</div>

			{/* Main Content Grid */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* Left Column - Form (2/3) */}
				<div className="lg:col-span-2">
					<form
						id="journal-entry-form"
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="space-y-6"
					>
						{/* Section 1: Basic Info */}
						<div className="border rounded-lg p-6 bg-card">
							<FieldSet>
								<FieldLegend>Entry Details</FieldLegend>
								<FieldGroup>
									{/* Vehicle (Read-only) */}
									<Field>
										<FieldLabel htmlFor="vehicle-display">Vehicle</FieldLabel>
										<Input
											id="vehicle-display"
											type="text"
											value={
												entry?.vehicle
													? `${entry.vehicle.name} (${entry.vehicle.licensePlate})`
													: "Unknown vehicle"
											}
											disabled
											readOnly
										/>
									</Field>

									{/* Date */}
									<form.Field name="transactionDate">
										{(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="transaction-date">
														Date
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id="transaction-date"
														type="date"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									</form.Field>

									{/* Product Name Field (Immediately after Date, before Revenue Entry Mode) */}
									<form.Field name="productName">
										{(field: any) => (
											<Field>
												<FieldLabel htmlFor="product-name">Product Name (Optional)</FieldLabel>
												<Input
													id="product-name"
													name={field.name}
													value={field.state.value || ""}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="Enter product name"
												/>
											</Field>
										)}
									</form.Field>

									{/* Revenue */}
									{/* Revenue Mode Selector */}
									<form.Field name="revenueMode">
										{(field: any) => (
											<Field>
												<FieldLabel>Revenue Entry Mode</FieldLabel>
												<select
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value as "direct" | "calculated")}
													className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
												>
													<option value="direct">Direct Amount</option>
													<option value="calculated">Calculated Amount</option>
												</select>
											</Field>
										)}
									</form.Field>

									{/* Direct Mode Input */}
									<form.Subscribe selector={(state) => state.values.revenueMode}>
										{(mode) => mode === "direct" ? (
											<form.Field name="revenue">
												{(field: any) => {
													const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
													return (
														<Field data-invalid={isInvalid}>
															<FieldLabel htmlFor="revenue">Revenue Amount</FieldLabel>
															<InputGroup>
																<InputGroupAddon>₹</InputGroupAddon>
																<InputGroupInput
																	id="revenue"
																	type="number"
																	step="0.01"
																	min="0"
																	name={field.name}
																	value={field.state.value}
																	onBlur={field.handleBlur}
																	onChange={(e) => field.handleChange(e.target.value)}
																	placeholder="0.00"
																	aria-invalid={isInvalid}
																/>
															</InputGroup>
															{isInvalid && <FieldError errors={field.state.meta.errors} />}
														</Field>
													);
												}}
											</form.Field>
										) : (
											/* Calculated Mode Inputs */
											<div className="space-y-4 border p-4 rounded-lg bg-muted/20">
												<div className="grid grid-cols-2 gap-4">
													<form.Field name="quantity">
														{(field: any) => (
															<Field>
																<FieldLabel>Quantity</FieldLabel>
																<Input
																	type="number"
																	name={field.name}
																	value={field.state.value}
																	onChange={(e) => field.handleChange(e.target.value)}
																	placeholder="Enter quantity"
																/>
															</Field>
														)}
													</form.Field>

													<form.Field name="perItemRate">
														{(field: any) => (
															<Field>
																<FieldLabel>Per Item Rate (₹)</FieldLabel>
																<Input
																	type="number"
																	step="0.01"
																	name={field.name}
																	value={field.state.value}
																	onChange={(e) => field.handleChange(e.target.value)}
																	placeholder="Enter rate"
																/>
															</Field>
														)}
													</form.Field>
												</div>

												{/* Bata Type Selector */}
												<form.Field name="bataType">
													{(field: any) => (
														<Field>
															<FieldLabel>Bata Type</FieldLabel>
															<select
																value={field.state.value || "percentage"}
																onChange={(e) => field.handleChange(e.target.value as "percentage" | "fixed")}
																className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
															>
																<option value="percentage">Percentage (%)</option>
																<option value="fixed">Fixed Amount (₹)</option>
															</select>
														</Field>
													)}
												</form.Field>

												{/* Conditional Bata Input based on bataType */}
												<form.Subscribe selector={(state) => state.values.bataType}>
													{(bType) => bType === "fixed" ? (
														<form.Field name="fixedBataAmount">
															{(field: any) => (
																<Field>
																	<FieldLabel htmlFor="fixed-bata-amount">Fixed Bata Amount (₹)</FieldLabel>
																	<InputGroup>
																		<InputGroupAddon>₹</InputGroupAddon>
																		<InputGroupInput
																			id="fixed-bata-amount"
																			type="number"
																			step="0.01"
																			min="0"
																			name={field.name}
																			value={field.state.value}
																			onBlur={field.handleBlur}
																			onChange={(e) => field.handleChange(e.target.value)}
																			placeholder="Enter fixed Bata amount"
																		/>
																	</InputGroup>
																</Field>
															)}
														</form.Field>
													) : (
														<form.Field name="bataPercentage">
															{(field: any) => (
																<Field>
																	<FieldLabel htmlFor="bata-percentage">Bata Percentage (%)</FieldLabel>
																	<Input
																		id="bata-percentage"
																		type="number"
																		step="0.01"
																		name={field.name}
																		value={field.state.value}
																		onBlur={field.handleBlur}
																		onChange={(e) => field.handleChange(e.target.value)}
																		placeholder="Enter percentage"
																	/>
																</Field>
															)}
														</form.Field>
													)}
												</form.Subscribe>

												{/* Computed Live Display */}
												<form.Subscribe
													selector={(state) => ({
														qty: state.values.quantity,
														rate: state.values.perItemRate,
														bType: state.values.bataType,
														pct: state.values.bataPercentage,
														fixed: state.values.fixedBataAmount,
													})}
												>
													{({ qty, rate, bType, pct, fixed }) => {
														const q = parseFloat(qty || "0") || 0;
														const r = parseFloat(rate || "0") || 0;
														const val = q * r;

														let bataExpense = 0;
														let isFixedExceeded = false;

														if (bType === "fixed") {
															bataExpense = parseFloat(fixed || "0") || 0;
															if (val > 0 && bataExpense > val) {
																isFixedExceeded = true;
															}
														} else {
															const p = parseFloat(pct || "0") || 0;
															bataExpense = (val * p) / 100;
														}

														const revenue = Math.max(0, val - bataExpense);

														return (
															<div className="space-y-4 border-t pt-3 mt-2">
																<div className="text-xs space-y-1 text-muted-foreground">
																	<div className="flex justify-between">
																		<span>Calculated Value (Qty × Rate):</span>
																		<span className="font-medium text-foreground">₹{val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
																	</div>
																</div>

																{/* Highlighted Auto-filled Revenue Field */}
																<Field className="pt-2">
																	<FieldLabel htmlFor="calculated-revenue-display" className="text-green-600 dark:text-green-400 font-semibold">
																		Revenue Amount (Calculated)
																	</FieldLabel>
																	<InputGroup className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
																		<InputGroupAddon className="text-green-600 dark:text-green-400 font-semibold">₹</InputGroupAddon>
																		<InputGroupInput
																			id="calculated-revenue-display"
																			type="text"
																			value={revenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																			disabled
																			readOnly
																			className="bg-transparent border-none text-green-700 dark:text-green-400 font-bold select-all disabled:opacity-100"
																		/>
																	</InputGroup>
																	{/* Supporting Text directly BELOW Revenue Amount */}
																	<p className="text-xs text-muted-foreground mt-1.5 font-medium">
																		Bata Expense = ₹{bataExpense.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																	</p>
																</Field>

																{/* Validation Error for Fixed Bata > Calculated Value */}
																{isFixedExceeded && (
																	<Alert variant="destructive" className="py-2 px-3 text-xs mt-2">
																		<AlertDescription>
																			Fixed Bata Amount (₹{bataExpense.toFixed(2)}) cannot be greater than Calculated Value (₹{val.toFixed(2)}).
																		</AlertDescription>
																	</Alert>
																)}
															</div>
														);
													}}
												</form.Subscribe>
											</div>
										)}
									</form.Subscribe>

									{/* Revenue Depo & Delivery Location (Optional) */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
										<form.Field name="revenueDepo">
											{(field: any) => (
												<Field>
													<FieldLabel htmlFor="revenue-depo">Depo (Optional)</FieldLabel>
													<Input
														id="revenue-depo"
														name={field.name}
														value={field.state.value || ""}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="Enter depo name"
													/>
												</Field>
											)}
										</form.Field>

										<form.Field name="revenueDeliveryLocation">
											{(field: any) => (
												<Field>
													<FieldLabel htmlFor="revenue-delivery-location">Delivery Location (Optional)</FieldLabel>
													<Input
														id="revenue-delivery-location"
														name={field.name}
														value={field.state.value || ""}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="Enter delivery location"
													/>
												</Field>
											)}
										</form.Field>
									</div>

									{/* Notes */}
									<form.Field name="notes">
										{(
											// biome-ignore lint/suspicious/noExplicitAny: TanStack Form field type is complex
											field: any,
										) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="notes">Notes</FieldLabel>
													<Textarea
														id="notes"
														name={field.name}
														value={field.state.value || ""}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="Add any additional notes..."
														aria-invalid={isInvalid}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									</form.Field>
								</FieldGroup>
							</FieldSet>
						</div>

						{/* Section 2: Expenses */}
						<div className="border rounded-lg p-6 bg-card">
							<FieldSet>
								<div className="flex justify-between items-center">
									<FieldLegend>Expenses</FieldLegend>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={handleAddExpense}
									>
										Add Expense
									</Button>
								</div>

								<form.Subscribe selector={(state) => state.values.expenses}>
									{(expenses) => {
										if (expenses.length === 0) {
											return (
												<p className="text-muted-foreground text-sm text-center py-8">
													No expenses added yet. Click "Add Expense" to get
													started.
												</p>
											);
										}

										return null;
									}}
								</form.Subscribe>

								<FieldGroup>
									<form.Field name="expenses" mode="array">
										{(field) => {
											return field.state.value.map((_, index) => {
												return (
													<div
														// biome-ignore lint/suspicious/noArrayIndexKey: managed by tanstack form
														key={index}
														className="border rounded-md p-4 bg-muted/30"
													>
														<div className="space-y-4">
															<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
																{/* Category Field */}
																<div>
																	<form.Field
																		name={`expenses[${index}].expenseCategoryId`}
																	>
																		{(field) => {
																			const isInvalid =
																				field.state.meta.isTouched &&
																				!field.state.meta.isValid;
																			return (
																				<Field data-invalid={isInvalid}>
																					<FieldLabel
																						htmlFor={`expense-category-${index}`}
																					>
																						Expense Category
																						<span className="text-destructive">
																							*
																						</span>
																					</FieldLabel>
																					<CategorySelectField
																						fieldId={`expense-category-${index}`}
																						value={field.state.value}
																						onChange={(value) => {
																							field.handleChange(value);
																						}}
																						onBlur={field.handleBlur}
																					/>
																					{isInvalid && (
																						<FieldError
																							errors={field.state.meta.errors}
																						/>
																					)}
																				</Field>
																			);
																		}}
																	</form.Field>
																</div>

																{/* Amount Field */}
																<div>
																	<form.Field name={`expenses[${index}].amount`}>
																		{(amountField) => {
																			const amountIsInvalid =
																				amountField.state.meta.isTouched &&
																				!amountField.state.meta.isValid;
																			return (
																				<Field data-invalid={amountIsInvalid}>
																					<FieldLabel
																						htmlFor={`expense-amount-${index}`}
																					>
																						Amount
																						<span className="text-destructive">
																							*
																						</span>
																					</FieldLabel>
																					<InputGroup>
																						<InputGroupAddon>₹</InputGroupAddon>
																						<InputGroupInput
																							id={`expense-amount-${index}`}
																							type="number"
																							step="0.01"
																							min="0"
																							name={amountField.name}
																							value={amountField.state.value}
																							onBlur={amountField.handleBlur}
																							onChange={(e) => {
																								amountField.handleChange(
																									e.target.value,
																								);
																							}}
																							placeholder="0.00"
																							aria-invalid={amountIsInvalid}
																						/>
																					</InputGroup>
																					{amountIsInvalid && (
																						<FieldError
																							errors={
																								amountField.state.meta.errors
																							}
																						/>
																					)}
																				</Field>
																			);
																		}}
																	</form.Field>
																</div>
															</div>

															<div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
																<div>
																	<form.Field name={`expenses[${index}].handler`}>
																		{(handlerField) => {
																			const handlerIsInvalid =
																				handlerField.state.meta.isTouched &&
																				!handlerField.state.meta.isValid;
																			return (
																				<Field data-invalid={handlerIsInvalid}>
																					<FieldLabel htmlFor={`expense-handler-${index}`}>
																						Handler
																						<span className="text-destructive">*</span>
																					</FieldLabel>
																					<Input
																						id={`expense-handler-${index}`}
																						name={handlerField.name}
																						value={handlerField.state.value}
																						onBlur={handlerField.handleBlur}
																						onChange={(e) =>
																							handlerField.handleChange(
																								e.target.value,
																							)
																						}
																						placeholder="Enter handler name"
																					/>
																					{handlerIsInvalid && (
																						<FieldError
																							errors={handlerField.state.meta.errors}
																						/>
																					)}
																				</Field>
																			);
																		}}
																	</form.Field>
																</div>

																<div>
																	<form.Field
																		name={`expenses[${index}].nextRenewalDate`}
																	>
																		{(renewalField) => (
																			<Field>
																				<FieldLabel htmlFor={`expense-renewal-${index}`}>
																					Next Renewal
																				</FieldLabel>
																				<Input
																					id={`expense-renewal-${index}`}
																					type="date"
																					name={renewalField.name}
																					value={renewalField.state.value || ""}
																					onBlur={renewalField.handleBlur}
																					onChange={(e) =>
																						renewalField.handleChange(e.target.value)
																					}
																				/>
																			</Field>
																		)}
																	</form.Field>
																</div>

																{/* Delete Button */}
																<div className="flex items-center justify-end">
																	<Button
																		className="max-md:hidden"
																		type="button"
																		size="icon"
																		variant="destructive"
																		onClick={createRemoveExpenseHandler(index)}
																	>
																		<TrashIcon className="h-4 w-4" />
																	</Button>
																	<Button
																		className="md:hidden"
																		type="button"
																		variant="destructive"
																		onClick={createRemoveExpenseHandler(index)}
																	>
																		Delete
																		<TrashIcon className="h-4 w-4" />
																	</Button>
																</div>
															</div>
														</div>
													</div>
												);
											});
										}}
									</form.Field>
								</FieldGroup>
							</FieldSet>
						</div>

						{updateEntryMutation.error && (
							<Alert>
								<AlertDescription>
									{updateEntryMutation.error.message}
								</AlertDescription>
							</Alert>
						)}
					</form>
				</div>

				{/* Right Column - Summary (1/3) */}
				<div>
					<div className="border rounded-lg p-6 bg-card sticky top-4 h-fit lg:top-4">
						<h2 className="text-lg font-semibold mb-6">Summary</h2>

						<form.Subscribe
							selector={(state) => ({
								revenueMode: state.values.revenueMode,
								revenue: state.values.revenue,
								quantity: state.values.quantity,
								perItemRate: state.values.perItemRate,
								bataType: state.values.bataType,
								bataPercentage: state.values.bataPercentage,
								fixedBataAmount: state.values.fixedBataAmount,
								expenses: state.values.expenses,
							})}
						>
							{(values) => {
								const isCalc = values.revenueMode === "calculated";
								const qty = isCalc ? (parseFloat(values.quantity || "0") || 0) : 0;
								const rate = isCalc ? (parseFloat(values.perItemRate || "0") || 0) : 0;
								const val = qty * rate;
								const bType = values.bataType || "percentage";
								
								let bataExpense = 0;
								if (isCalc) {
									if (bType === "fixed") {
										bataExpense = parseFloat(values.fixedBataAmount || "0") || 0;
									} else {
										const pct = parseFloat(values.bataPercentage || "0") || 0;
										bataExpense = (val * pct) / 100;
									}
								}

								const revenue = isCalc ? Math.max(0, val - bataExpense) : (parseFloat(values.revenue || "0") || 0);
								const totalExpenses = values.expenses.reduce(
									(sum: number, exp: { amount: string }) =>
										sum + (parseFloat(exp.amount) || 0),
									0,
								);
								const profit = revenue - totalExpenses;
								const profitPercentage =
									revenue > 0 ? (profit / revenue) * 100 : 0;

								return (
									<div className="space-y-4">
										{/* Revenue */}
										<div className="space-y-1">
											<p className="text-muted-foreground text-sm">Revenue</p>
											<p className="text-2xl font-bold text-green-600">
												{formatINR(revenue)}
											</p>
										</div>

										{/* Expenses */}
										<div className="space-y-1">
											<p className="text-muted-foreground text-sm">Expenses</p>
											<p className="text-2xl font-bold text-red-600">
												{formatINR(totalExpenses)}
											</p>
										</div>

										{/* Divider */}
										<div className="border-t pt-4" />

										{/* Profit */}
										<div className="space-y-1">
											<p className="text-muted-foreground text-sm">Profit</p>
											<p
												className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"
													}`}
											>
												{formatINR(profit)}
											</p>
										</div>

										{/* Profit Percentage */}
										<div className="space-y-1">
											<p className="text-muted-foreground text-sm">Profit %</p>
											<p
												className={`text-2xl font-bold ${profitPercentage >= 0
													? "text-green-600"
													: "text-red-600"
													}`}
											>
												{profitPercentage.toFixed(2)}%
											</p>
										</div>
									</div>
								);
							}}
						</form.Subscribe>
					</div>
				</div>

				{/* Action Buttons - appears below summary on mobile */}
				<div className="lg:col-span-2">
					<div className="flex gap-2 justify-end">
						<Button
							type="submit"
							form="journal-entry-form"
							disabled={updateEntryMutation.isPending}
						>
							{updateEntryMutation.isPending ? (
								<>
									<Loader2Icon className="h-4 w-4 animate-spin" />
									Updating...
								</>
							) : (
								"Update Entry"
							)}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={handleGoBack}
							disabled={updateEntryMutation.isPending}
						>
							Cancel
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
