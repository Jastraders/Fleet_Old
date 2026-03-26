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

interface DriverSelectFieldProps {
	fieldId: string;
	value: string | null | undefined;
	onChange: (value: string) => void;
	onBlur: () => void;
	className?: string;
}

interface DriverOption {
	id: string;
	name: string;
	phoneNumber?: string | null;
}

interface DriversListResponse {
	data: DriverOption[];
}

export function DriverSelectField({
	fieldId,
	value,
	onChange,
	onBlur,
	className,
}: DriverSelectFieldProps) {
	const [search, setSearch] = useState("");
	const [initialized, setInitialized] = useState(false);

	const { data: initialDriverData } = useQuery({
		...orpc.accountant.drivers.get.queryOptions({
			input: { id: value as string },
		}),
		enabled: Boolean(value && !initialized),
	});

	const initialDriver = initialDriverData as DriverOption | undefined;

	useEffect(() => {
		if (initialDriver && !initialized) {
			setSearch(initialDriver.name);
			setInitialized(true);
		}
	}, [initialDriver, initialized]);

	const { data: driversDataRaw } = useQuery({
		...orpc.accountant.drivers.list.queryOptions({
			input: {
				offset: 0,
				limit: 100,
				search: undefined,
			},
		}),
	});

	const driversData = driversDataRaw as DriversListResponse | undefined;
	const normalizedSearch = search.trim().toLowerCase();
	const drivers =
		driversData?.data.filter((driver) =>
			normalizedSearch
				? driver.name.toLowerCase().includes(normalizedSearch)
				: true,
		) || [];

	const handleValueChange = (newValue: string | null) => {
		if (newValue) {
			onChange(newValue);

			const found = driversData?.data.find((driver) => driver.id === newValue);
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
			items={drivers}
			onInputValueChange={handleInputValueChange}
			filter={null}
		>
			<ComboboxInput
				id={fieldId}
				onBlur={onBlur}
				placeholder="Select a driver"
				showTrigger
				className={className}
			/>
			<ComboboxContent>
				<ComboboxEmpty>No drivers found.</ComboboxEmpty>
				<ComboboxList>
					{(driver: DriverOption) => (
						<ComboboxItem key={driver.id} value={driver.id}>
							<div className="flex flex-col">
								<span>{driver.name}</span>
								<span className="text-xs text-muted-foreground">
									{driver.phoneNumber}
								</span>
							</div>
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
