import { useQuery } from "@tanstack/react-query";
import {
	CheckIcon,
	ChevronDownIcon,
	PhoneIcon,
	SearchIcon,
	UserIcon,
	UserXIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { orpc } from "@/orpc";

export interface BataSearchAutocompleteProps {
	initialSearch?: string;
	initialDriverId?: string;
	onSearchChange: (search: string | undefined, driverId: string | undefined) => void;
	placeholder?: string;
	className?: string;
}

interface DriverOption {
	id: string;
	name: string;
	phoneNumber?: string | null;
}

export function BataSearchAutocomplete({
	initialSearch = "",
	initialDriverId,
	onSearchChange,
	placeholder = "Search driver, vehicle, product...",
	className,
}: BataSearchAutocompleteProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

	const [inputValue, setInputValue] = useState(initialSearch);
	const [selectedDriverId, setSelectedDriverId] = useState<string | undefined>(initialDriverId);
	const [isOpen, setIsOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);

	// Sync with external URL search changes (e.g. back/forward navigation or tab changes)
	useEffect(() => {
		setInputValue(initialSearch || "");
		setSelectedDriverId(initialDriverId);
	}, [initialSearch, initialDriverId]);

	// Fetch available drivers from API
	const { data: driversDataRaw, isLoading: isLoadingDrivers } = useQuery({
		...orpc.accountant.drivers.list.queryOptions({
			input: {
				offset: 0,
				limit: 500,
				search: undefined,
			},
		}),
	});

	const drivers: DriverOption[] = useMemo(() => {
		const raw = driversDataRaw as { data?: DriverOption[] } | undefined;
		const list = raw?.data || [];
		return [...list].sort((a, b) => a.name.localeCompare(b.name));
	}, [driversDataRaw]);

	// Filter suggestions dynamically with every keystroke
	const suggestions = useMemo(() => {
		const query = inputValue.trim().toLowerCase();
		if (!query) {
			return drivers;
		}
		return drivers.filter((driver) => {
			const nameMatch = driver.name.toLowerCase().includes(query);
			const phoneMatch = driver.phoneNumber ? driver.phoneNumber.toLowerCase().includes(query) : false;
			return nameMatch || phoneMatch;
		});
	}, [drivers, inputValue]);

	// Scroll highlighted suggestion into view
	useEffect(() => {
		if (highlightedIndex >= 0 && listRef.current) {
			const items = listRef.current.querySelectorAll<HTMLDivElement>("[data-item-index]");
			const activeItem = items[highlightedIndex];
			if (activeItem) {
				activeItem.scrollIntoView({ block: "nearest" });
			}
		}
	}, [highlightedIndex]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent | TouchEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

	// Clear debounce timer on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	// Trigger search updates
	const triggerSearch = (search: string | undefined, driverId: string | undefined, debounceMs = 200) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}

		if (debounceMs <= 0) {
			onSearchChange(search, driverId);
			return;
		}

		debounceTimerRef.current = setTimeout(() => {
			onSearchChange(search, driverId);
		}, debounceMs);
	};

	// Handle input text changes
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const nextValue = e.target.value;
		setInputValue(nextValue);
		setSelectedDriverId(undefined); // user is modifying text, clear driverId filter
		setHighlightedIndex(-1);
		if (!isOpen) setIsOpen(true);

		if (!nextValue.trim()) {
			// Immediate restore when empty
			triggerSearch(undefined, undefined, 0);
		} else {
			// Debounced live filter
			triggerSearch(nextValue.trim(), undefined, 200);
		}
	};

	// Handle driver selection from dropdown
	const handleSelectDriver = (driver: DriverOption) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		setInputValue(driver.name);
		setSelectedDriverId(driver.id);
		setIsOpen(false);
		setHighlightedIndex(-1);
		onSearchChange(driver.name, driver.id);
	};

	// Handle clearing input
	const handleClear = () => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		setInputValue("");
		setSelectedDriverId(undefined);
		setHighlightedIndex(-1);
		onSearchChange(undefined, undefined);
		inputRef.current?.focus();
	};

	// Keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (!isOpen) {
				setIsOpen(true);
				setHighlightedIndex(0);
				return;
			}
			if (suggestions.length > 0) {
				setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
			}
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (!isOpen) {
				setIsOpen(true);
				setHighlightedIndex(suggestions.length - 1);
				return;
			}
			if (suggestions.length > 0) {
				setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
			}
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (isOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
				handleSelectDriver(suggestions[highlightedIndex]);
			} else {
				// Flush current text search immediately without debounce
				if (debounceTimerRef.current) {
					clearTimeout(debounceTimerRef.current);
					debounceTimerRef.current = null;
				}
				setIsOpen(false);
				const query = inputValue.trim();
				onSearchChange(query || undefined, selectedDriverId);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			setIsOpen(false);
			setHighlightedIndex(-1);
		}
	};

	const handleFocus = () => {
		setIsOpen(true);
		setHighlightedIndex(-1);
	};

	return (
		<div ref={containerRef} className={cn("relative w-full md:w-80", className)}>
			<div className="relative flex items-center">
				<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
				<input
					ref={inputRef}
					type="text"
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					onFocus={handleFocus}
					onClick={() => {
						if (!isOpen) setIsOpen(true);
					}}
					placeholder={placeholder}
					className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-14 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
					role="combobox"
					aria-expanded={isOpen}
					aria-autocomplete="list"
					autoComplete="off"
					spellCheck="false"
				/>

				<div className="absolute right-2 flex items-center gap-1">
					{inputValue && (
						<button
							type="button"
							onClick={handleClear}
							aria-label="Clear search"
							className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						>
							<XIcon className="h-3.5 w-3.5" />
						</button>
					)}
					<button
						type="button"
						tabIndex={-1}
						onClick={() => setIsOpen((prev) => !prev)}
						className="p-1 text-muted-foreground hover:text-foreground transition-colors"
					>
						<ChevronDownIcon className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
					</button>
				</div>
			</div>

			{/* Dropdown Suggestions Menu */}
			{isOpen && (
				<div
					ref={listRef}
					className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 max-h-72 overflow-y-auto"
					role="listbox"
				>
					{isLoadingDrivers ? (
						<div className="p-4 text-center text-xs text-muted-foreground">Loading drivers...</div>
					) : suggestions.length > 0 ? (
						<div className="p-1 space-y-0.5">
							<div className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
								Drivers ({suggestions.length})
							</div>
							{suggestions.map((driver, index) => {
								const isHighlighted = highlightedIndex === index;
								const isSelected = selectedDriverId === driver.id;

								return (
									<div
										key={driver.id}
										data-item-index={index}
										role="option"
										aria-selected={isSelected}
										onClick={() => handleSelectDriver(driver)}
										onMouseEnter={() => setHighlightedIndex(index)}
										className={cn(
											"flex items-center justify-between gap-3 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors select-none",
											isHighlighted
												? "bg-accent text-accent-foreground"
												: "hover:bg-accent/60 text-foreground",
											isSelected && "font-medium bg-primary/10 text-primary hover:bg-primary/15",
										)}
									>
										<div className="flex items-center gap-2.5 min-w-0">
											<div
												className={cn(
													"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
													isSelected
														? "bg-primary text-primary-foreground"
														: "bg-primary/10 text-primary",
												)}
											>
												{driver.name ? driver.name.charAt(0).toUpperCase() : <UserIcon className="h-3.5 w-3.5" />}
											</div>
											<div className="truncate">
												<div className="truncate text-sm font-medium leading-none">{driver.name}</div>
												{driver.phoneNumber ? (
													<div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
														<PhoneIcon className="h-2.5 w-2.5 shrink-0 opacity-70" />
														<span>{driver.phoneNumber}</span>
													</div>
												) : null}
											</div>
										</div>

										{isSelected && (
											<CheckIcon className="h-4 w-4 shrink-0 text-primary ml-auto" />
										)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="py-6 px-4 text-center">
							<UserXIcon className="mx-auto h-6 w-6 text-muted-foreground/60 mb-1.5" />
							<p className="text-sm font-medium text-foreground">No matching results</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								Press <span className="font-semibold text-foreground">Enter</span> to search vehicles or products for "{inputValue}"
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
