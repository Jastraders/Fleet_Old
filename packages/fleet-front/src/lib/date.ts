export const parseDateValue = (value: Date | string | null | undefined): Date | null => {
	if (!value) {
		return null;
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
	const date = new Date(normalized);
	return Number.isNaN(date.getTime()) ? null : date;
};

export const formatShortDate = (value: Date | string | null | undefined): string => {
	const date = parseDateValue(value);
	if (!date) {
		return "-";
	}

	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
};
