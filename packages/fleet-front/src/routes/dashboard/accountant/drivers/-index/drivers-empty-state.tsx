import { SearchIcon, TagsIcon } from "lucide-react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { CreateDriverDialog } from "./create-driver-dialog";

interface DriversEmptyStateProps {
	search: boolean;
}

export function DriversEmptyState({ search }: DriversEmptyStateProps) {
	if (search) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchIcon />
					</EmptyMedia>
					<EmptyTitle>No drivers found</EmptyTitle>
					<EmptyDescription>
						No drivers match your search. Try a different search term.
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
				<EmptyTitle>No drivers yet</EmptyTitle>
				<EmptyDescription>
					Get started by creating your first driver to organize your
					expenses.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<CreateDriverDialog />
			</EmptyContent>
		</Empty>
	);
}
