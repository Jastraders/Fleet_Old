import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface MembersSearchInputProps {
	initialValue: string;
}

export function MembersSearchInput({ initialValue }: MembersSearchInputProps) {
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
			placeholder="Search members..."
			value={value}
			onChange={handleChange}
		/>
	);
}
