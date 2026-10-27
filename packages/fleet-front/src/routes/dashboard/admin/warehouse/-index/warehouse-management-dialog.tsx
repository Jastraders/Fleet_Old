import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, PlusIcon, WarehouseIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { orpc } from "@/orpc";

export interface WarehouseItem {
	id: string;
	name: string;
	code: string;
	description?: string;
	color: string;
	isSystem: boolean;
	status: string;
	recordCount?: number;
	productCount?: number;
}

const PRESET_COLORS = [
	{ name: "Blue", hex: "#2563EB" },
	{ name: "Purple", hex: "#7C3AED" },
	{ name: "Emerald", hex: "#059669" },
	{ name: "Amber", hex: "#D97706" },
	{ name: "Rose", hex: "#E11D48" },
	{ name: "Cyan", hex: "#0891B2" },
	{ name: "Indigo", hex: "#4F46E5" },
	{ name: "Orange", hex: "#EA580C" },
	{ name: "Teal", hex: "#0D9488" },
	{ name: "Slate", hex: "#475569" },
];

interface WarehouseManagementDialogProps {
	mode: "create" | "edit";
	warehouse?: WarehouseItem | null;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onSuccess?: (warehouse: WarehouseItem) => void;
	trigger?: React.ReactNode;
}

export function WarehouseManagementDialog({
	mode,
	warehouse,
	open: controlledOpen,
	onOpenChange: setControlledOpen,
	onSuccess,
	trigger,
}: WarehouseManagementDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = controlledOpen !== undefined;
	const isOpen = isControlled ? controlledOpen : internalOpen;
	const setIsOpen = isControlled
		? (setControlledOpen ?? (() => {}))
		: setInternalOpen;

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [color, setColor] = useState("#2563EB");
	const [error, setError] = useState<string | null>(null);

	const queryClient = useQueryClient();

	useEffect(() => {
		if (isOpen) {
			if (mode === "edit" && warehouse) {
				setName(warehouse.name || "");
				setDescription(warehouse.description || "");
				setColor(warehouse.color || "#2563EB");
			} else {
				setName("");
				setDescription("");
				setColor("#2563EB");
			}
			setError(null);
		}
	}, [isOpen, mode, warehouse]);

	const createMutation = useMutation({
		...orpc.admin.warehouse.warehouses.create.mutationOptions(),
		onSuccess: (res: { warehouse?: WarehouseItem }) => {
			queryClient.invalidateQueries();
			setIsOpen(false);
			const created = res?.warehouse;
			if (created && onSuccess) {
				onSuccess(created);
			}
		},
		onError: (err: {
			message?: string;
			data?: { message?: string };
			response?: { data?: { message?: string } };
		}) => {
			const errorMsg =
				err?.data?.message ||
				err?.response?.data?.message ||
				err?.message ||
				"Failed to create warehouse";
			setError(errorMsg);
		},
	});

	const updateMutation = useMutation({
		...orpc.admin.warehouse.warehouses.update.mutationOptions(),
		onSuccess: (res: { warehouse?: WarehouseItem }) => {
			queryClient.invalidateQueries();
			setIsOpen(false);
			const updated = res?.warehouse;
			if (updated && onSuccess) {
				onSuccess(updated);
			}
		},
		onError: (err: {
			message?: string;
			data?: { message?: string };
			response?: { data?: { message?: string } };
		}) => {
			const errorMsg =
				err?.data?.message ||
				err?.response?.data?.message ||
				err?.message ||
				"Failed to update warehouse";
			setError(errorMsg);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const trimmedName = name.trim();
		if (!trimmedName) {
			setError("Warehouse name is required.");
			return;
		}

		if (mode === "create") {
			createMutation.mutate({
				name: trimmedName,
				description: description.trim(),
				color,
			} as never);
		} else if (mode === "edit" && warehouse) {
			updateMutation.mutate({
				id: warehouse.id,
				name: trimmedName,
				description: description.trim(),
				color,
			} as never);
		}
	};

	const isLoading = createMutation.isPending || updateMutation.isPending;

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			{trigger ? (
				<DialogTrigger render={<>{trigger}</>} />
			) : mode === "create" ? (
				<DialogTrigger
					render={
						<Button size="sm" className="gap-1.5 shadow-xs">
							<PlusIcon className="h-4 w-4" />
							Add Warehouse
						</Button>
					}
				/>
			) : null}

			<DialogContent className="sm:max-w-md">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<div className="flex items-center gap-2">
							<div
								className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
								style={{ backgroundColor: color }}
							>
								<WarehouseIcon className="h-4 w-4" />
							</div>
							<DialogTitle>
								{mode === "create"
									? "Add New Warehouse"
									: `Edit ${warehouse?.name || "Warehouse"}`}
							</DialogTitle>
						</div>
						<DialogDescription>
							{mode === "create"
								? "Create an independent warehouse with complete unloading logs, worker wage calculations, and custom products."
								: "Update the warehouse display name, description, and visual theme color."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<Field>
							<FieldLabel>Warehouse Name *</FieldLabel>
							<Input
								placeholder="e.g. North Central Depot"
								value={name}
								onChange={(e) => setName(e.target.value)}
								disabled={isLoading}
								autoFocus
							/>
						</Field>

						<Field>
							<FieldLabel>Description (Optional)</FieldLabel>
							<Input
								placeholder="e.g. Primary hub for northern regional distribution"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								disabled={isLoading}
							/>
						</Field>

						<Field>
							<FieldLabel>Theme Accent Color</FieldLabel>
							<div className="grid grid-cols-5 gap-2 pt-1">
								{PRESET_COLORS.map((c) => {
									const isSelected =
										color.toLowerCase() === c.hex.toLowerCase();
									return (
										<button
											key={c.hex}
											type="button"
											onClick={() => setColor(c.hex)}
											className="group relative flex flex-col items-center gap-1 p-1.5 rounded-lg border text-xs transition-all hover:bg-muted/50"
											style={{
												borderColor: isSelected ? c.hex : undefined,
												borderWidth: isSelected ? "2px" : "1px",
											}}
										>
											<div
												className="h-6 w-6 rounded-full flex items-center justify-center shadow-2xs"
												style={{ backgroundColor: c.hex }}
											>
												{isSelected && (
													<CheckIcon className="h-3.5 w-3.5 text-white" />
												)}
											</div>
											<span className="text-[10px] text-muted-foreground group-hover:text-foreground">
												{c.name}
											</span>
										</button>
									);
								})}
							</div>
						</Field>

						{error && (
							<div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
								{error}
							</div>
						)}
					</div>

					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsOpen(false)}
							disabled={isLoading}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isLoading}
							style={{ backgroundColor: color }}
						>
							{isLoading && (
								<Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />
							)}
							{mode === "create" ? "Create Warehouse" : "Save Changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
