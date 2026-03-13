import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { VehicleSelectField } from "@/routes/dashboard/accountant/journal-entries/-index/select-fields/vehicle-select-field";

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
});

const newEntryFormSchema = v.object({
	vehicleId: v.pipe(v.string(), v.minLength(1, "Vehicle is required")),
	transactionDate: v.pipe(v.string(), v.minLength(1, "Date is required")),
	revenue: v.pipe(
		v.string(),
		v.minLength(1, "Revenue is required"),
		v.transform((val) => parseFloat(val) || 0),
	),
	notes: v.optional(v.string()),
	expenses: v.array(expenseItemSchema),
});

type FormValues = v.InferInput<typeof newEntryFormSchema>;

const defaultValues: FormValues = {
	vehicleId: "",
	transactionDate: new Date().toISOString().split("T")[0],
	revenue: "",
	notes: "",
	expenses: [],
};

export const Route = createFileRoute(
	"/dashboard/accountant/journal-entries/new/",
)({
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
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
			const items = [
				{
					transactionDate: value.transactionDate,
					type: "credit" as const,
					amount: value.revenue.toString(),
					expenseCategoryId: undefined,
				},
				...value.expenses.map((exp) => ({
					transactionDate: value.transactionDate,
					type: "debit" as const,
					amount: exp.amount.toString(),
					expenseCategoryId: exp.expenseCategoryId,
				})),
			];

			createEntryMutation.mutate({
				vehicleId: value.vehicleId,
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
														onChange={(value) => field.handleChange(value)}
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

									{/* Revenue */}
									<form.Field name="revenue">
										{(
											// biome-ignore lint/suspicious/noExplicitAny: TanStack Form field type is complex
											field: any,
										) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="revenue">
														Revenue
														<span className="text-destructive">*</span>
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
															onChange={(e) => {
																field.handleChange(e.target.value);
															}}
															placeholder="0.00"
															aria-invalid={isInvalid}
														/>
													</InputGroup>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									</form.Field>

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
														<div className="grid grid-cols-1 gap-4 items-start sm:grid-cols-12">
															{/* Category Field */}
															<div className="sm:col-span-7">
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
															<div className="sm:col-span-4">
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

															{/* Delete Button */}
															<div className="flex items-center justify-end sm:justify-center sm:col-span-1 sm:pt-8">
																<Button
																	className="max-sm:hidden"
																	type="button"
																	size="icon"
																	variant="destructive"
																	onClick={createRemoveExpenseHandler(index)}
																>
																	<TrashIcon className="h-4 w-4" />
																</Button>
																<Button
																	className="sm:hidden"
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
												);
											});
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
								revenue: state.values.revenue,
								expenses: state.values.expenses,
							})}
						>
							{({ revenue: revenueValue, expenses: expensesValue }) => {
								const revenue = parseFloat(revenueValue || "0") || 0;
								const totalExpenses = expensesValue.reduce(
									(sum, exp) => sum + (parseFloat(exp.amount) || 0),
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
												className={`text-2xl font-bold ${
													profit >= 0 ? "text-green-600" : "text-red-600"
												}`}
											>
												{formatINR(profit)}
											</p>
										</div>

										{/* Profit Percentage */}
										<div className="space-y-1">
											<p className="text-muted-foreground text-sm">Profit %</p>
											<p
												className={`text-2xl font-bold ${
													profitPercentage >= 0
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
