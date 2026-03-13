import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { InfoIcon } from "lucide-react";
import { useId } from "react";
import * as v from "valibot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { orpc } from "@/orpc";

const formSchema = v.object({
	email: v.pipe(v.string(), v.email(), v.maxLength(255)),
	password: v.pipe(v.string(), v.minLength(8)),
});

export function SignInForm() {
	const queryClient = useQueryClient();
	const router = useRouter();

	const signInMutation = useMutation({
		...orpc.user.auth.signInWithEmailAndPassword.mutationOptions(),
		onSuccess: () => {
			queryClient.clear();
			return router.invalidate();
		},
		onError: (error) => {
			console.error("[auth] sign-in failed", {
				error,
				message: error.message,
				stack: error.stack,
				cause: (error as Error & { cause?: unknown }).cause,
			});
		},
	});

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			signInMutation.mutate(value);
		},
	});

	const emailId = useId();
	const passwordId = useId();

	return (
		<Card>
			<CardHeader className="text-center">
				<CardTitle className="text-xl">Welcome back</CardTitle>
				<CardDescription>Login to your account</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="email">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={emailId}>Email</FieldLabel>
										<Input
											id={emailId}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											type="email"
											placeholder="admin@example.com"
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
										<div className="flex items-center">
											<FieldLabel htmlFor={passwordId}>Password</FieldLabel>
											<Link
												disabled
												to="/"
												className="ml-auto text-sm underline-offset-4 hover:underline"
											>
												Forgot your password?
											</Link>
										</div>
										<Input
											id={passwordId}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											type="password"
											aria-invalid={isInvalid}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>
						{signInMutation.error && (
							<Alert>
								<InfoIcon />
								<AlertDescription>
									{signInMutation.error.message}
								</AlertDescription>
							</Alert>
						)}
						<Field>
							<Button
								type="submit"
								className="w-full"
								disabled={signInMutation.isPending}
							>
								{signInMutation.isPending ? "Logging in..." : "Login"}
							</Button>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
