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
	const { canAccess } = useRowAccess();

	const handleEdit = useCallback(async () => {
		if (!isAdmin && !(await canAccess({ pageName: "Expense Categories", resourceType: "expense_category", resourceId: category.id, action: "edit" }))) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedCategory(category);
		setIsUpdateDialogOpen(true);
	}, [category, isAdmin, canAccess]);

	const handleDeleteClick = useCallback(async () => {
		if (!isAdmin && !(await canAccess({ pageName: "Expense Categories", resourceType: "expense_category", resourceId: category.id, action: "delete" }))) {
			setIsBlockedDialogOpen(true);
			return;
		}
		setSelectedCategory(category);
		setIsDeleteDialogOpen(true);
	}, [category, isAdmin, canAccess]);

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
			<AccessDeniedDialog
				open={isBlockedDialogOpen}
				onOpenChange={setIsBlockedDialogOpen}
				pageName="Expense Categories"
				resourceType="expense_category"
				resourceId={category.id}
				primaryLabel={category.name}
			/>
		</>
	);
}
