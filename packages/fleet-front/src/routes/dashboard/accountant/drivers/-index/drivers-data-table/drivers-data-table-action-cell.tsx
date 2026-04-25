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
import { AccessDeniedDialog, useIsAdmin, useRowAccess } from "@/routes/dashboard/accountant/-shared/admin-helpers";
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
	const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
	const isAdmin = useIsAdmin();
	const { canAccess } = useRowAccess();

	const handleEdit = useCallback(async () => {
		if (!isAdmin && !(await canAccess({ pageName: "Drivers", resourceType: "driver", resourceId: driver.id, action: "edit" }))) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedDriver(driver);
		setIsUpdateDialogOpen(true);
	}, [driver, isAdmin, canAccess]);

	const handleDeleteClick = useCallback(async () => {
		if (!isAdmin && !(await canAccess({ pageName: "Drivers", resourceType: "driver", resourceId: driver.id, action: "delete" }))) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedDriver(driver);
		setIsDeleteDialogOpen(true);
	}, [driver, isAdmin, canAccess]);

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
			<AccessDeniedDialog
				open={isBlockedDialogOpen}
				onOpenChange={setIsBlockedDialogOpen}
				pageName="Drivers"
				resourceType="driver"
				resourceId={driver.id}
				primaryLabel={driver.name}
			/>
		</>
	);
}
