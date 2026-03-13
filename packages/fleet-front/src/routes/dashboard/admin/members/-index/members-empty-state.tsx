import { SearchIcon, UsersIcon } from "lucide-react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { CreateMemberDialog } from "./create-member-dialog";

interface MembersEmptyStateProps {
	search: boolean;
}

export function MembersEmptyState({ search }: MembersEmptyStateProps) {
	if (search) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchIcon />
					</EmptyMedia>
					<EmptyTitle>No members found</EmptyTitle>
					<EmptyDescription>
						No members match your search. Try a different search term.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<UsersIcon />
				</EmptyMedia>
				<EmptyTitle>No members yet</EmptyTitle>
				<EmptyDescription>
					Get started by adding your first member to collaborate on your fleet.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<CreateMemberDialog />
			</EmptyContent>
		</Empty>
	);
}
