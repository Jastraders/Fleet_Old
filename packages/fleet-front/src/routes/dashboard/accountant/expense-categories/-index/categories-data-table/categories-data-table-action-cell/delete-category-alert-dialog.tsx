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
import type { ExpenseCategory } from "@/routes/dashboard/accountant/expense-categories/-route/types";

interface DeleteCategoryAlertDialogProps {
	category: ExpenseCategory | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteCategoryAlertDialog({
	category,
	isOpen,
	onOpenChange,
}: DeleteCategoryAlertDialogProps) {
	const queryClient = useQueryClient();
	const [localIsOpen, setLocalIsOpen] = useState(false);

	useEffect(() => {
		setLocalIsOpen(isOpen);
	}, [isOpen]);

	const deleteCategoryMutation = useMutation({
		...orpc.accountant.expenseCategories.delete.mutationOptions(),
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
		if (!category) return;
		deleteCategoryMutation.mutate({ id: category.id });
	}, [category, deleteCategoryMutation]);

	if (!category) return null;

	return (
		<AlertDialog open={localIsOpen} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Category</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete "{category.name}"? This action
						cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={handleConfirmDelete}
						disabled={deleteCategoryMutation.isPending}
					>
						{deleteCategoryMutation.isPending ? "Deleting..." : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
