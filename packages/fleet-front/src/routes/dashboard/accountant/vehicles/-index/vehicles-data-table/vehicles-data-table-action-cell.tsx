import { MoreVerticalIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";
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
} from "@/components/ui/alert-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Vehicle } from "@/models/vehicle";
import { useIsAdmin } from "@/routes/dashboard/accountant/-shared/admin-helpers";
import { DeleteVehicleAlertDialog } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-data-table/vehicles-data-table-action-cell/delete-vehicle-alert-dialog";
import { UpdateVehicleDialog } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-data-table/vehicles-data-table-action-cell/update-vehicle-dialog";

export function VehiclesDataTableActionCell({ vehicle }: { vehicle: Vehicle }) {
	const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
	const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
	const isAdmin = useIsAdmin();

	const handleEdit = useCallback(() => {
		if (!isAdmin) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedVehicle(vehicle);
		setIsUpdateDialogOpen(true);
	}, [vehicle, isAdmin]);

	const handleDeleteClick = useCallback(() => {
		if (!isAdmin) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedVehicle(vehicle);
		setIsDeleteDialogOpen(true);
	}, [vehicle, isAdmin]);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="ghost" size="icon">
							<MoreVerticalIcon />
							<span className="sr-only">Open actions menu</span>
						</Button>
					}
				/>
				<DropdownMenuContent align="end">
					<DropdownMenuGroup>
						<DropdownMenuItem onClick={handleEdit}>
							<PencilIcon />
							Edit
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem variant="destructive" onClick={handleDeleteClick}>
							<TrashIcon />
							Delete
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			<UpdateVehicleDialog
				vehicle={selectedVehicle}
				isOpen={isUpdateDialogOpen}
				onOpenChange={setIsUpdateDialogOpen}
			/>

			<DeleteVehicleAlertDialog
				vehicle={selectedVehicle}
				isOpen={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			/>
			<AlertDialog open={isBlockedDialogOpen} onOpenChange={setIsBlockedDialogOpen}>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogMedia>
							<TrashIcon className="text-amber-600" />
						</AlertDialogMedia>
						<AlertDialogTitle>Access denied</AlertDialogTitle>
						<AlertDialogDescription>Only admin can edit or delete.</AlertDialogDescription>
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
