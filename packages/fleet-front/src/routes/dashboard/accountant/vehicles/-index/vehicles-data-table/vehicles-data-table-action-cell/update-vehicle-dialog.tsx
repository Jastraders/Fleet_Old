import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import type { Vehicle } from "@/models/vehicle";
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
	totalRevenue: v.pipe(v.number(), v.minValue(0)),
});

const updateVehicleFormSchema = v.pipe(
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

interface UpdateVehicleDialogProps {
	vehicle: Vehicle | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

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

export function UpdateVehicleDialog({
	vehicle,
	isOpen,
	onOpenChange,
}: UpdateVehicleDialogProps) {
	const queryClient = useQueryClient();
	const [localIsOpen, setLocalIsOpen] = useState(false);

	useEffect(() => {
		setLocalIsOpen(isOpen);
	}, [isOpen]);

	const updateVehicleMutation = useMutation({
		...orpc.accountant.vehicles.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setLocalIsOpen(false);
			onOpenChange(false);
		},
	});

	const defaultValues: v.InferInput<typeof updateVehicleFormSchema> = vehicle
		? {
				name: vehicle.name,
				licensePlate: vehicle.licensePlate ?? "",
				model: vehicle.model ?? "",
				year: vehicle.year ?? new Date().getFullYear(),
				renewal: vehicle.renewal ?? "",
				renewalDate: vehicle.renewalDate ? vehicle.renewalDate.slice(0, 10) : "",
				investmentMode: vehicle.investmentMode,
				totalPrice: vehicle.totalPrice ?? null,
				monthlyEmi: vehicle.monthlyEmi ?? null,
				emiStartDate: vehicle.emiStartDate ? vehicle.emiStartDate.slice(0, 10) : null,
				emiDurationMonths: vehicle.emiDurationMonths ?? null,
				downPayment: vehicle.downPayment ?? null,
				totalRevenue: vehicle.totalRevenue ?? 0,
			}
		: {
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
				totalRevenue: 0,
			};

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: updateVehicleFormSchema,
		},
		onSubmit: async ({ value }) => {
			if (!vehicle) return;
			updateVehicleMutation.mutate({
				id: vehicle.id,
				...value,
			});
		},
	});

	const handleOpenChange = useCallback(
		(open: boolean) => {
			setLocalIsOpen(open);
			onOpenChange(open);
			if (!open) {
				form.reset();
			}
		},
		[form, onOpenChange],
	);

	const handleSubmitForm = useCallback(() => {
		form.handleSubmit();
	}, [form]);

	if (!vehicle) return null;

	return (
		<Dialog open={localIsOpen} onOpenChange={handleOpenChange}>
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
							<DialogTitle>Update Vehicle</DialogTitle>
							<DialogDescription>
								Update vehicle information for {vehicle.name}.
							</DialogDescription>
						</DialogHeader>

						<FieldGroup className="my-4">
							<FieldSet>
								<FieldGroup>
									<form.Field name="name">{(field) => <Field><FieldLabel>Vehicle Name<span className="text-destructive">*</span></FieldLabel><Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} /><FieldError errors={field.state.meta.errors} /></Field>}</form.Field>
									<form.Field name="licensePlate">{(field) => <Field><FieldLabel>License Plate<span className="text-destructive">*</span></FieldLabel><Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} /><FieldError errors={field.state.meta.errors} /></Field>}</form.Field>
									<form.Field name="model">{(field) => <Field><FieldLabel>Model<span className="text-destructive">*</span></FieldLabel><Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} /><FieldError errors={field.state.meta.errors} /></Field>}</form.Field>
									<form.Field name="year">{(field) => <Field><FieldLabel>Year<span className="text-destructive">*</span></FieldLabel><Input type="number" value={field.state.value} onChange={(e) => field.handleChange(Number(e.target.value || 0))} /><FieldError errors={field.state.meta.errors} /></Field>}</form.Field>
									<form.Field name="renewal">{(field) => <Field><FieldLabel>Renewal<span className="text-destructive">*</span></FieldLabel><Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="e.g., Insurance, RTO" /><FieldError errors={field.state.meta.errors} /></Field>}</form.Field>
									<form.Field name="renewalDate">{(field) => <Field><FieldLabel>Renewal Date<span className="text-destructive">*</span></FieldLabel><Input type="date" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} /><FieldError errors={field.state.meta.errors} /></Field>}</form.Field>
									<form.Field name="investmentMode">
										{(field) => (
											<Field>
												<FieldLabel>Investment Mode<span className="text-destructive">*</span></FieldLabel>
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
													<ComboboxInput onBlur={field.handleBlur} readOnly showTrigger />
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
										{(mode) => (
											<>
												{mode === "full_amount" && <form.Field name="totalPrice">{(field) => <Field><FieldLabel>Total Price<span className="text-destructive">*</span></FieldLabel><Input type="number" value={field.state.value ?? ""} onChange={(e) => field.handleChange(parseNumber(e.target.value))} /></Field>}</form.Field>}
												{mode === "flexible" && <form.Field name="downPayment">{(field) => <Field><FieldLabel>Down Payment<span className="text-destructive">*</span></FieldLabel><Input type="number" value={field.state.value ?? ""} onChange={(e) => field.handleChange(parseNumber(e.target.value))} /></Field>}</form.Field>}
												{["full_loan", "flexible"].includes(mode) && (
													<>
														<form.Field name="monthlyEmi">{(field) => <Field><FieldLabel>Monthly EMI<span className="text-destructive">*</span></FieldLabel><Input type="number" value={field.state.value ?? ""} onChange={(e) => field.handleChange(parseNumber(e.target.value))} /></Field>}</form.Field>
														<form.Field name="emiStartDate">{(field) => <Field><FieldLabel>Starting Date<span className="text-destructive">*</span></FieldLabel><Input type="date" value={field.state.value ?? ""} onChange={(e) => field.handleChange(e.target.value || null)} /></Field>}</form.Field>
														<form.Field name="emiDurationMonths">{(field) => <Field><FieldLabel>Duration Months<span className="text-destructive">*</span></FieldLabel><Input type="number" value={field.state.value ?? ""} onChange={(e) => field.handleChange(parseNumber(e.target.value))} /></Field>}</form.Field>
													</>
												)}
											</>
										)}
									</form.Subscribe>
									<form.Field name="totalRevenue">{(field) => <Field><FieldLabel>Revenue</FieldLabel><Input type="number" value={field.state.value} onChange={(e) => field.handleChange(Number(e.target.value || 0))} /></Field>}</form.Field>
								</FieldGroup>
							</FieldSet>

							{updateVehicleMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>{updateVehicleMutation.error.message}</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter className="mt-8">
							<Button type="submit" disabled={updateVehicleMutation.isPending}>
								{updateVehicleMutation.isPending ? "Updating..." : "Update Vehicle"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
