/**
 * Statement Export Utility
 * Provides bank-statement formatted PDF and Excel exports for Fleet modules.
 * Pure TypeScript — no external runtime dependencies required.
 */

export interface ExportColumn {
	header: string;
	key: string;
	width?: number; // relative width or pt width
	align?: "left" | "right" | "center";
}

export interface StatementExportOptions {
	filename: string;
	title: string;
	subtitle?: string;
	themeColor?: { r: number; g: number; b: number }; // RGB floats 0..1 (default: Blue 0.15, 0.39, 0.92)
	metadata: Record<string, string>;
	columns: ExportColumn[];
	rows: Array<Record<string, any>>;
	grandTotalRow?: Record<string, any>;
}

/**
 * Download Excel-compatible CSV file with UTF-8 BOM and metadata header.
 */
export function exportStatementToExcel(options: StatementExportOptions): void {
	const lines: string[] = [];

	// Title & Metadata Header
	lines.push(`"${options.title.replaceAll('"', '""')}"`);
	if (options.subtitle) {
		lines.push(`"${options.subtitle.replaceAll('"', '""')}"`);
	}
	for (const [key, val] of Object.entries(options.metadata)) {
		if (val) {
			lines.push(`"${key.replaceAll('"', '""')}","${val.replaceAll('"', '""')}"`);
		}
	}
	lines.push(""); // blank separator

	// Column Headers
	const headers = options.columns.map((c) => `"${c.header.replaceAll('"', '""')}"`);
	lines.push(headers.join(","));

	// Data Rows
	for (const row of options.rows) {
		const rowValues = options.columns.map((c) => {
			const val = row[c.key];
			if (val === null || val === undefined) return '""';
			const str = String(val).replaceAll('"', '""');
			return `"${str}"`;
		});
		lines.push(rowValues.join(","));
	}

	// Grand Total Row
	if (options.grandTotalRow) {
		lines.push(""); // blank separator
		const totalValues = options.columns.map((c) => {
			const val = options.grandTotalRow![c.key];
			if (val === null || val === undefined) return '""';
			const str = String(val).replaceAll('"', '""');
			return `"${str}"`;
		});
		lines.push(totalValues.join(","));
	}

	const csvContent = lines.join("\r\n");
	const blob = new Blob([`\uFEFF${csvContent}`], {
		type: "text/csv;charset=utf-8;",
	});

	const filename = options.filename.endsWith(".csv") ? options.filename : `${options.filename}.csv`;
	triggerDownload(blob, filename);
}

/**
 * Trigger browser file download
 */
function triggerDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Escape text for PDF string literals: () and \
 */
function escapePdfText(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/\(/g, "\\(")
		.replace(/\)/g, "\\)")
		.replace(/[^\x20-\x7E]/g, "?"); // Keep ASCII for Type 1 Helvetica
}

/**
 * Generates a bank-statement styled PDF 1.4 document in landscape A4.
 */
