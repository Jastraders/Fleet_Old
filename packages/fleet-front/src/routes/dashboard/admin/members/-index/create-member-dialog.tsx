import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
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
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/orpc";

const createMemberFormSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Name is required")),
	email: v.pipe(v.string(), v.email("Invalid email address"), v.maxLength(255)),
	password: v.pipe(
		v.string(),
		v.minLength(8, "Password must be at least 8 characters"),
		v.maxLength(32, "Password must not exceed 32 characters"),
	),
	roles: v.pipe(
		v.array(v.picklist(["admin", "accountant", "analyst"], "Invalid role")),
		v.minLength(1, "At least one role is required"),
	),
});

const defaultValues: v.InferInput<typeof createMemberFormSchema> = {
	name: "",
	email: "",
	password: "",
	roles: ["admin"],
};

export function CreateMemberDialog() {
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);

	const createMemberMutation = useMutation({
		...orpc.admin.members.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setIsOpen(false);
		},
	});

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: createMemberFormSchema,
		},
		onSubmit: async ({ value }) => {
			createMemberMutation.mutate(value);
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
						Add Member
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
							<DialogTitle>Add Member</DialogTitle>
							<DialogDescription>
								Invite a new member to your organization with an email address
								and set their role.
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
													<FieldLabel htmlFor="member-name">
														Full Name
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id="member-name"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														placeholder="John Doe"
														aria-invalid={isInvalid}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									</form.Field>
									<form.Field name="email">
										{(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="member-email">
														Email Address
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id="member-email"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														type="email"
														placeholder="john@example.com"
														aria-invalid={isInvalid}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									</form.Field>
									<form.Field name="password">
										{(field) => {
											const isInvalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor="member-password">
														Password
														<span className="text-destructive">*</span>
													</FieldLabel>
													<Input
														id="member-password"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														type="password"
														placeholder="••••••••"
														aria-invalid={isInvalid}
													/>
													{isInvalid && (
														<FieldError errors={field.state.meta.errors} />
													)}
												</Field>
											);
										}}
									</form.Field>
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
																			role as
																				| "admin"
																				| "accountant"
																				| "analyst",
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
								</FieldGroup>
							</FieldSet>

							{createMemberMutation.error && (
								<Alert>
									<InfoIcon />
									<AlertDescription>
										{createMemberMutation.error.message}
									</AlertDescription>
								</Alert>
							)}
						</FieldGroup>

						<DialogFooter>
							<Button type="submit" disabled={createMemberMutation.isPending}>
								{createMemberMutation.isPending ? "Adding..." : "Add Member"}
							</Button>
						</DialogFooter>
					</form>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
