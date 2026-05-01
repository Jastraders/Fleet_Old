export const parseDateValue = (value: Date | string | null | undefined): Date | null => {
	if (!value) {
		return null;
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	// Normalize common ISO variants:
	let s = value;
	// spaces -> T
	s = s.includes(" ") ? s.replace(" ", "T") : s;
	// trim microseconds to milliseconds (keep 3 digits)
	s = s.replace(/(\.\d{3})\d+/, '$1');
	// replace bare +00 or +0000 with Z or +00:00
	s = s.replace(/Z$/, '+00:00');
	if (/([+-]\d{2})$/.test(s) && !/([+-]\d{2}:\d{2})$/.test(s)) {
		s = s + ':00';
	}
	// convert +0000 -> +00:00
	s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
	// if timezone is exactly +00:00 convert to Z for consistency
	s = s.replace(/\+00:00$/, 'Z');
	const date = new Date(s);
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
