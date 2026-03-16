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
import { DeleteDriverAlertDialog } from "@/routes/dashboard/accountant/drivers/-index/drivers-data-table/drivers-data-table-action-cell/delete-driver-alert-dialog";
import { UpdateDriverDialog } from "@/routes/dashboard/accountant/drivers/-index/drivers-data-table/drivers-data-table-action-cell/update-driver-dialog";
import type { Driver } from "@/routes/dashboard/accountant/drivers/-route/types";

export function DriversDataTableActionCell({
	driver,
}: {
	driver: Driver;
}) {
	const [selectedDriver, setSelectedDriver] =
		useState<Driver | null>(null);
	const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const handleEdit = useCallback(() => {
		setSelectedDriver(driver);
		setIsUpdateDialogOpen(true);
	}, [driver]);

	const handleDeleteClick = useCallback(() => {
		setSelectedDriver(driver);
		setIsDeleteDialogOpen(true);
	}, [driver]);

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

			<UpdateDriverDialog
				driver={selectedDriver}
				isOpen={isUpdateDialogOpen}
				onOpenChange={setIsUpdateDialogOpen}
			/>

			<DeleteDriverAlertDialog
				driver={selectedDriver}
				isOpen={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			/>
		</>
	);
}
