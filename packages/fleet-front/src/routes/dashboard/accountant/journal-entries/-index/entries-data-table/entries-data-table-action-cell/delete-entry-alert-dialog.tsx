import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { orpc } from "@/orpc";

interface JournalEntryItem {
	id: string;
	transactionDate: Date;
	type: "credit" | "debit";
	amount: string;
	expenseCategoryId: string | null;
}

interface JournalEntry {
	id: string;
	vehicleId: string;
	createdBy: string | null;
	notes: string | null;
	createdAt: Date;
	vehicle?: {
		id: string;
		name: string;
		licensePlate: string | null;
	} | null;
	items?: JournalEntryItem[];
	createdByUser?: {
		id: string;
		name: string;
		image?: string | null;
	} | null;
}

interface DeleteEntryAlertDialogProps {
	entry: JournalEntry | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteEntryAlertDialog({
	entry,
	isOpen,
	onOpenChange,
}: DeleteEntryAlertDialogProps) {
	const queryClient = useQueryClient();
	const [isDeleting, setIsDeleting] = useState(false);

	const deleteEntryMutation = useMutation({
		...orpc.accountant.journalEntries.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries();
			setIsDeleting(false);
			onOpenChange(false);
		},
	});

	const handleConfirmDelete = () => {
		if (!entry) return;
		setIsDeleting(true);
		deleteEntryMutation.mutate({ id: entry.id });
	};

	return (
		<AlertDialog open={isOpen} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Entry</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete this journal entry? This action
						cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="flex gap-2">
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirmDelete}
						disabled={isDeleting || deleteEntryMutation.isPending}
						variant="destructive"
					>
						{isDeleting || deleteEntryMutation.isPending
							? "Deleting..."
							: "Delete"}
					</AlertDialogAction>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	);
}
