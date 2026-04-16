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
import { DeleteCategoryAlertDialog } from "@/routes/dashboard/accountant/expense-categories/-index/categories-data-table/categories-data-table-action-cell/delete-category-alert-dialog";
import { UpdateCategoryDialog } from "@/routes/dashboard/accountant/expense-categories/-index/categories-data-table/categories-data-table-action-cell/update-category-dialog";
import type { ExpenseCategory } from "@/routes/dashboard/accountant/expense-categories/-route/types";

export function CategoriesDataTableActionCell({
	category,
}: {
	category: ExpenseCategory;
}) {
	const [selectedCategory, setSelectedCategory] =
		useState<ExpenseCategory | null>(null);
	const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
	const isAdmin = useIsAdmin();

	const handleEdit = useCallback(() => {
		if (!isAdmin) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedCategory(category);
		setIsUpdateDialogOpen(true);
	}, [category, isAdmin]);

	const handleDeleteClick = useCallback(() => {
		if (!isAdmin) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedCategory(category);
		setIsDeleteDialogOpen(true);
	}, [category, isAdmin]);

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

			<UpdateCategoryDialog
				category={selectedCategory}
				isOpen={isUpdateDialogOpen}
				onOpenChange={setIsUpdateDialogOpen}
			/>

			<DeleteCategoryAlertDialog
				category={selectedCategory}
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
