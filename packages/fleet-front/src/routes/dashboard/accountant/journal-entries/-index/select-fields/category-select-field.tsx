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

interface CategorySelectFieldProps {
	fieldId: string;
	value: string | null | undefined;
	onChange: (value: string) => void;
	onBlur: () => void;
	className?: string;
}

interface ExpenseCategoryOption {
	id: string;
	name: string;
	color: string;
}

interface ExpenseCategoriesListResponse {
	data: ExpenseCategoryOption[];
}

export function CategorySelectField({
	fieldId,
	value,
	onChange,
	onBlur,
	className,
}: CategorySelectFieldProps) {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [initialized, setInitialized] = useState(false);

	// Fetch initial category by id if value is present
	const { data: initialCategoryData } = useQuery({
		...orpc.accountant.expenseCategories.get.queryOptions({
			input: { id: value as string },
		}),
		enabled: Boolean(value && !initialized),
	});

	const initialCategory = initialCategoryData as
		| ExpenseCategoryOption
		| undefined;

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
		}, 300);

		return () => clearTimeout(timer);
	}, [search]);

	// Initialize search with fetched category name
	useEffect(() => {
		if (initialCategory && !initialized) {
			setSearch(initialCategory.name);
			setInitialized(true);
		}
	}, [initialCategory, initialized]);

	const { data: categoriesDataRaw } = useQuery({
		...orpc.accountant.expenseCategories.list.queryOptions({
			input: {
				offset: 0,
				limit: 20,
				search: debouncedSearch,
			},
		}),
	});

	const categoriesData = categoriesDataRaw as
		| ExpenseCategoriesListResponse
		| undefined;

	const categories = categoriesData?.data || [];

	const handleValueChange = (newValue: string | null) => {
		if (newValue) {
			onChange(newValue);

			const found = categoriesData?.data.find(
				(category) => category.id === newValue,
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
			onInputValueChange={handleInputValueChange}
			filter={null}
			items={categories}
		>
			<ComboboxInput
				id={fieldId}
				onBlur={onBlur}
				placeholder="Select a category"
				showTrigger
				className={className}
			/>
			<ComboboxContent>
				<ComboboxEmpty>No categories found.</ComboboxEmpty>
				<ComboboxList>
					{(category: ExpenseCategoryOption) => (
						<ComboboxItem key={category.id} value={category.id}>
							<div className="flex items-center gap-2">
								<div
									className="h-3 w-3 rounded-full"
									style={{ backgroundColor: `#${category.color}` }}
								/>
								{category.name}
							</div>
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