export function exportStatementToPdf(options: StatementExportOptions): void {
	// Landscape A4 dimensions in points (72 pt/inch)
	const pageWidth = 842;
	const pageHeight = 595;
	const marginX = 36;
	const marginTop = 36;
	const marginBottom = 36;
	const usableWidth = pageWidth - marginX * 2; // 770 pt

	const theme = options.themeColor || { r: 0.145, g: 0.388, b: 0.921 }; // #2563EB default blue

	// Calculate column widths proportional to requested or auto-fit
	const totalSpecifiedWidth = options.columns.reduce((sum, c) => sum + (c.width || 75), 0);
	const colWidths = options.columns.map((c) => Math.floor(((c.width || 75) / totalSpecifiedWidth) * usableWidth));
	// Adjust last column to fill exactly usableWidth
	const allocated = colWidths.reduce((a, b) => a + b, 0);
	colWidths[colWidths.length - 1] += usableWidth - allocated;

	const rowHeight = 19;
	const headerHeight = 22;

	// Calculate how many rows fit per page
	// First page has title block (~95 pt) + table header (22 pt)
	const firstPageMaxRows = Math.floor((pageHeight - marginTop - marginBottom - 120) / rowHeight);
	// Subsequent pages have mini title block (~35 pt) + table header (22 pt)
	const subsequentPageMaxRows = Math.floor((pageHeight - marginTop - marginBottom - 65) / rowHeight);

	// Split rows across pages
	const pagesRows: Array<Array<Record<string, any>>> = [];
	let remainingRows = [...options.rows];

	if (remainingRows.length === 0) {
		pagesRows.push([]);
	} else {
		// First page
		const p1Count = Math.min(remainingRows.length, firstPageMaxRows);
		pagesRows.push(remainingRows.slice(0, p1Count));
		remainingRows = remainingRows.slice(p1Count);

		// Subsequent pages
		while (remainingRows.length > 0) {
			const count = Math.min(remainingRows.length, subsequentPageMaxRows);
			pagesRows.push(remainingRows.slice(0, count));
			remainingRows = remainingRows.slice(count);
		}
	}

	const totalPages = pagesRows.length;

	// Prepare PDF objects
	// Object 1: Catalog
	// Object 2: Pages
	// Object 3: Font Helvetica-Bold
	// Object 4: Font Helvetica
	// For each page: Page object + Content stream object
	const pdfObjects: string[] = [];

	pdfObjects[1] = "<< /Type /Catalog /Pages 2 0 R >>";

	let currentObjIndex = 5; // 1: Catalog, 2: Pages, 3: F1 (Bold), 4: F2 (Normal)
	const pageObjRefs: string[] = [];

	pagesRows.forEach((pageRows, pageIdx) => {
		const isFirstPage = pageIdx === 0;
		const isLastPage = pageIdx === totalPages - 1;
		const pageNumber = pageIdx + 1;

		let stream = "";

		// Top Theme Accent Bar
		stream += `${theme.r} ${theme.g} ${theme.b} rg\n`;
		stream += `${marginX} ${pageHeight - 12} ${usableWidth} 4 re f\n`;

		let y = pageHeight - marginTop;

		if (isFirstPage) {
			// Title & Company Header
			stream += "BT\n";
			stream += "/F1 16 Tf\n";
			stream += "0.09 0.11 0.15 rg\n";
			stream += `${marginX} ${y - 14} Td\n`;
			stream += `(${escapePdfText(options.title)}) Tj\n`;
			stream += "ET\n";

			if (options.subtitle) {
				stream += "BT\n";
				stream += "/F2 9 Tf\n";
				stream += "0.4 0.45 0.5 rg\n";
				stream += `${marginX} ${y - 28} Td\n`;
				stream += `(${escapePdfText(options.subtitle)}) Tj\n`;
				stream += "ET\n";
			}

			// Metadata Box
			const metaItems = Object.entries(options.metadata).filter(([_, v]) => Boolean(v));
			const metaY = y - 48;

			stream += "0.95 0.96 0.98 rg\n";
			stream += `${marginX} ${metaY - 6} ${usableWidth} 20 re f\n`;
			stream += "0.88 0.90 0.93 RG\n";
			stream += `${marginX} ${metaY - 6} ${usableWidth} 20 re S\n`;

			stream += "BT\n";
			stream += "/F2 8.5 Tf\n";
			stream += "0.25 0.30 0.38 rg\n";

			const metaText = metaItems.map(([k, v]) => `${k}: ${v}`).join("   |   ");
			stream += `${marginX + 8} ${metaY} Td\n`;
			stream += `(${escapePdfText(metaText)}) Tj\n`;
			stream += "ET\n";

			y = metaY - 20;
		} else {
			// Compact Header for continuation pages
			stream += "BT\n";
			stream += "/F1 10 Tf\n";
			stream += "0.2 0.25 0.3 rg\n";
			stream += `${marginX} ${y - 10} Td\n`;
			stream += `(${escapePdfText(options.title)} (Continued)) Tj\n`;
			stream += "ET\n";

			y -= 25;
		}

		// Table Header Background
		stream += "0.12 0.16 0.22 rg\n"; // Dark slate
		stream += `${marginX} ${y - headerHeight} ${usableWidth} ${headerHeight} re f\n`;

		// Table Header Text
		stream += "BT\n";
		stream += "/F1 8.5 Tf\n";
		stream += "1 1 1 rg\n"; // White

		let colX = marginX;
		options.columns.forEach((col, cIdx) => {
			const colW = colWidths[cIdx];
			const align = col.align || "left";
			const text = col.header;
			const textW = text.length * 4.8;
			let tx = colX + 4;
			if (align === "right") {
				tx = colX + colW - textW - 4;
			} else if (align === "center") {
				tx = colX + (colW - textW) / 2;
			}

			stream += `${tx} ${y - headerHeight + 6.5} Td\n`;
			stream += `(${escapePdfText(text)}) Tj\n`;
			stream += `${-tx} ${-(y - headerHeight + 6.5)} Td\n`;

			colX += colW;
		});
		stream += "ET\n";

		y -= headerHeight;

		// Table Rows
		pageRows.forEach((row, rIdx) => {
			const isEven = rIdx % 2 === 0;
			if (isEven) {
				stream += "0.98 0.985 0.995 rg\n";
				stream += `${marginX} ${y - rowHeight} ${usableWidth} ${rowHeight} re f\n`;
			}

			stream += "0.90 0.92 0.94 RG\n";
			stream += `${marginX} ${y - rowHeight} m ${marginX + usableWidth} ${y - rowHeight} l S\n`;

			stream += "BT\n";
			stream += "/F2 8 Tf\n";
			stream += "0.15 0.18 0.23 rg\n";

			let cellX = marginX;
			options.columns.forEach((col, cIdx) => {
				const colW = colWidths[cIdx];
				const align = col.align || "left";
				const rawVal = row[col.key];
				let text = rawVal === null || rawVal === undefined ? "—" : String(rawVal);
				const maxChars = Math.max(3, Math.floor(colW / 4.6));
				if (text.length > maxChars) {
					text = text.slice(0, maxChars - 1) + "…";
				}

				const textW = text.length * 4.4;
				let tx = cellX + 4;
				if (align === "right") {
					tx = cellX + colW - textW - 4;
				} else if (align === "center") {
					tx = cellX + (colW - textW) / 2;
				}

				stream += `${tx} ${y - rowHeight + 5.5} Td\n`;
				stream += `(${escapePdfText(text)}) Tj\n`;
				stream += `${-tx} ${-(y - rowHeight + 5.5)} Td\n`;

				cellX += colW;
			});
			stream += "ET\n";

			y -= rowHeight;
		});

		// Grand Total Row on last page
		if (isLastPage && options.grandTotalRow) {
			const totalRowH = 22;
			stream += `${theme.r * 0.15 + 0.85} ${theme.g * 0.15 + 0.85} ${theme.b * 0.15 + 0.85} rg\n`;
			stream += `${marginX} ${y - totalRowH} ${usableWidth} ${totalRowH} re f\n`;

			stream += `${theme.r} ${theme.g} ${theme.b} RG\n`;
			stream += "1.5 w\n";
			stream += `${marginX} ${y} m ${marginX + usableWidth} ${y} l S\n`;
			stream += "0.5 w\n";
			stream += `${marginX} ${y - totalRowH} m ${marginX + usableWidth} ${y - totalRowH} l S\n`;

			stream += "BT\n";
			stream += "/F1 8.5 Tf\n";
			stream += "0.1 0.12 0.18 rg\n";

			let cellX = marginX;
			options.columns.forEach((col, cIdx) => {
				const colW = colWidths[cIdx];
				const align = col.align || "left";
				const rawVal = options.grandTotalRow![col.key];
				const text = rawVal === null || rawVal === undefined ? "" : String(rawVal);

				const textW = text.length * 4.8;
				let tx = cellX + 4;
				if (align === "right") {
					tx = cellX + colW - textW - 4;
				} else if (align === "center") {
					tx = cellX + (colW - textW) / 2;
				}

				if (text) {
					stream += `${tx} ${y - totalRowH + 6.5} Td\n`;
					stream += `(${escapePdfText(text)}) Tj\n`;
					stream += `${-tx} ${-(y - totalRowH + 6.5)} Td\n`;
				}

				cellX += colW;
			});
			stream += "ET\n";

			y -= totalRowH;
		}

		// Table Outer Frame
		stream += "0.85 0.88 0.92 RG\n";
		stream += "0.5 w\n";
		stream += `${marginX} ${y} ${usableWidth} ${pageHeight - marginTop - (isFirstPage ? 68 : 25) - y} re S\n`;

		// Page Footer
		stream += "BT\n";
		stream += "/F2 8 Tf\n";
		stream += "0.55 0.60 0.65 rg\n";
		stream += `${marginX} ${marginBottom - 16} Td\n`;
		stream += "(Generated by Fleet Management System   |   Confidential Statement) Tj\n";
		stream += `${usableWidth - 60} 0 Td\n`;
		stream += `(Page ${pageNumber} of ${totalPages}) Tj\n`;
		stream += "ET\n";

		// Page object & Content stream
		const pageObjId = currentObjIndex++;
		const contentObjId = currentObjIndex++;

		pageObjRefs.push(`${pageObjId} 0 R`);

		pdfObjects[pageObjId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`;
		pdfObjects[contentObjId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
	});

	// Object 2: Pages
	pdfObjects[2] = `<< /Type /Pages /Kids [${pageObjRefs.join(" ")}] /Count ${totalPages} >>`;
	// Object 3 & 4: Standard Fonts
	pdfObjects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
	pdfObjects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

	// Build xref and assembly
	let output = "%PDF-1.4\n";
	const offsets: number[] = [];

	for (let i = 1; i < pdfObjects.length; i++) {
		offsets[i] = output.length;
		output += `${i} 0 obj\n${pdfObjects[i]}\nendobj\n`;
	}

	const xrefStart = output.length;
	output += `xref\n0 ${pdfObjects.length}\n`;
	output += "0000000000 65535 f \r\n";
	for (let i = 1; i < pdfObjects.length; i++) {
		const offsetStr = String(offsets[i]).padStart(10, "0");
		output += `${offsetStr} 00000 n \r\n`;
	}

	output += `trailer\n<< /Size ${pdfObjects.length} /Root 1 0 R >>\n`;
	output += `startxref\n${xrefStart}\n%%EOF\n`;

	// Convert string to Uint8Array
	const bytes = new Uint8Array(output.length);
	for (let i = 0; i < output.length; i++) {
		bytes[i] = output.charCodeAt(i) & 0xff;
	}

	const blob = new Blob([bytes], { type: "application/pdf" });
	const filename = options.filename.endsWith(".pdf") ? options.filename : `${options.filename}.pdf`;
	triggerDownload(blob, filename);
}
