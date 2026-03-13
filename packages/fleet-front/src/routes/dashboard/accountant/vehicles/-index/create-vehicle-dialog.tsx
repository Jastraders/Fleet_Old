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
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/orpc";

const createVehicleFormSchema = v.object({
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

const defaultValues: v.InferInput<typeof createVehicleFormSchema> = {
	name: "",
	licensePlate: "",
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

							{createVehicleMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>
										{createVehicleMutation.error.message}
									</AlertDescription>
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
