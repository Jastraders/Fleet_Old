import { useRouter } from "@tanstack/react-router";
import { FileTextIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

export function EntriesEmptyState() {
	const router = useRouter();

	const handleNavigateToNew = () => {
		void router.navigate({
			to: "/dashboard/accountant/journal-entries/new",
		});
	};

	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FileTextIcon />
				</EmptyMedia>
				<EmptyTitle>No journal entries yet</EmptyTitle>
				<EmptyDescription>
					Get started by creating your first journal entry to track
					transactions.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button onClick={handleNavigateToNew}>
					<PlusIcon className="h-4 w-4" />
					New Entry
				</Button>
			</EmptyContent>
		</Empty>
	);
}
