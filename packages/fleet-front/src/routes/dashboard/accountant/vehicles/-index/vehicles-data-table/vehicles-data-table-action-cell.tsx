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
import { DeleteVehicleAlertDialog } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-data-table/vehicles-data-table-action-cell/delete-vehicle-alert-dialog";
import { UpdateVehicleDialog } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-data-table/vehicles-data-table-action-cell/update-vehicle-dialog";

export function VehiclesDataTableActionCell({ vehicle }: { vehicle: Vehicle }) {
	const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
	const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const handleEdit = useCallback(() => {
		setSelectedVehicle(vehicle);
		setIsUpdateDialogOpen(true);
	}, [vehicle]);

	const handleDeleteClick = useCallback(() => {
		setSelectedVehicle(vehicle);
		setIsDeleteDialogOpen(true);
	}, [vehicle]);

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
		</>
	);
}
