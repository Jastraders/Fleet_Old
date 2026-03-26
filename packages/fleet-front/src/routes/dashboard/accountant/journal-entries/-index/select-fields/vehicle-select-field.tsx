import type { ComboboxRoot } from "@base-ui/react";
import { useQuery } from "@tanstack/react-query";
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

interface VehicleOption {
	id: string;
	name: string;
	licensePlate?: string | null;
}

interface VehiclesListResponse {
	data: VehicleOption[];
}

export function VehicleSelectField({
	fieldId,
	value,
	onChange,
	onBlur,
	className,
}: VehicleSelectFieldProps) {
	const [search, setSearch] = useState("");
	const [initialized, setInitialized] = useState(false);

	// Fetch initial vehicle by id if value is present
	const { data: initialVehicleData } = useQuery({
		...orpc.accountant.vehicles.get.queryOptions({
			input: { id: value as string },
		}),
		enabled: Boolean(value && !initialized),
	});

	const initialVehicle = initialVehicleData as VehicleOption | undefined;

	// Initialize search with fetched vehicle name
	useEffect(() => {
		if (initialVehicle && !initialized) {
			setSearch(initialVehicle.name);
			setInitialized(true);
		}
	}, [initialVehicle, initialized]);

	const { data: vehiclesDataRaw } = useQuery({
		...orpc.accountant.vehicles.list.queryOptions({
			input: {
				offset: 0,
				limit: 100,
				search: undefined,
			},
		}),
	});

	const vehiclesData = vehiclesDataRaw as VehiclesListResponse | undefined;
	const normalizedSearch = search.trim().toLowerCase();
	const vehicles =
		vehiclesData?.data.filter((vehicle) =>
			normalizedSearch
				? vehicle.name.toLowerCase().includes(normalizedSearch)
				: true,
		) || [];

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
					{(vehicle: VehicleOption) => (
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
