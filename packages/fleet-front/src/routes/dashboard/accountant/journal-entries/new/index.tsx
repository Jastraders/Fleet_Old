import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
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
import { AccountingProductField } from "@/routes/dashboard/accountant/-shared/accounting-product-field";
import { DriverSelectField } from "@/routes/dashboard/accountant/journal-entries/-index/select-fields/driver-select-field";
import { VehicleSelectField } from "@/routes/dashboard/accountant/journal-entries/-index/select-fields/vehicle-select-field";

const newEntryFormSchema = v.object({
	vehicleId: v.pipe(v.string(), v.minLength(1, "Vehicle is required")),
	driverId: v.pipe(v.string(), v.minLength(1, "Driver is required")),
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
	expenses: v.optional(v.array(v.any()), []),
});

type FormValues = v.InferInput<typeof newEntryFormSchema>;

const defaultValues: FormValues = {
	vehicleId: "",
	driverId: "",
	transactionDate: new Date().toISOString().split("T")[0],
	productName: "",
	revenueMode: "direct",
	revenue: "",
	quantity: "",
	perItemRate: "",
	bataType: "percentage",
	bataPercentage: "",
	fixedBataAmount: "",
	revenueDepo: "",
	revenueDeliveryLocation: "",
	notes: "",
	expenses: [],
};

const searchSchema = v.object({
	sourceNotificationId: v.optional(v.string()),
	prefillVehicleId: v.optional(v.string()),
	prefillExpenseCategoryId: v.optional(v.string()),
	prefillTransactionDate: v.optional(v.string()),
	prefillNextRenewalDate: v.optional(v.string()),
	prefillNotes: v.optional(v.string()),
});

