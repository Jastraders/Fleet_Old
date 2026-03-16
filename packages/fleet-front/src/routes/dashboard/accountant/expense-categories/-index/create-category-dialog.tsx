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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/orpc";

const createCategoryFormSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Name is required")),
	impact: v.pipe(
		v.string(),
		v.picklist(["company", "driver"], "Impact is required"),
	),
});

const defaultValues: v.InferInput<typeof createCategoryFormSchema> = {
	name: "",
	impact: "company",
};

export function CreateCategoryDialog() {
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);

	const createCategoryMutation = useMutation({
		...orpc.accountant.expenseCategories.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setIsOpen(false);
		},
	});

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: createCategoryFormSchema,
		},
		onSubmit: async ({ value }) => {
			createCategoryMutation.mutate(value as never);
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
						Add Category
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
							<DialogTitle>Add Category</DialogTitle>
							<DialogDescription>
								Create a new expense category to organize your expenses.
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
					<form.Field name="impact">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor="category-impact">
										Impact
										<span className="text-destructive">*</span>
									</FieldLabel>
									<Select
										value={field.state.value}
										onValueChange={(value) => field.handleChange(value ?? "")}
									>
										<SelectTrigger id="category-impact" onBlur={field.handleBlur}>
											<SelectValue placeholder="Select impact" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="company">Company</SelectItem>
											<SelectItem value="driver">Driver</SelectItem>
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>
							</FieldSet>

							{createCategoryMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>
										{createCategoryMutation.error.message}
									</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter className="mt-8">
							<Button type="submit" disabled={createCategoryMutation.isPending}>
								{createCategoryMutation.isPending
									? "Creating..."
									: "Create Category"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
