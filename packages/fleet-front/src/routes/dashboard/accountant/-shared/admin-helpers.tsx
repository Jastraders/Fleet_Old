import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, DownloadIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { orpc } from "@/orpc";

function hasRole(user: unknown, role: string): boolean {
	if (!user || typeof user !== "object" || !("roles" in user)) {
		return false;
	}

	const { roles } = user as { roles?: Array<{ role?: string }> };
	if (!Array.isArray(roles)) {
		return false;
	}

	return roles.some((r) => r.role === role || r.role === "owner");
}

export function useIsAdmin() {
	const { data: user } = useSuspenseQuery(orpc.user.auth.getMe.queryOptions());

	return useMemo(() => hasRole(user, "admin"), [user]);
}

interface AccountantDownloadButtonProps {
	onDownload: () => void;
}

export function AccountantDownloadButton({ onDownload }: AccountantDownloadButtonProps) {
	const isAdmin = useIsAdmin();
	const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);

	const handleClick = () => {
		if (!isAdmin) {
			setIsBlockedDialogOpen(true);
			return;
		}

		onDownload();
	};

	return (
		<>
			<Button type="button" variant="outline" size="icon" onClick={handleClick} aria-label="Download current table data">
				<DownloadIcon className="h-4 w-4" />
			</Button>
			<AlertDialog open={isBlockedDialogOpen} onOpenChange={setIsBlockedDialogOpen}>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogMedia>
							<AlertTriangleIcon className="text-amber-600" />
						</AlertDialogMedia>
						<AlertDialogTitle>Access denied</AlertDialogTitle>
						<AlertDialogDescription>
							Only admin can download.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction type="button" onClick={() => setIsBlockedDialogOpen(false)}>
							OK
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function downloadExcelCompatibleCsv(filename: string, rows: Array<Record<string, unknown>>) {
	if (rows.length === 0) {
		return;
	}

	const headers = Object.keys(rows[0] ?? {});
	const csv = [
		headers.join(","),
		...rows.map((row) =>
			headers
				.map((header) => {
					const rawValue = row[header];
					const value = rawValue == null ? "" : String(rawValue);
					const escaped = value.replaceAll("\"", "\"\"");
					return `"${escaped}"`;
				})
				.join(","),
		),
	].join("\n");

	const blob = new Blob([`\uFEFF${csv}`], {
		type: "text/csv;charset=utf-8;",
	});
	const link = document.createElement("a");
	const url = URL.createObjectURL(blob);
	link.href = url;
	link.download = `${filename}.csv`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export function useRowAccess() {
	const queryClient = useQueryClient();

	const canAccess = async (input: {
		pageName: string;
		resourceType: string;
		resourceId: string;
		action: "edit" | "delete";
	}) => {
		const result = await queryClient.fetchQuery(
			orpc.general.access.check.queryOptions({ input: input as never }),
		);
		return Boolean((result as { allowed?: boolean })?.allowed);
	};

	return { canAccess };
}

interface AccessDeniedDialogProps {
	open: boolean;
	onOpenChange: (next: boolean) => void;
	pageName: string;
	resourceType: string;
	resourceId: string;
	primaryLabel: string;
}

export function AccessDeniedDialog({
	open,
	onOpenChange,
	pageName,
	resourceType,
	resourceId,
	primaryLabel,
}: AccessDeniedDialogProps) {
	const requestMutation = useMutation({
		...orpc.general.access.request.mutationOptions(),
	});

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogMedia>
						<AlertTriangleIcon className="text-amber-600" />
					</AlertDialogMedia>
					<AlertDialogTitle>Access denied</AlertDialogTitle>
					<AlertDialogDescription>Only admin can edit or delete.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel type="button" onClick={() => onOpenChange(false)}>
						OK
					</AlertDialogCancel>
					<AlertDialogAction
						type="button"
						onClick={() => {
							requestMutation.mutate(
								{
									pageName,
									resourceType,
									resourceId,
									primaryLabel,
									actions: ["edit", "delete"],
								} as never,
								{
									onSuccess: () => onOpenChange(false),
								},
							);
						}}
						disabled={requestMutation.isPending}
					>
						Request Access
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
