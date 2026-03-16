import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, PlusIcon } from "lucide-react";
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
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/orpc";

const createDriverFormSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Name is required")),
	phoneNumber: v.pipe(v.string(), v.minLength(1, "Phone number is required")),
});

const defaultValues: v.InferInput<typeof createDriverFormSchema> = {
	name: "",
	phoneNumber: "",
};

export function CreateDriverDialog() {
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);

	const createDriverMutation = useMutation({
		...orpc.accountant.drivers.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setIsOpen(false);
		},
	});

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: createDriverFormSchema,
		},
		onSubmit: async ({ value }) => {
			createDriverMutation.mutate(value);
		},
	});

	const handleOpenChange = useCallback(
		(open: boolean) => {
			setIsOpen(open);
			if (!open) {
				form.reset();
			}
		},
		[form],
	);

	const handleSubmitForm = useCallback(() => {
		form.handleSubmit();
	}, [form]);

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					<Button>
						<PlusIcon />
						Add Driver
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
							<DialogTitle>Add Driver</DialogTitle>
							<DialogDescription>
								Create a new driver to organize your expenses.
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

							{createDriverMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>
										{createDriverMutation.error.message}
									</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter className="mt-8">
							<Button type="submit" disabled={createDriverMutation.isPending}>
								{createDriverMutation.isPending
									? "Creating..."
									: "Create Driver"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
