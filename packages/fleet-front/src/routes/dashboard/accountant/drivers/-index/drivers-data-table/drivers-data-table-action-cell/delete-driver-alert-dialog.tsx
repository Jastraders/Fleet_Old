import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { orpc } from "@/orpc";
import type { Driver } from "@/routes/dashboard/accountant/drivers/-route/types";

interface DeleteDriverAlertDialogProps {
	driver: Driver | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteDriverAlertDialog({
	driver,
	isOpen,
	onOpenChange,
}: DeleteDriverAlertDialogProps) {
	const queryClient = useQueryClient();
	const [localIsOpen, setLocalIsOpen] = useState(false);

	useEffect(() => {
		setLocalIsOpen(isOpen);
	}, [isOpen]);

	const deleteDriverMutation = useMutation({
		...orpc.accountant.drivers.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setLocalIsOpen(false);
			onOpenChange(false);
		},
	});

	const handleOpenChange = useCallback(
		(open: boolean) => {
			setLocalIsOpen(open);
			onOpenChange(open);
		},
		[onOpenChange],
	);

	const handleConfirmDelete = useCallback(() => {
		if (!driver) return;
		deleteDriverMutation.mutate({ id: driver.id });
	}, [driver, deleteDriverMutation]);

	if (!driver) return null;

	return (
		<AlertDialog open={localIsOpen} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Driver</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete "{driver.name}"? This action
						cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={handleConfirmDelete}
						disabled={deleteDriverMutation.isPending}
					>
						{deleteDriverMutation.isPending ? "Deleting..." : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