export const Route = createFileRoute(
	"/dashboard/accountant/journal-entries/new/",
)({
	validateSearch: searchSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
	const search = Route.useSearch();
	const queryClient = useQueryClient();

	const createEntryMutation = useMutation({
		...orpc.accountant.journalEntries.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			void router.navigate({
				to: "/dashboard/accountant/journal-entries",
			});
		},
	});

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: newEntryFormSchema,
		},
		onSubmit: async ({ value }) => {
			const isCalc = value.revenueMode === "calculated";
			const qty = isCalc ? parseFloat(value.quantity || "0") || 0 : 0;
			const rate = isCalc ? parseFloat(value.perItemRate || "0") || 0 : 0;
			const val = qty * rate;
			const bataType = value.bataType || "percentage";
			const bataPct =
				isCalc && bataType === "percentage"
					? parseFloat(value.bataPercentage || "0") || 0
					: 0;
			const fixedBata =
				isCalc && bataType === "fixed"
					? parseFloat(value.fixedBataAmount || "0") || 0
					: 0;

			const calculatedAmount =
				value.revenue && parseFloat(value.revenue) > 0
					? parseFloat(value.revenue) || 0
					: isCalc
						? val
						: parseFloat(value.revenue || "0") || 0;

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
					bataPercentage:
						isCalc && bataType === "percentage" ? bataPct : undefined,
					fixedBataAmount:
						isCalc && bataType === "fixed" ? fixedBata : undefined,
					depo: value.revenueDepo || undefined,
					deliveryLocation: value.revenueDeliveryLocation || undefined,
				},
			];

			createEntryMutation.mutate({
				vehicleId: value.vehicleId,
				driverId: value.driverId,
				notes: value.notes || undefined,
				items,
				sourceNotificationId: search.sourceNotificationId || undefined,
			});
		},
	});

	const hasPrefillData =
		Boolean(search.prefillVehicleId) ||
		Boolean(search.prefillTransactionDate) ||
		Boolean(search.prefillNotes);
	const hasAppliedPrefillRef = useRef(false);
	useEffect(() => {
		if (!hasPrefillData || hasAppliedPrefillRef.current) return;
		hasAppliedPrefillRef.current = true;
		form.setFieldValue("vehicleId", search.prefillVehicleId || "");
		form.setFieldValue(
			"transactionDate",
			search.prefillTransactionDate || defaultValues.transactionDate,
		);
		form.setFieldValue("notes", search.prefillNotes || "");
	}, [hasPrefillData, search, form]);

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
						New Journal Entry
					</h1>
					<p className="text-muted-foreground text-sm">
						Create a new journal entry with revenue and expenses
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
									{/* Vehicle */}
									<form.Field name="vehicleId">
										{(
											// biome-ignore lint/suspicious/noExplicitAny: TanStack Form field type is complex
											field: any,
										) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="vehicle-select">
														Vehicle
														<span className="text-destructive">*</span>
													</FieldLabel>
													<VehicleSelectField
														fieldId="vehicle-select"
														value={field.state.value}
														onChange={(value: string) =>
															field.handleChange(value)
														}
														onBlur={field.handleBlur}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									</form.Field>

									<form.Field name="driverId">
										{(
											// biome-ignore lint/suspicious/noExplicitAny: TanStack Form field type is complex
											field: any,
										) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="driver-select">
														Driver
														<span className="text-destructive">*</span>
													</FieldLabel>
													<DriverSelectField
														fieldId="driver-select"
														value={field.state.value}
														onChange={(value: string) =>
															field.handleChange(value)
														}
														onBlur={field.handleBlur}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									</form.Field>

									{/* Date */}
									<form.Field name="transactionDate">
										{(
											// biome-ignore lint/suspicious/noExplicitAny: TanStack Form field type is complex
											field: any,
										) => {
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

									{/* Product Name Field with Dropdown and Manage Products */}
									<form.Field name="productName">
										{(field: any) => (
											<AccountingProductField
												value={field.state.value}
												onChange={(val) => field.handleChange(val)}
												errors={field.state.meta.errors}
											/>
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
													onChange={(e) =>
														field.handleChange(
															e.target.value as "direct" | "calculated",
														)
													}
													className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
												>
													<option value="direct">Direct Amount</option>
													<option value="calculated">Calculated Amount</option>
												</select>
											</Field>
										)}
									</form.Field>

									{/* Direct Mode Input */}
									<form.Subscribe
										selector={(state) => state.values.revenueMode}
									>
										{(mode) =>
											mode === "direct" ? (
												<form.Field name="revenue">
													{(field: any) => {
														const isInvalid =
															field.state.meta.isTouched &&
															!field.state.meta.isValid;
														return (
															<Field data-invalid={isInvalid}>
																<FieldLabel htmlFor="revenue">
																	Revenue Amount
																</FieldLabel>
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
																		onChange={(e) =>
																			field.handleChange(e.target.value)
																		}
																		placeholder="0.00"
																		aria-invalid={isInvalid}
																	/>
																</InputGroup>
																{isInvalid && (
																	<FieldError
																		errors={field.state.meta.errors}
																	/>
																)}
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
																		onChange={(e) =>
																			field.handleChange(e.target.value)
																		}
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
																		onChange={(e) =>
																			field.handleChange(e.target.value)
																		}
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
																	onChange={(e) =>
																		field.handleChange(
																			e.target.value as "percentage" | "fixed",
																		)
																	}
																	className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
																>
																	<option value="percentage">
																		Percentage (%)
																	</option>
																	<option value="fixed">
																		Fixed Amount (₹)
																	</option>
																</select>
															</Field>
														)}
													</form.Field>

													{/* Conditional Bata Input based on bataType */}
													<form.Subscribe
														selector={(state) => state.values.bataType}
													>
														{(bType) =>
															bType === "fixed" ? (
																<form.Field name="fixedBataAmount">
																	{(field: any) => (
																		<Field>
																			<FieldLabel htmlFor="fixed-bata-amount">
																				Fixed Bata Amount (₹)
																			</FieldLabel>
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
																					onChange={(e) =>
																						field.handleChange(e.target.value)
																					}
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
																			<FieldLabel htmlFor="bata-percentage">
																				Bata Percentage (%)
																			</FieldLabel>
																			<Input
																				id="bata-percentage"
																				type="number"
																				step="0.01"
																				name={field.name}
																				value={field.state.value}
																				onBlur={field.handleBlur}
																				onChange={(e) =>
																					field.handleChange(e.target.value)
																				}
																				placeholder="Enter percentage"
																			/>
																		</Field>
																	)}
																</form.Field>
															)
														}
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

															const revenue = val;

															return (
																<div className="space-y-4 border-t pt-3 mt-2">
																	<div className="text-xs space-y-1 text-muted-foreground">
																		<div className="flex justify-between">
																			<span>
																				Calculated Value (Qty × Rate):
																			</span>
																			<span className="font-medium text-foreground">
																				₹
																				{val.toLocaleString("en-IN", {
																					minimumFractionDigits: 2,
																					maximumFractionDigits: 2,
																				})}
																			</span>
																		</div>
																	</div>

																	{/* Highlighted Auto-filled Revenue Field (Editable Default) */}
																	<form.Field name="revenue">
																		{(revField: any) => {
																			const displayValue =
																				revField.state.value !== "" &&
																				revField.state.value !== undefined
																					? revField.state.value
																					: revenue > 0
																						? revenue.toFixed(2)
																						: "";
																			return (
																				<Field className="pt-2">
																					<div className="flex justify-between items-center">
																						<FieldLabel
																							htmlFor="calculated-revenue-display"
																							className="text-green-600 dark:text-green-400 font-semibold"
																						>
																							Revenue Amount (Calculated
																							Default, Editable)
																						</FieldLabel>
																						{revField.state.value !== "" &&
																							revField.state.value !==
																								(revenue > 0
																									? revenue.toFixed(2)
																									: "") && (
																								<button
																									type="button"
																									onClick={() =>
																										revField.handleChange(
																											revenue > 0
																												? revenue.toFixed(2)
																												: "",
																										)
																									}
																									className="text-[11px] text-primary hover:underline"
																								>
																									Reset to calculated (₹
																									{revenue.toFixed(2)})
																								</button>
																							)}
																					</div>
																					<InputGroup className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
																						<InputGroupAddon className="text-green-600 dark:text-green-400 font-semibold">
																							₹
																						</InputGroupAddon>
																						<InputGroupInput
																							id="calculated-revenue-display"
																							type="number"
																							step="0.01"
																							min="0"
																							name={revField.name}
																							value={displayValue}
																							onBlur={revField.handleBlur}
																							onChange={(e) =>
																								revField.handleChange(
																									e.target.value,
																								)
																							}
																							placeholder="0.00"
																							className="bg-transparent border-none text-green-700 dark:text-green-400 font-bold select-all"
																						/>
																					</InputGroup>
																					<p className="text-xs text-muted-foreground mt-1.5 font-medium">
																						Bata Expense = ₹
																						{bataExpense.toLocaleString(
																							"en-IN",
																							{
																								minimumFractionDigits: 2,
																								maximumFractionDigits: 2,
																							},
																						)}
																					</p>
																				</Field>
																			);
																		}}
																	</form.Field>

																	{/* Validation Error for Fixed Bata > Calculated Value */}
																	{isFixedExceeded && (
																		<Alert
																			variant="destructive"
																			className="py-2 px-3 text-xs mt-2"
																		>
																			<AlertDescription>
																				Fixed Bata Amount (₹
																				{bataExpense.toFixed(2)}) cannot be
																				greater than Calculated Value (₹
																				{val.toFixed(2)}).
																			</AlertDescription>
																		</Alert>
																	)}
																</div>
															);
														}}
													</form.Subscribe>
												</div>
											)
										}
									</form.Subscribe>

									{/* Revenue Depo & Delivery Location (Optional) */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
										<form.Field name="revenueDepo">
											{(field: any) => (
												<Field>
													<FieldLabel htmlFor="revenue-depo">
														Depo (Optional)
													</FieldLabel>
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
													<FieldLabel htmlFor="revenue-delivery-location">
														Delivery Location (Optional)
													</FieldLabel>
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

						{createEntryMutation.error && (
							<Alert>
								<AlertDescription>
									{createEntryMutation.error.message}
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
							})}
						>
							{(values) => {
								const isCalc = values.revenueMode === "calculated";
								const qty = isCalc
									? parseFloat(values.quantity || "0") || 0
									: 0;
								const rate = isCalc
									? parseFloat(values.perItemRate || "0") || 0
									: 0;
								const val = qty * rate;
								const bType = values.bataType || "percentage";

								let bataExpense = 0;
								if (isCalc) {
									if (bType === "fixed") {
										bataExpense =
											parseFloat(values.fixedBataAmount || "0") || 0;
									} else {
										const pct = parseFloat(values.bataPercentage || "0") || 0;
										bataExpense = (val * pct) / 100;
									}
								}

								const revenue =
									values.revenue && parseFloat(values.revenue) > 0
										? parseFloat(values.revenue) || 0
										: isCalc
											? val
											: 0;

								return (
									<div className="space-y-4">
										{/* Revenue */}
										<div className="space-y-1">
											<p className="text-muted-foreground text-sm">
												Revenue Amount
											</p>
											<p className="text-2xl font-bold text-green-600">
												{formatINR(revenue)}
											</p>
										</div>

										{/* Driver Bata */}
										<div className="space-y-1">
											<p className="text-muted-foreground text-sm">
												Driver Bata Expense
											</p>
											<p className="text-2xl font-bold text-amber-600">
												{formatINR(bataExpense)}
											</p>
											<p className="text-xs text-muted-foreground">
												{bType === "fixed"
													? "Fixed bata amount"
													: `${values.bataPercentage || 0}% of calculated revenue`}
											</p>
										</div>

										{/* Information Notice */}
										<div className="border-t pt-3 text-xs text-muted-foreground">
											Expense entries are created directly through the{" "}
											<span className="font-semibold text-foreground">
												Expenses
											</span>{" "}
											module.
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
							disabled={createEntryMutation.isPending}
						>
							{createEntryMutation.isPending ? (
								<>
									<Loader2Icon className="h-4 w-4 animate-spin" />
									Creating...
								</>
							) : (
								"Create Entry"
							)}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={handleGoBack}
							disabled={createEntryMutation.isPending}
						>
							Cancel
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
