import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
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
	Combobox,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/orpc";

const baseSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Name is required"), v.maxLength(255)),
	licensePlate: v.pipe(
		v.string(),
		v.minLength(1, "License Plate is required"),
		v.maxLength(255),
	),
	model: v.pipe(v.string(), v.minLength(1, "Model is required"), v.maxLength(255)),
	year: v.pipe(v.number(), v.minValue(1900, "Enter valid year"), v.maxValue(3000)),
	renewal: v.pipe(v.string(), v.minLength(1, "Renewal is required"), v.maxLength(255)),
	renewalDate: v.pipe(v.string(), v.minLength(1, "Renewal date is required")),
	investmentMode: v.picklist(["full_amount", "full_loan", "flexible"]),
	totalPrice: v.optional(v.nullable(v.number())),
	monthlyEmi: v.optional(v.nullable(v.number())),
	emiStartDate: v.optional(v.nullable(v.string())),
	emiDurationMonths: v.optional(v.nullable(v.number())),
	downPayment: v.optional(v.nullable(v.number())),
});

const createVehicleFormSchema = v.pipe(
	baseSchema,
	v.check((input) => {
		if (input.investmentMode === "full_amount") {
			return (input.totalPrice ?? 0) > 0;
		}
		if (input.investmentMode === "full_loan") {
			return (
				(input.monthlyEmi ?? 0) > 0 &&
				(input.emiDurationMonths ?? 0) > 0 &&
				!!input.emiStartDate
			);
		}
		return (
			(input.downPayment ?? 0) >= 0 &&
			(input.monthlyEmi ?? 0) > 0 &&
			(input.emiDurationMonths ?? 0) > 0 &&
			!!input.emiStartDate
		);
	}, "Enter all required investment details"),
);

const defaultValues: v.InferInput<typeof createVehicleFormSchema> = {
	name: "",
	licensePlate: "",
	model: "",
	year: new Date().getFullYear(),
	renewal: "",
	renewalDate: "",
	investmentMode: "full_amount",
	totalPrice: null,
	monthlyEmi: null,
	emiStartDate: null,
	emiDurationMonths: null,
	downPayment: null,
};

const parseNumber = (value: string): number | null => {
	if (!value.trim()) {
		return null;
	}
	const parsed = Number(value);
	return Number.isNaN(parsed) ? null : parsed;
};

const investmentModeLabel: Record<"full_amount" | "full_loan" | "flexible", string> = {
	full_amount: "Full Amount",
	full_loan: "Full Loan",
	flexible: "Flexible",
};

