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

type Category =
	InferRouterOutputs<AppRouter>["accountant"]["expenseCategories"]["get"];

const updateCategoryFormSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Name is required")),
});

interface UpdateCategoryDialogProps {
	category: Category | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function UpdateCategoryDialog({
	category,
	isOpen,
	onOpenChange,
}: UpdateCategoryDialogProps) {
	const queryClient = useQueryClient();
	const [localIsOpen, setLocalIsOpen] = useState(false);

	useEffect(() => {
		setLocalIsOpen(isOpen);
	}, [isOpen]);

	const updateCategoryMutation = useMutation({
		...orpc.accountant.expenseCategories.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setLocalIsOpen(false);
			onOpenChange(false);
		},
	});

	const defaultValues: v.InferInput<typeof updateCategoryFormSchema> = category
		? {
				name: category.name,
			}
		: {
				name: "",
			};

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: updateCategoryFormSchema,
		},
		onSubmit: async ({ value }) => {
			if (!category) return;
			updateCategoryMutation.mutate({
				id: category.id,
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

	if (!category) return null;

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
							<DialogTitle>Update Category</DialogTitle>
							<DialogDescription>
								Update your expense category details.
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
													<FieldLabel htmlFor="category-name">
														Category Name
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id="category-name"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="e.g., Gas, Maintenance, Parking"
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

							{updateCategoryMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>
										{updateCategoryMutation.error.message}
									</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter className="mt-8">
							<Button type="submit" disabled={updateCategoryMutation.isPending}>
								{updateCategoryMutation.isPending
									? "Updating..."
									: "Update Category"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
