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
import type { Vehicle } from "@/models/vehicle";
import { orpc } from "@/orpc";

interface DeleteVehicleAlertDialogProps {
	vehicle: Vehicle | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteVehicleAlertDialog({
	vehicle,
	isOpen,
	onOpenChange,
}: DeleteVehicleAlertDialogProps) {
	const queryClient = useQueryClient();
	const [localIsOpen, setLocalIsOpen] = useState(false);

	useEffect(() => {
		setLocalIsOpen(isOpen);
	}, [isOpen]);

	const deleteVehicleMutation = useMutation({
		...orpc.accountant.vehicles.delete.mutationOptions(),
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
		if (!vehicle) return;
		deleteVehicleMutation.mutate({ id: vehicle.id });
	}, [vehicle, deleteVehicleMutation]);

	if (!vehicle) return null;

	return (
		<AlertDialog open={localIsOpen} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete "{vehicle.name}"? This action cannot
						be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={handleConfirmDelete}
						disabled={deleteVehicleMutation.isPending}
					>
						{deleteVehicleMutation.isPending ? "Deleting..." : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