export function CreateVehicleDialog() {
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);

	const createVehicleMutation = useMutation({
		...orpc.accountant.vehicles.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setIsOpen(false);
		},
	});

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: createVehicleFormSchema,
		},
		onSubmit: async ({ value }) => {
			createVehicleMutation.mutate(value);
		},
	});

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			form.reset();
		}
	};

	const handleSubmitForm = () => {
		form.handleSubmit();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					<Button>
						<PlusIcon />
						Add Vehicle
					</Button>
				}
			/>
			<DialogContent className="p-0">
				<ScrollArea className="max-h-[calc(100svh-2rem)]" scrollFade>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSubmitForm();
						}}
						className="p-6"
					>
						<DialogHeader>
							<DialogTitle>Add Vehicle</DialogTitle>
							<DialogDescription>
								Add a new vehicle to your fleet.
							</DialogDescription>
						</DialogHeader>

						<FieldGroup className="my-4">
							<FieldSet>
								<FieldGroup>
									<form.Field name="name">
										{(field) => (
											<Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
												<FieldLabel htmlFor="vehicle-name">Vehicle Name<span className="text-destructive">*</span></FieldLabel>
												<Input id="vehicle-name" name={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder="e.g., Fleet Truck #1" />
												<FieldError errors={field.state.meta.errors} />
											</Field>
										)}
									</form.Field>
									<form.Field name="licensePlate">
										{(field) => (
											<Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
												<FieldLabel htmlFor="vehicle-licensePlate">License Plate<span className="text-destructive">*</span></FieldLabel>
												<Input id="vehicle-licensePlate" name={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder="e.g., ABC-1234" />
												<FieldError errors={field.state.meta.errors} />
											</Field>
										)}
									</form.Field>
									<form.Field name="model">
										{(field) => (
											<Field>
												<FieldLabel htmlFor="vehicle-model">Model<span className="text-destructive">*</span></FieldLabel>
												<Input id="vehicle-model" name={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder="e.g., Tata 407" />
												<FieldError errors={field.state.meta.errors} />
											</Field>
										)}
									</form.Field>
									<form.Field name="year">
										{(field) => (
											<Field>
												<FieldLabel htmlFor="vehicle-year">Year<span className="text-destructive">*</span></FieldLabel>
												<Input id="vehicle-year" type="number" name={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(Number(e.target.value || 0))} />
												<FieldError errors={field.state.meta.errors} />
											</Field>
										)}
									</form.Field>
									<form.Field name="renewal">
										{(field) => (
											<Field>
												<FieldLabel htmlFor="vehicle-renewal">Renewal<span className="text-destructive">*</span></FieldLabel>
												<Input id="vehicle-renewal" name={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder="e.g., Insurance, RTO" />
												<FieldError errors={field.state.meta.errors} />
											</Field>
										)}
									</form.Field>
									<form.Field name="renewalDate">
										{(field) => (
											<Field>
												<FieldLabel htmlFor="vehicle-renewal-date">Renewal Date<span className="text-destructive">*</span></FieldLabel>
												<Input id="vehicle-renewal-date" type="date" name={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} />
												<FieldError errors={field.state.meta.errors} />
											</Field>
										)}
									</form.Field>
									<form.Field name="investmentMode">
										{(field) => (
											<Field>
												<FieldLabel htmlFor="vehicle-investment-mode">Investment Mode<span className="text-destructive">*</span></FieldLabel>
												<Combobox
													value={field.state.value}
													inputValue={investmentModeLabel[field.state.value]}
													items={["full_amount", "full_loan", "flexible"]}
													onValueChange={(value) =>
														field.handleChange(
															(value || "full_amount") as "full_amount" | "full_loan" | "flexible",
														)}
													onInputValueChange={() => {}}
													filter={null}
												>
													<ComboboxInput id="vehicle-investment-mode" onBlur={field.handleBlur} readOnly showTrigger />
													<ComboboxContent>
														<ComboboxList>
															<ComboboxItem value="full_amount">Full Amount</ComboboxItem>
															<ComboboxItem value="full_loan">Full Loan</ComboboxItem>
															<ComboboxItem value="flexible">Flexible</ComboboxItem>
														</ComboboxList>
													</ComboboxContent>
												</Combobox>
											</Field>
										)}
									</form.Field>

									<form.Subscribe selector={(s) => s.values.investmentMode}>
										{(investmentMode) => (
											<>
												{investmentMode === "full_amount" && (
													<form.Field name="totalPrice">
														{(field) => (
															<Field>
																<FieldLabel htmlFor="vehicle-total-price">Total Price<span className="text-destructive">*</span></FieldLabel>
																<Input id="vehicle-total-price" type="number" value={field.state.value ?? ""} onChange={(e) => field.handleChange(parseNumber(e.target.value))} />
															</Field>
														)}
													</form.Field>
												)}
												{["full_loan", "flexible"].includes(investmentMode) && (
													<>
														{investmentMode === "flexible" && (
															<form.Field name="downPayment">
																{(field) => (
																	<Field>
																		<FieldLabel htmlFor="vehicle-down-payment">Down Payment<span className="text-destructive">*</span></FieldLabel>
																		<Input id="vehicle-down-payment" type="number" value={field.state.value ?? ""} onChange={(e) => field.handleChange(parseNumber(e.target.value))} />
																	</Field>
																)}
															</form.Field>
														)}
														<form.Field name="monthlyEmi">
															{(field) => (
																<Field>
																	<FieldLabel htmlFor="vehicle-monthly-emi">Monthly EMI<span className="text-destructive">*</span></FieldLabel>
																	<Input id="vehicle-monthly-emi" type="number" value={field.state.value ?? ""} onChange={(e) => field.handleChange(parseNumber(e.target.value))} />
																</Field>
															)}
														</form.Field>
														<form.Field name="emiStartDate">
															{(field) => (
																<Field>
																	<FieldLabel htmlFor="vehicle-emi-start-date">Starting Date<span className="text-destructive">*</span></FieldLabel>
																	<Input id="vehicle-emi-start-date" type="date" value={field.state.value ?? ""} onChange={(e) => field.handleChange(e.target.value || null)} />
																</Field>
															)}
														</form.Field>
														<form.Field name="emiDurationMonths">
															{(field) => (
																<Field>
																	<FieldLabel htmlFor="vehicle-emi-duration">Duration Months<span className="text-destructive">*</span></FieldLabel>
																	<Input id="vehicle-emi-duration" type="number" value={field.state.value ?? ""} onChange={(e) => field.handleChange(parseNumber(e.target.value))} />
																</Field>
															)}
														</form.Field>
													</>
												)}
											</>
										)}
									</form.Subscribe>
								</FieldGroup>
							</FieldSet>

							{createVehicleMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>{createVehicleMutation.error.message}</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter>
							<Button type="submit" disabled={createVehicleMutation.isPending}>
								{createVehicleMutation.isPending ? "Adding..." : "Add Vehicle"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
