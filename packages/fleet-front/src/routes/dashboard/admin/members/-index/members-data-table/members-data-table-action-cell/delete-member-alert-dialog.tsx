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
import type { Member } from "@/routes/dashboard/admin/members/-route/types";

interface DeleteMemberAlertDialogProps {
	member: Member | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteMemberAlertDialog({
	member,
	isOpen,
	onOpenChange,
}: DeleteMemberAlertDialogProps) {
	const queryClient = useQueryClient();
	const [localIsOpen, setLocalIsOpen] = useState(false);

	useEffect(() => {
		setLocalIsOpen(isOpen);
	}, [isOpen]);

	const deleteMemberMutation = useMutation({
		...orpc.admin.members.delete.mutationOptions(),
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
		if (!member) return;
		deleteMemberMutation.mutate({ id: member.id });
	}, [member, deleteMemberMutation]);

	if (!member) return null;

	return (
		<AlertDialog open={localIsOpen} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Member</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete "{member.name}"? This action cannot
						be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={handleConfirmDelete}
						disabled={deleteMemberMutation.isPending}
					>
						{deleteMemberMutation.isPending ? "Deleting..." : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
