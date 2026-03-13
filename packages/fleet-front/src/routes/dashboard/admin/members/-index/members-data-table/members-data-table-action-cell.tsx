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
import { DeleteMemberAlertDialog } from "@/routes/dashboard/admin/members/-index/members-data-table/members-data-table-action-cell/delete-member-alert-dialog";
import { UpdateMemberDialog } from "@/routes/dashboard/admin/members/-index/members-data-table/members-data-table-action-cell/update-member-dialog";
import type { Member } from "@/routes/dashboard/admin/members/-route/types";

export function MembersDataTableActionCell({ member }: { member: Member }) {
	const [selectedMember, setSelectedMember] = useState<Member | null>(null);
	const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const handleEdit = useCallback(() => {
		setSelectedMember(member);
		setIsUpdateDialogOpen(true);
	}, [member]);

	const handleDeleteClick = useCallback(() => {
		setSelectedMember(member);
		setIsDeleteDialogOpen(true);
	}, [member]);

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

			<UpdateMemberDialog
				member={selectedMember}
				isOpen={isUpdateDialogOpen}
				onOpenChange={setIsUpdateDialogOpen}
			/>

			<DeleteMemberAlertDialog
				member={selectedMember}
				isOpen={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			/>
		</>
	);
}
