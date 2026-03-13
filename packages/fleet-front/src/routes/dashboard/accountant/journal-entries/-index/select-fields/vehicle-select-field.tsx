import type { ComboboxRoot } from "@base-ui/react";
import { useQuery } from "@tanstack/react-query";
import type { Vehicle } from "node_modules/fleet-back/src/db/schema";
import { useEffect, useState } from "react";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/orpc";

interface VehicleSelectFieldProps {
	fieldId: string;
	value: string | null | undefined;
	onChange: (value: string) => void;
	onBlur: () => void;
	className?: string;
}

export function VehicleSelectField({
	fieldId,
	value,
	onChange,
	onBlur,
	className,
}: VehicleSelectFieldProps) {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [initialized, setInitialized] = useState(false);

	// Fetch initial vehicle by id if value is present
	const { data: initialVehicle } = useQuery({
		...orpc.accountant.vehicles.get.queryOptions({
			input: { id: value as string },
		}),
		enabled: Boolean(value && !initialized),
	});

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
		}, 300);

		return () => clearTimeout(timer);
	}, [search]);

	// Initialize search with fetched vehicle name
	useEffect(() => {
		if (initialVehicle && !initialized) {
			setSearch(initialVehicle.name);
			setInitialized(true);
		}
	}, [initialVehicle, initialized]);

	const { data: vehiclesData } = useQuery({
		...orpc.accountant.vehicles.list.queryOptions({
			input: {
				offset: 0,
				limit: 20,
				search: debouncedSearch,
			},
		}),
	});

	const vehicles = vehiclesData?.data || [];

	const handleValueChange = (newValue: string | null) => {
		if (newValue) {
			onChange(newValue);

			const found = vehiclesData?.data.find(
				(vehicle) => vehicle.id === newValue,
			);

			if (found) {
				setSearch(found.name);
			}
		}
	};

	const handleInputValueChange = (
		inputValue: string,
		eventDetails: ComboboxRoot.ChangeEventDetails,
	) => {
		if (
			eventDetails.reason === "input-change" ||
			eventDetails.reason === "input-clear" ||
			eventDetails.reason === "clear-press"
		) {
			setSearch(inputValue);
		}
	};

	if (value && !initialized) {
		return (
			<Skeleton className={cn("h-10 w-full rounded-md bg-muted", className)} />
		);
	}

	return (
		<Combobox
			value={value || ""}
			onValueChange={handleValueChange}
			inputValue={search}
			items={vehicles}
			onInputValueChange={handleInputValueChange}
			filter={null}
		>
			<ComboboxInput
				id={fieldId}
				onBlur={onBlur}
				placeholder="Select a vehicle"
				showTrigger
				className={className}
			/>
			<ComboboxContent>
				<ComboboxEmpty>No vehicles found.</ComboboxEmpty>
				<ComboboxList>
					{(vehicle: Vehicle) => (
						<ComboboxItem key={vehicle.id} value={vehicle.id}>
							<div className="flex flex-col">
								<span>{vehicle.name}</span>
								<span className="text-xs text-muted-foreground">
									{vehicle.licensePlate}
								</span>
							</div>
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
