import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import * as v from "valibot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/orpc";
import type { Member } from "@/routes/dashboard/admin/members/-route/types";

const updateMemberFormSchema = v.object({
	roles: v.pipe(
		v.array(v.picklist(["admin", "accountant", "analyst"], "Invalid role")),
		v.minLength(1, "At least one role is required"),
	),
});

interface UpdateMemberDialogProps {
	member: Member | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function UpdateMemberDialog({
	member,
	isOpen,
	onOpenChange,
}: UpdateMemberDialogProps) {
	const queryClient = useQueryClient();
	const [localIsOpen, setLocalIsOpen] = useState(false);

	useEffect(() => {
		setLocalIsOpen(isOpen);
	}, [isOpen]);

	const updateMemberMutation = useMutation({
		...orpc.admin.members.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setLocalIsOpen(false);
			onOpenChange(false);
		},
	});

	const defaultValues: v.InferInput<typeof updateMemberFormSchema> = member
		? {
				roles: member.roles.map((r) => r.role) as Array<
					"admin" | "accountant" | "analyst"
				>,
			}
		: {
				roles: [],
			};

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: updateMemberFormSchema,
		},
		onSubmit: async ({ value }) => {
			if (!member) return;
			updateMemberMutation.mutate({
				id: member.id,
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

	if (!member) return null;

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
							<DialogTitle>Update Member</DialogTitle>
							<DialogDescription>
								Update member role for {member.name}.
							</DialogDescription>
						</DialogHeader>

						<FieldGroup className="my-4">
							<FieldSet>
								<form.Field name="roles">
									{(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										const roles = field.state.value;
										const toggleRole = (
											role: "admin" | "accountant" | "analyst",
										) => {
											if (roles.includes(role)) {
												field.handleChange(roles.filter((r) => r !== role));
											} else {
												field.handleChange([...roles, role]);
											}
										};
										return (
											<FieldSet data-invalid={isInvalid}>
												<FieldLegend variant="label">
													Roles
													<span className="text-destructive">*</span>
												</FieldLegend>
												<FieldGroup className="gap-3">
													{["admin", "accountant", "analyst"].map((role) => (
														<Field key={role} orientation="horizontal">
															<Checkbox
																id={`role-${role}`}
																checked={roles.includes(
																	role as "admin" | "accountant" | "analyst",
																)}
																onCheckedChange={() =>
																	toggleRole(
																		role as "admin" | "accountant" | "analyst",
																	)
																}
															/>
															<FieldLabel
																htmlFor={`role-${role}`}
																className="font-normal capitalize"
															>
																{role}
															</FieldLabel>
														</Field>
													))}
												</FieldGroup>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</FieldSet>
										);
									}}
								</form.Field>
							</FieldSet>

							{updateMemberMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>
										{updateMemberMutation.error.message}
									</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter className="mt-8">
							<Button type="submit" disabled={updateMemberMutation.isPending}>
								{updateMemberMutation.isPending
									? "Updating..."
									: "Update Member"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
