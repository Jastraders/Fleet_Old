import { MoreVerticalIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Vehicle } from "@/models/vehicle";
import { AccessDeniedDialog, useIsAdmin, useRowAccess } from "@/routes/dashboard/accountant/-shared/admin-helpers";
import { DeleteVehicleAlertDialog } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-data-table/vehicles-data-table-action-cell/delete-vehicle-alert-dialog";
import { UpdateVehicleDialog } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-data-table/vehicles-data-table-action-cell/update-vehicle-dialog";

export function VehiclesDataTableActionCell({ vehicle }: { vehicle: Vehicle }) {
	const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
	const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
	const isAdmin = useIsAdmin();
	const { canAccess } = useRowAccess();

	const handleEdit = useCallback(async () => {
		if (!isAdmin && !(await canAccess({ pageName: "Vehicles", resourceType: "vehicle", resourceId: vehicle.id, action: "edit" }))) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedVehicle(vehicle);
		setIsUpdateDialogOpen(true);
	}, [vehicle, isAdmin, canAccess]);

	const handleDeleteClick = useCallback(async () => {
		if (!isAdmin && !(await canAccess({ pageName: "Vehicles", resourceType: "vehicle", resourceId: vehicle.id, action: "delete" }))) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedVehicle(vehicle);
		setIsDeleteDialogOpen(true);
	}, [vehicle, isAdmin, canAccess]);

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
			<AccessDeniedDialog
				open={isBlockedDialogOpen}
				onOpenChange={setIsBlockedDialogOpen}
				pageName="Vehicles"
				resourceType="vehicle"
				resourceId={vehicle.id}
				primaryLabel={vehicle.name}
			/>
		</>
	);
}
