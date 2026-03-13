import { CheckIcon, type CopyIcon, DownloadIcon } from "lucide-react";
import { useState } from "react";

interface UseSvgExportOptions {
	resolution?: number;
	successMessage?: string;
	errorMessage?: string;
	resetDelay?: number;
}

interface ExportMethod {
	isExporting: boolean;
	Icon: typeof DownloadIcon | typeof CheckIcon | typeof CopyIcon;
	execute: () => Promise<void>;
}

interface UseSvgCodeExportReturn {
	downloadPng: ExportMethod;
	downloadJpeg: ExportMethod;
	downloadSvg: ExportMethod;
}

export default function useSvgExport(
	svgRef: React.RefObject<SVGSVGElement | null>,
	options: UseSvgExportOptions = {},
): UseSvgCodeExportReturn {
	const { resolution = 1024, resetDelay = 2000 } = options;

	const [exportingState, setExportingState] = useState<{
		downloadPng: boolean;
		downloadJpeg: boolean;
		downloadSvg: boolean;
	}>({
		downloadPng: false,
		downloadJpeg: false,
		downloadSvg: false,
	});

	const fetchImageAsDataUrl = async (url: string): Promise<string> => {
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onloadend = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			});
		} catch (error) {
			console.error(`Failed to fetch image from ${url}:`, error);
			return url;
		}
	};

	const inlineImagesInSvg = async (
		svgElement: SVGSVGElement,
	): Promise<SVGSVGElement> => {
		const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
		const images = svgClone.querySelectorAll("image");

		const inlinePromises = Array.from(images).map(async (img) => {
			const href =
				img.getAttribute("href") || img.getAttribute("xlink:href") || "";

			if (href && !href.startsWith("data:")) {
				try {
					const dataUrl = await fetchImageAsDataUrl(href);
					img.setAttribute("href", dataUrl);
					if (img.hasAttribute("xlink:href")) {
						img.removeAttribute("xlink:href");
					}
				} catch (error) {
					console.error(`Failed to inline image ${href}:`, error);
				}
			}
		});

		await Promise.all(inlinePromises);
		return svgClone;
	};

	const convertSvgToCanvas = async (
		svgElement: SVGSVGElement,
	): Promise<HTMLCanvasElement> => {
		const svgWithInlinedImages = await inlineImagesInSvg(svgElement);

		// Clone and add white background
		const svgClone = svgWithInlinedImages.cloneNode(true) as SVGSVGElement;
		const rect = svgElement.getBoundingClientRect();

		// Ensure viewBox is set for proper scaling
		if (!svgClone.hasAttribute("viewBox")) {
			svgClone.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
		}

		// Add white background rectangle at the beginning
		const bgRect = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"rect",
		);
		bgRect.setAttribute("width", "100%");
		bgRect.setAttribute("height", "100%");
		bgRect.setAttribute("fill", "white");
		svgClone.insertBefore(bgRect, svgClone.firstChild);

		const svgData = new XMLSerializer().serializeToString(svgClone);
		const svgBlob = new Blob([svgData], {
			type: "image/svg+xml;charset=utf-8",
		});
		const url = URL.createObjectURL(svgBlob);

		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement("canvas");

				const scale = resolution / rect.width;
				canvas.width = resolution;
				canvas.height = rect.height * scale;

				const ctx = canvas.getContext("2d");
				if (!ctx) {
					reject(new Error("Failed to get canvas context"));
					return;
				}

				// Fill with white background
				ctx.fillStyle = "white";
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				URL.revokeObjectURL(url);
				resolve(canvas);
			};

			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error("Failed to load SVG image"));
			};

			img.src = url;
		});
	};

	const downloadPng = async () => {
		if (!svgRef.current) return;

		const canvas = await convertSvgToCanvas(svgRef.current);
		const dataUrl = canvas.toDataURL("image/png");

		const link = document.createElement("a");
		link.href = dataUrl;
		link.download = "image.png";
		link.click();
	};

	const downloadJpeg = async () => {
		if (!svgRef.current) return;

		const canvas = await convertSvgToCanvas(svgRef.current);
		const dataUrl = canvas.toDataURL("image/jpeg", 1.0);

		const link = document.createElement("a");
		link.href = dataUrl;
		link.download = "image.jpeg";
		link.click();
	};

	const downloadSvg = async () => {
		if (!svgRef.current) return;

		const svgWithInlinedImages = await inlineImagesInSvg(svgRef.current);
		const svgClone = svgWithInlinedImages.cloneNode(true) as SVGSVGElement;
		const rect = svgRef.current.getBoundingClientRect();

		// Ensure viewBox is set
		if (!svgClone.hasAttribute("viewBox")) {
			svgClone.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
		}

		// Add white background rectangle at the beginning
		const bgRect = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"rect",
		);
		bgRect.setAttribute("width", "100%");
		bgRect.setAttribute("height", "100%");
		bgRect.setAttribute("fill", "white");
		svgClone.insertBefore(bgRect, svgClone.firstChild);

		const svgData = new XMLSerializer().serializeToString(svgClone);
		const svgBlob = new Blob(
			[`<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`, svgData],
			{ type: "image/svg+xml;charset=utf-8" },
		);
		const dataUrl = URL.createObjectURL(svgBlob);

		const link = document.createElement("a");
		link.href = dataUrl;
		link.download = "image.svg";
		link.click();

		setTimeout(() => URL.revokeObjectURL(dataUrl), 100);
	};

	const handleExport = async (type: "png" | "jpeg" | "svg") => {
		try {
			const stateKey =
				`download${type.charAt(0).toUpperCase()}${type.slice(1)}` as const;

			setExportingState((prev) => ({
				...prev,
				[stateKey]: true,
			}));

			if (type === "png") {
				await downloadPng();
			} else if (type === "jpeg") {
				await downloadJpeg();
			} else if (type === "svg") {
				await downloadSvg();
			}

			setTimeout(() => {
				setExportingState((prev) => ({
					...prev,
					[stateKey]: false,
				}));
			}, resetDelay);
		} catch (error) {
			console.error(`Failed to export as ${type}:`, error);
			setExportingState((prev) => {
				const stateKey =
					`download${type.charAt(0).toUpperCase()}${type.slice(1)}` as const;
				return {
					...prev,
					[stateKey]: false,
				};
			});
		}
	};

	const createExportMethod = (type: "png" | "jpeg" | "svg"): ExportMethod => {
		const stateKey =
			`download${type.charAt(0).toUpperCase()}${type.slice(1)}` as keyof typeof exportingState;
		const isExporting = exportingState[stateKey];

		return {
			isExporting,
			Icon: isExporting ? CheckIcon : DownloadIcon,
			execute: () => handleExport(type),
		};
	};

	return {
		downloadPng: createExportMethod("png"),
		downloadJpeg: createExportMethod("jpeg"),
		downloadSvg: createExportMethod("svg"),
	};
}
