import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface DriversSearchInputProps {
	initialValue: string;
}

export function DriversSearchInput({
	initialValue,
}: DriversSearchInputProps) {
	const router = useRouter();
	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

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
			placeholder="Search drivers..."
			value={value}
			onChange={handleChange}
		/>
	);
}
