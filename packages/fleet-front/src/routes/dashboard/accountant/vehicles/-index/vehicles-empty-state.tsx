import { SearchIcon, TruckIcon } from "lucide-react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { CreateVehicleDialog } from "@/routes/dashboard/accountant/vehicles/-index/create-vehicle-dialog";

interface VehiclesEmptyStateProps {
	search: boolean;
}

export function VehiclesEmptyState({ search }: VehiclesEmptyStateProps) {
	if (search) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchIcon />
					</EmptyMedia>
					<EmptyTitle>No vehicles found</EmptyTitle>
					<EmptyDescription>
						No vehicles match your search. Try a different search term.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<TruckIcon />
				</EmptyMedia>
				<EmptyTitle>No vehicles yet</EmptyTitle>
				<EmptyDescription>
					Get started by adding your first vehicle to your fleet.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<CreateVehicleDialog />
			</EmptyContent>
		</Empty>
	);
}
