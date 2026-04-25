import { useRouter } from "@tanstack/react-router";
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
import { DeleteEntryAlertDialog } from "@/routes/dashboard/accountant/journal-entries/-index/entries-data-table/entries-data-table-action-cell/delete-entry-alert-dialog";

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

export function EntriesDataTableActionCell({ entry }: { entry: JournalEntry }) {
	const router = useRouter();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
	const isAdmin = useIsAdmin();
	const { canAccess } = useRowAccess();

	const handleEdit = useCallback(async () => {
		if (!isAdmin && !(await canAccess({ pageName: "Journal Entries", resourceType: "journal_entry", resourceId: entry.id, action: "edit" }))) {
			setIsBlockedDialogOpen(true);
			return;
		}
		void router.navigate({
			to: "/dashboard/accountant/journal-entries/$entryId",
			params: { entryId: entry.id },
		});
	}, [entry.id, router, isAdmin, canAccess]);

	const handleDeleteClick = useCallback(async () => {
		if (!isAdmin && !(await canAccess({ pageName: "Journal Entries", resourceType: "journal_entry", resourceId: entry.id, action: "delete" }))) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setIsDeleteDialogOpen(true);
	}, [isAdmin, canAccess, entry.id]);

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

			<DeleteEntryAlertDialog
				entry={entry}
				isOpen={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			/>
			<AccessDeniedDialog
				open={isBlockedDialogOpen}
				onOpenChange={setIsBlockedDialogOpen}
				pageName="Journal Entries"
				resourceType="journal_entry"
				resourceId={entry.id}
				primaryLabel={entry.id}
			/>
		</>
	);
}
