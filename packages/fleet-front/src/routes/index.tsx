import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { GalleryVerticalEndIcon } from "lucide-react";
import { FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { SignInForm } from "./-index/sign-in-form";

export const Route = createFileRoute("/")({
	beforeLoad: async ({ context: { user } }) => {
		if (user) {
			throw redirect({
				to: "/dashboard",
			});
		}
	},
	component: App,
});

function App() {
	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<Link
					to="/"
					className="flex items-center gap-2 self-center font-medium"
				>
					<div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
						<GalleryVerticalEndIcon className="size-4" />
					</div>
					Fleet
				</Link>
				<SignInForm />
			</div>
		</div>
	);
}

const termsLinks = (
	<>
		<Link to="/">Terms of Service</Link> and <Link to="/">Privacy Policy</Link>.
	</>
);

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<SignInForm />
			<FieldDescription className="text-center">
				By clicking continue, you agree to our {termsLinks}
			</FieldDescription>
		</div>
	);
}
