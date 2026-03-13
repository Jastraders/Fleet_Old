import { SearchIcon, TagsIcon } from "lucide-react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { CreateCategoryDialog } from "./create-category-dialog";

interface CategoriesEmptyStateProps {
	search: boolean;
}

export function CategoriesEmptyState({ search }: CategoriesEmptyStateProps) {
	if (search) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchIcon />
					</EmptyMedia>
					<EmptyTitle>No categories found</EmptyTitle>
					<EmptyDescription>
						No categories match your search. Try a different search term.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<TagsIcon />
				</EmptyMedia>
				<EmptyTitle>No categories yet</EmptyTitle>
				<EmptyDescription>
					Get started by creating your first expense category to organize your
					expenses.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<CreateCategoryDialog />
			</EmptyContent>
		</Empty>
	);
}
