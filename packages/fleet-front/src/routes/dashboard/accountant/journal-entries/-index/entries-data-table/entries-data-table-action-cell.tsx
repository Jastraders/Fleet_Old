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
import { useIsAdmin } from "@/routes/dashboard/accountant/-shared/admin-helpers";
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

import { useRouter } from "@tanstack/react-router";

export function EntriesDataTableActionCell({ entry }: { entry: JournalEntry }) {
	const router = useRouter();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
	const isAdmin = useIsAdmin();

	const handleEdit = useCallback(() => {
		if (!isAdmin) {
			setIsBlockedDialogOpen(true);
			return;
		}
		void router.navigate({
			to: "/dashboard/accountant/journal-entries/$entryId",
			params: { entryId: entry.id },
		});
	}, [entry.id, router, isAdmin]);

	const handleDeleteClick = useCallback(() => {
		if (!isAdmin) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setIsDeleteDialogOpen(true);
	}, [isAdmin]);

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
