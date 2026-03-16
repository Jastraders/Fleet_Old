import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppRouter, InferRouterOutputs } from "fleet-back";
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
import { orpc } from "@/orpc";

type Driver =
	InferRouterOutputs<AppRouter>["accountant"]["drivers"]["get"];

const updateDriverFormSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Name is required")),
	phoneNumber: v.pipe(v.string(), v.minLength(1, "Phone number is required")),
});

interface UpdateDriverDialogProps {
	driver: Driver | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function UpdateDriverDialog({
	driver,
	isOpen,
	onOpenChange,
}: UpdateDriverDialogProps) {
	const queryClient = useQueryClient();
	const [localIsOpen, setLocalIsOpen] = useState(false);

	useEffect(() => {
		setLocalIsOpen(isOpen);
	}, [isOpen]);

	const updateDriverMutation = useMutation({
		...orpc.accountant.drivers.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setLocalIsOpen(false);
			onOpenChange(false);
		},
	});

	const defaultValues: v.InferInput<typeof updateDriverFormSchema> = driver
		? {
				name: driver.name,
				phoneNumber: driver.phoneNumber,
			}
		: {
				name: "",
				phoneNumber: "",
			};

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: updateDriverFormSchema,
		},
		onSubmit: async ({ value }) => {
			if (!driver) return;
			updateDriverMutation.mutate({
				id: driver.id,
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

	if (!driver) return null;

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
							<DialogTitle>Update Driver</DialogTitle>
							<DialogDescription>
								Update your driver details.
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
													<FieldLabel htmlFor="driver-name">
														Driver Name
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id="driver-name"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
													placeholder="e.g., Raj Kumar"
													aria-invalid={isInvalid}
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
									</form.Field>
									<form.Field name="phoneNumber">
										{(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="driver-phone-number">
														Driver Phone Number
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id="driver-phone-number"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="e.g., +91 9876543210"
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

							{updateDriverMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>
										{updateDriverMutation.error.message}
									</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter className="mt-8">
							<Button type="submit" disabled={updateDriverMutation.isPending}>
								{updateDriverMutation.isPending
									? "Updating..."
									: "Update Driver"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
