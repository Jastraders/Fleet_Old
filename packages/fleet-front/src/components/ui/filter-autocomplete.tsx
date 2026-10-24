import { CheckIcon, ChevronDownIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface FilterOption {
	id?: string;
	label: string;
	sublabel?: string;
	value?: string;
}

export interface FilterAutocompleteProps {
	value?: string;
	selectedId?: string;
	onSelect: (option: FilterOption | null) => void;
	onSearchChange?: (text: string) => void;
	placeholder?: string;
	icon?: React.ReactNode;
	options: FilterOption[];
	isLoading?: boolean;
	className?: string;
	ariaLabel?: string;
}

export function FilterAutocomplete({
	value = "",
	selectedId,
	onSelect,
	onSearchChange,
	placeholder = "Search...",
	icon,
	options,
	isLoading = false,
	className,
	ariaLabel,
}: FilterAutocompleteProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

	const [inputValue, setInputValue] = useState(value);
	const [isOpen, setIsOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);

	// Sync with external value changes
	useEffect(() => {
		setInputValue(value || "");
	}, [value]);

	// Filter and sort suggestions dynamically
	const filteredOptions = useMemo(() => {
		const query = inputValue.trim().toLowerCase();
		if (!query) {
			// When empty, show all options sorted alphabetically by label
			return [...options].sort((a, b) =>
				a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
			);
		}

		// Filter matching options
		const matches = options.filter((opt) => {
			const labelMatch = opt.label.toLowerCase().includes(query);
			const sublabelMatch = opt.sublabel
				? opt.sublabel.toLowerCase().includes(query)
				: false;
			return labelMatch || sublabelMatch;
		});

		// Sort matching options:
		// 1. Starts with query in label
		// 2. Starts with query in sublabel
		// 3. Contains query in label
		// 4. Contains query in sublabel
		// 5. Alphabetical tie-breaking
		return matches.sort((a, b) => {
			const aLabel = a.label.toLowerCase();
			const bLabel = b.label.toLowerCase();
			const aStarts = aLabel.startsWith(query);
			const bStarts = bLabel.startsWith(query);

			if (aStarts && !bStarts) return -1;
			if (!aStarts && bStarts) return 1;

			const aSubStarts = a.sublabel
				? a.sublabel.toLowerCase().startsWith(query)
				: false;
			const bSubStarts = b.sublabel
				? b.sublabel.toLowerCase().startsWith(query)
				: false;

			if (aSubStarts && !bSubStarts) return -1;
			if (!aSubStarts && bSubStarts) return 1;

			return aLabel.localeCompare(bLabel, undefined, { sensitivity: "base" });
		});
	}, [options, inputValue]);

	// Scroll highlighted option into view
	useEffect(() => {
		if (highlightedIndex >= 0 && listRef.current) {
			const items =
				listRef.current.querySelectorAll<HTMLDivElement>("[data-filter-item]");
			const activeItem = items[highlightedIndex];
			if (activeItem) {
				activeItem.scrollIntoView({ block: "nearest" });
			}
		}
	}, [highlightedIndex]);

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent | TouchEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
				setHighlightedIndex(-1);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("touchstart", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("touchstart", handleClickOutside);
		};
	}, []);

	// Clear debounce on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	const triggerSearch = (text: string) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		if (!text.trim()) {
			onSelect(null);
			return;
		}

		debounceTimerRef.current = setTimeout(() => {
			if (onSearchChange) {
				onSearchChange(text.trim());
			} else {
				onSelect({ label: text.trim(), value: text.trim() });
			}
		}, 250);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const next = e.target.value;
		setInputValue(next);
		setHighlightedIndex(-1);
		if (!isOpen) setIsOpen(true);
		triggerSearch(next);
	};

	const handleSelectOption = (opt: FilterOption) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		setInputValue(opt.label);
		setIsOpen(false);
		setHighlightedIndex(-1);
		onSelect(opt);
	};

	const handleClear = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		setInputValue("");
		setIsOpen(false);
		setHighlightedIndex(-1);
		onSelect(null);
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
			setIsOpen(true);
			e.preventDefault();
			return;
		}

		if (!isOpen) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setHighlightedIndex((prev) =>
					prev < filteredOptions.length - 1 ? prev + 1 : 0,
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setHighlightedIndex((prev) =>
					prev > 0 ? prev - 1 : filteredOptions.length - 1,
				);
				break;
			case "Enter":
				e.preventDefault();
				if (
					highlightedIndex >= 0 &&
					highlightedIndex < filteredOptions.length
				) {
					handleSelectOption(filteredOptions[highlightedIndex]);
				} else if (inputValue.trim()) {
					if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
					setIsOpen(false);
					if (onSearchChange) {
						onSearchChange(inputValue.trim());
					} else {
						onSelect({ label: inputValue.trim(), value: inputValue.trim() });
					}
				}
				break;
			case "Escape":
				e.preventDefault();
				setIsOpen(false);
				setHighlightedIndex(-1);
				break;
		}
	};

	const renderHighlightedText = (text: string, query: string) => {
		if (!query.trim()) return text;
		const trimmed = query.trim();
		const regex = new RegExp(
			`(${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
			"gi",
		);
		const parts = text.split(regex);

		return parts.map((part, i) =>
			part.toLowerCase() === trimmed.toLowerCase() ? (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: string segment token
					key={`${part}-${i}`}
					className="font-semibold text-primary underline underline-offset-2"
				>
					{part}
				</span>
			) : (
				// biome-ignore lint/suspicious/noArrayIndexKey: string segment token
				<span key={`${part}-${i}`}>{part}</span>
			),
		);
	};

	return (
		<div
			ref={containerRef}
			className={cn("relative w-full sm:w-64", className)}
		>
			<div
				className={cn(
					"relative flex items-center h-9 w-full rounded-md border border-input bg-background text-xs shadow-xs transition-colors",
					"focus-within:ring-1 focus-within:ring-ring focus-within:border-ring",
					isOpen && "border-ring ring-1 ring-ring",
				)}
			>
				{icon && (
					<div className="absolute left-2.5 flex items-center pointer-events-none">
						{icon}
					</div>
				)}
				<input
					ref={inputRef}
					type="text"
					aria-label={ariaLabel || placeholder}
					value={inputValue}
					onChange={handleInputChange}
					onFocus={() => setIsOpen(true)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className={cn(
						"h-full w-full bg-transparent px-3 py-1 pr-14 text-xs outline-none placeholder:text-muted-foreground",
						icon ? "pl-8" : "pl-3",
					)}
				/>
				<div className="absolute right-2 flex items-center gap-1">
					{isLoading && (
						<Loader2Icon className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
					)}
					{inputValue && !isLoading && (
						<button
							type="button"
							onClick={handleClear}
							title="Clear filter"
							className="rounded-xs p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
						>
							<XIcon className="h-3.5 w-3.5" />
						</button>
					)}
					<button
						type="button"
						tabIndex={-1}
						onClick={() => setIsOpen((prev) => !prev)}
						className="text-muted-foreground hover:text-foreground"
					>
						<ChevronDownIcon
							className={cn(
								"h-3.5 w-3.5 transition-transform duration-200",
								isOpen && "rotate-180",
							)}
						/>
					</button>
				</div>
			</div>

			{/* Dropdown Options */}
			{isOpen && (
				<div
					ref={listRef}
					className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
				>
					{filteredOptions.length === 0 ? (
						<div className="py-3 px-3 text-center text-xs text-muted-foreground">
							{isLoading ? "Loading options..." : "No matching options"}
						</div>
					) : (
						filteredOptions.map((opt, index) => {
							const isSelected = selectedId
								? opt.id === selectedId
								: opt.label.toLowerCase() === inputValue.trim().toLowerCase();
							const isHighlighted = index === highlightedIndex;

							return (
								<div
									key={opt.id || `${opt.label}-${index}`}
									data-filter-item
									data-index={index}
									role="option"
									aria-selected={isSelected}
									tabIndex={-1}
									onClick={() => handleSelectOption(opt)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											handleSelectOption(opt);
										}
									}}
									onMouseEnter={() => setHighlightedIndex(index)}
									className={cn(
										"flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs rounded-xs cursor-pointer select-none transition-colors",
										isHighlighted
											? "bg-accent text-accent-foreground"
											: "hover:bg-accent/60",
										isSelected && "bg-primary/10 font-medium text-primary",
									)}
								>
									<div className="flex flex-col min-w-0">
										<span className="truncate">
											{renderHighlightedText(opt.label, inputValue)}
										</span>
										{opt.sublabel && (
											<span className="text-[10px] text-muted-foreground truncate">
												{renderHighlightedText(opt.sublabel, inputValue)}
											</span>
										)}
									</div>
									{isSelected && (
										<CheckIcon className="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />
									)}
								</div>
							);
						})
					)}
				</div>
			)}
		</div>
	);
}
