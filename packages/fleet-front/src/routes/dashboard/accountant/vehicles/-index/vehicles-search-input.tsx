import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface VehiclesSearchInputProps {
	initialValue: string;
}

export function VehiclesSearchInput({
	initialValue,
}: VehiclesSearchInputProps) {
	const router = useRouter();
	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		const timer = setTimeout(() => {
			void router.navigate({
				to: ".",
				search: (prev) => ({
					...prev,
					search: value || undefined,
					offset: 0,
				}),
			});
		}, 300);

		return () => clearTimeout(timer);
	}, [value, router]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setValue(e.currentTarget.value);
	};

	return (
		<Input
			placeholder="Search vehicles..."
			value={value}
			onChange={handleChange}
		/>
	);
}
