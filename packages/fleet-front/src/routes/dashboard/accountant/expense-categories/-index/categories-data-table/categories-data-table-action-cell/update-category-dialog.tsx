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
	FieldLegend,
	FieldLabel,
	FieldSet,
} from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/orpc";

type Category =
	InferRouterOutputs<AppRouter>["accountant"]["expenseCategories"]["get"];
const impactOptions = ["company", "driver", "vehicle"] as const;
type ImpactOption = (typeof impactOptions)[number];

const updateCategoryFormSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Name is required")),
	impact: v.pipe(v.array(v.picklist(impactOptions)), v.minLength(1)),
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
				impact:
					Array.isArray(category.impact) && category.impact.length > 0
						? category.impact
						: ["company"],
			}
		: {
				name: "",
				impact: ["company"],
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
				name: value.name,
				impact: value.impact,
			} as never);
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
					<form.Field name="impact">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							const impacts = field.state.value;
							const toggleImpact = (impact: ImpactOption) => {
								if (impacts.includes(impact)) {
									field.handleChange(impacts.filter((item) => item !== impact));
								} else {
									field.handleChange([...impacts, impact]);
								}
							};
							return (
								<FieldSet data-invalid={isInvalid}>
									<FieldLegend variant="label">
										Impact
										<span className="text-destructive">*</span>
									</FieldLegend>
									<FieldGroup className="gap-3">
										{impactOptions.map((impact) => (
											<Field key={impact} orientation="horizontal">
												<Checkbox
													id={`impact-${category.id}-${impact}`}
													checked={impacts.includes(impact)}
													onCheckedChange={() => toggleImpact(impact)}
													onBlur={field.handleBlur}
												/>
												<FieldLabel
													htmlFor={`impact-${category.id}-${impact}`}
													className="font-normal capitalize"
												>
													{impact}
												</FieldLabel>
											</Field>
										))}
									</FieldGroup>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</FieldSet>
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
