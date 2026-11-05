import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
	CheckCircle2Icon,
	InfoIcon,
	KeyRoundIcon,
	MailIcon,
	RefreshCwIcon,
	ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { orpc } from "@/orpc";

const formSchema = v.object({
	email: v.pipe(v.string(), v.email(), v.maxLength(255)),
	password: v.pipe(v.string(), v.minLength(8)),
});

const defaultValues: v.InferInput<typeof formSchema> = {
	email: "",
	password: "",
};

const DEFAULT_ADMIN_EMAIL = "anwarjas123@gmail.com";

export function SignInForm() {
	const queryClient = useQueryClient();
	const router = useRouter();

	// Password reset dialog state
	const [resetDialogOpen, setResetDialogOpen] = useState(false);
	const [resetStep, setResetStep] = useState<"request" | "verify" | "done">("request");
	const [adminEmail, setAdminEmail] = useState(DEFAULT_ADMIN_EMAIL);
	const [resetCode, setResetCode] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [cooldown, setCooldown] = useState(0);
	const [isRequesting, setIsRequesting] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [resetError, setResetError] = useState<string | null>(null);
	const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
	const [loginNotice, setLoginNotice] = useState<string | null>(null);

	// Cooldown timer effect
	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = setInterval(() => {
			setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
		}, 1000);
		return () => clearInterval(timer);
	}, [cooldown]);

	// Fetch dynamic admin email if available
	useEffect(() => {
		fetch("/api/auth/admin-reset-info")
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.targetEmail) {
					setAdminEmail(data.targetEmail);
				}
			})
			.catch(() => {});
	}, []);

	const signInMutation = useMutation<
		unknown,
		Error,
		v.InferInput<typeof formSchema>
	>({
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
		defaultValues,
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			setLoginNotice(null);
			signInMutation.mutate(value);
		},
	});

	const emailId = useId();
	const passwordId = useId();

	const handleSendCode = async () => {
		setIsRequesting(true);
		setResetError(null);
		try {
			const res = await fetch("/api/auth/request-admin-reset-code", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || data.message || "Failed to send reset code");
			}
			setResetStep("verify");
			setCooldown(data.cooldownSeconds || 60);
			setResetSuccessMsg(
				`6-digit verification code sent to ${data.targetEmail || adminEmail}. Please check your inbox or spam folder.`
			);
		} catch (err: any) {
			setResetError(err?.message || "Failed to send verification code. Please try again.");
		} finally {
			setIsRequesting(false);
		}
	};

	const handleVerifyAndReset = async () => {
		const cleanCode = resetCode.trim();
		if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
			setResetError("Please enter the complete 6-digit verification code.");
			return;
		}
		if (newPassword.length < 8) {
			setResetError("New password must be at least 8 characters long.");
			return;
		}
		if (newPassword !== confirmPassword) {
			setResetError("Passwords do not match.");
			return;
		}

		setIsVerifying(true);
		setResetError(null);
		try {
			const res = await fetch("/api/auth/verify-admin-reset-code", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					code: cleanCode,
					newPassword,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || data.message || "Failed to reset password");
			}
			setResetStep("done");
			form.setFieldValue("email", adminEmail);
			form.setFieldValue("password", "");
			setLoginNotice("Password updated successfully! Please log in with your new password.");
		} catch (err: any) {
			setResetError(err?.message || "Failed to verify code and reset password.");
		} finally {
			setIsVerifying(false);
		}
	};

	return (
		<>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Welcome back</CardTitle>
					<CardDescription>Login to your account</CardDescription>
				</CardHeader>
				<CardContent>
					{loginNotice && (
						<Alert className="mb-4 border-green-500/50 text-green-700 bg-green-50 dark:bg-green-950/20 dark:text-green-300">
							<CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400" />
							<AlertDescription>{loginNotice}</AlertDescription>
						</Alert>
					)}
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
												<button
													type="button"
													onClick={() => {
														setResetDialogOpen(true);
														setResetStep("request");
														setResetError(null);
														setResetSuccessMsg(null);
														setResetCode("");
														setNewPassword("");
														setConfirmPassword("");
													}}
													className="ml-auto text-sm text-primary underline-offset-4 hover:underline cursor-pointer bg-transparent border-0 p-0"
												>
													Forgot your password?
												</button>
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

			{/* Admin Password Reset Dialog */}
			<Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
				<DialogContent className="sm:max-w-md">
					{resetStep === "request" && (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2 text-lg">
									<KeyRoundIcon className="size-5 text-primary" />
									Reset Admin Password
								</DialogTitle>
								<DialogDescription>
									Send a 6-digit verification code to the registered admin email to reset password.
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-2">
								<div className="rounded-lg border bg-muted/40 p-4 space-y-2">
									<div className="flex items-center gap-2 text-sm font-medium text-foreground">
										<MailIcon className="size-4 text-primary" />
										<span>Admin Email</span>
									</div>
									<div className="flex items-center justify-between rounded-md bg-background px-3 py-2 border font-mono text-sm">
										<span className="font-semibold text-foreground">{adminEmail}</span>
										<span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-sans font-medium">
											Admin
										</span>
									</div>
									<p className="text-xs text-muted-foreground leading-relaxed">
										Click <strong>Send Code</strong> below. A secure 6-digit verification code will be sent to <strong>{adminEmail}</strong>.
									</p>
								</div>

								{resetError && (
									<Alert variant="destructive">
										<AlertDescription>{resetError}</AlertDescription>
									</Alert>
								)}
							</div>

							<DialogFooter className="flex sm:justify-between items-center gap-2">
								<Button
									variant="outline"
									type="button"
									onClick={() => setResetDialogOpen(false)}
								>
									Cancel
								</Button>
								<Button
									type="button"
									disabled={isRequesting}
									onClick={handleSendCode}
									className="gap-2"
								>
									{isRequesting ? (
										<>
											<RefreshCwIcon className="size-4 animate-spin" />
											Sending Code...
										</>
									) : (
										<>
											<MailIcon className="size-4" />
											Send Code
										</>
									)}
								</Button>
							</DialogFooter>
						</>
					)}

					{resetStep === "verify" && (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2 text-lg">
									<KeyRoundIcon className="size-5 text-primary" />
									Enter Verification Code
								</DialogTitle>
								<DialogDescription>
									Enter the 6-digit code sent to <strong className="text-foreground">{adminEmail}</strong> and choose your new password.
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-2">
								{resetSuccessMsg && (
									<Alert className="border-green-500/50 text-green-700 bg-green-50 dark:bg-green-950/20 dark:text-green-300">
										<CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400" />
										<AlertDescription>{resetSuccessMsg}</AlertDescription>
									</Alert>
								)}

								{resetError && (
									<Alert variant="destructive">
										<AlertDescription>{resetError}</AlertDescription>
									</Alert>
								)}

								<div className="space-y-2">
									<FieldLabel htmlFor="reset-code" className="text-sm font-medium">6-Digit Verification Code</FieldLabel>
									<Input
										id="reset-code"
										type="text"
										inputMode="numeric"
										pattern="[0-9]*"
										maxLength={6}
										value={resetCode}
										onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
										placeholder="123456"
										className="text-center font-mono text-xl tracking-[0.4em] font-bold h-11"
										autoComplete="one-time-code"
										autoFocus
									/>
									<div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
										<span>Code valid for 10 minutes</span>
										{cooldown > 0 ? (
											<span>Resend in {cooldown}s</span>
										) : (
											<button
												type="button"
												disabled={isRequesting}
												onClick={handleSendCode}
												className="text-primary hover:underline font-medium cursor-pointer bg-transparent border-0 p-0"
											>
												Resend Code
											</button>
										)}
									</div>
								</div>

								<div className="space-y-2">
									<FieldLabel htmlFor="new-password">New Password</FieldLabel>
									<Input
										id="new-password"
										type="password"
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										placeholder="Minimum 8 characters"
									/>
								</div>

								<div className="space-y-2">
									<FieldLabel htmlFor="confirm-password">Confirm New Password</FieldLabel>
									<Input
										id="confirm-password"
										type="password"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										placeholder="Re-enter new password"
									/>
									{confirmPassword && newPassword !== confirmPassword && (
										<p className="text-xs text-destructive">Passwords do not match.</p>
									)}
								</div>
							</div>

							<DialogFooter className="flex sm:justify-between items-center gap-2">
								<Button
									variant="outline"
									type="button"
									onClick={() => {
										setResetStep("request");
										setResetError(null);
									}}
								>
									Back
								</Button>
								<Button
									type="button"
									disabled={
										isVerifying ||
										resetCode.trim().length !== 6 ||
										newPassword.length < 8 ||
										newPassword !== confirmPassword
									}
									onClick={handleVerifyAndReset}
									className="gap-2"
								>
									{isVerifying ? (
										<>
											<RefreshCwIcon className="size-4 animate-spin" />
											Updating...
										</>
									) : (
										<>
											<KeyRoundIcon className="size-4" />
											Reset Password
										</>
									)}
								</Button>
							</DialogFooter>
						</>
					)}

					{resetStep === "done" && (
						<>
							<div className="text-center py-6 space-y-3">
								<div className="mx-auto size-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
									<ShieldCheckIcon className="size-6" />
								</div>
								<h3 className="font-semibold text-lg text-foreground">Password Reset Successful!</h3>
								<p className="text-sm text-muted-foreground max-w-xs mx-auto">
									Your password has been changed successfully. You can now log in using <strong>{adminEmail}</strong> and your new password.
								</p>
							</div>

							<DialogFooter>
								<Button
									type="button"
									className="w-full"
									onClick={() => {
										setResetDialogOpen(false);
										setResetStep("request");
										setResetCode("");
										setNewPassword("");
										setConfirmPassword("");
									}}
								>
									Back to Login
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
