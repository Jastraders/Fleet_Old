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

const updateVehicleFormSchema = v.object({
	name: v.pipe(
		v.string(),
		v.minLength(1, "Name is required"),
		v.maxLength(255),
	),
	licensePlate: v.pipe(
		v.string(),
		v.minLength(1, "License Plate is required"),
		v.maxLength(255),
	),
});

interface UpdateVehicleDialogProps {
	vehicle: Vehicle | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

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
			}
		: {
				name: "",
				licensePlate: "",
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
									<form.Field name="name">
										{(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="vehicle-name">
														Vehicle Name
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id="vehicle-name"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="e.g., Fleet Truck #1"
														aria-invalid={isInvalid}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									</form.Field>
									<form.Field name="licensePlate">
										{(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="vehicle-licensePlate">
														License Plate
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id="vehicle-licensePlate"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="e.g., ABC-1234"
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

							{updateVehicleMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>
										{updateVehicleMutation.error.message}
									</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter className="mt-8">
							<Button type="submit" disabled={updateVehicleMutation.isPending}>
								{updateVehicleMutation.isPending
									? "Updating..."
									: "Update Vehicle"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
