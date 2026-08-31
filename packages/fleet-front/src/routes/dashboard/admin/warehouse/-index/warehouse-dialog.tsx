import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, PlusIcon, PencilIcon } from "lucide-react";
import { useCallback, useState } from "react";
import * as v from "valibot";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/orpc";

const warehouseFormSchema = v.object({
    recordDate: v.pipe(v.string(), v.minLength(1, "Date is required")),
    workersCount: v.pipe(v.number("Must be a number"), v.minValue(0, "Cannot be negative")),
    unionCount: v.pipe(v.number("Must be a number"), v.minValue(0, "Cannot be negative")),
    ratePerUnload: v.pipe(v.number("Must be a number"), v.minValue(0, "Cannot be negative")),
    totalUnloads: v.pipe(v.number("Must be a number"), v.minValue(0, "Cannot be negative")),
    status: v.picklist(["paid", "unpaid"]),
});

interface WarehouseDialogProps {
    mode: "create" | "edit";
    initialValues?: {
        id: string;
        recordDate: string;
        workersCount: number;
        unionCount: number;
        ratePerUnload: number;
        totalUnloads: number;
        status: "paid" | "unpaid";
    };
}

export function WarehouseDialog({ mode, initialValues }: WarehouseDialogProps) {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);

    const mutation = useMutation({
        ...(mode === "create"
            ? orpc.admin.warehouse.create.mutationOptions()
            : orpc.admin.warehouse.update.mutationOptions()),
        onSuccess: () => {
            queryClient.invalidateQueries();
            setIsOpen(false);
        },
    });

    const form = useForm({
        defaultValues: {
            recordDate: initialValues?.recordDate ?? new Date().toISOString().split("T")[0],
            workersCount: initialValues?.workersCount ?? 0,
            unionCount: initialValues?.unionCount ?? 0,
            ratePerUnload: initialValues?.ratePerUnload ?? 0,
            totalUnloads: initialValues?.totalUnloads ?? 0,
            status: initialValues?.status ?? "unpaid",
        },
        validators: {
            onSubmit: warehouseFormSchema,
        },
        onSubmit: async ({ value }) => {
            if (value.workersCount + value.unionCount === 0) {
                form.setError("workersCount", "Total labours cannot be zero");
                return;
            }
            mutation.mutate(mode === "create" ? value : { ...value, id: initialValues?.id });
        },
    });

    const handleOpenChange = useCallback((open: boolean) => {
        setIsOpen(open);
        if (!open) {
            form.reset();
        }
    }, [form]);

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger
                render={
                    mode === "create" ? (
                        <Button>
                            <PlusIcon />
                            Add Record
                        </Button>
                    ) : (
                        <Button variant="ghost" size="icon">
                            <PencilIcon className="h-4 w-4" />
                        </Button>
                    )
                }
            />
            <DialogContent className="p-0">
                <ScrollArea className="max-h-[calc(100svh-2rem)]" scrollFade>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.handleSubmit();
                        }}
                        className="p-6"
                    >
                        <DialogHeader>
                            <DialogTitle>{mode === "create" ? "Add Warehouse Record" : "Edit Warehouse Record"}</DialogTitle>
                            <DialogDescription>
                                Fill in the daily labour details. Updates happen in real-time.
                            </DialogDescription>
                        </DialogHeader>

                        <FieldGroup className="my-4">
                            <div className="grid grid-cols-2 gap-4">
                                <form.Field name="recordDate">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel>Record Date</FieldLabel>
                                            <Input
                                                type="date"
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                            />
                                            <FieldError errors={field.state.meta.errors} />
                                        </Field>
                                    )}
                                </form.Field>

                                <form.Field name="status">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel>Payment Status</FieldLabel>
                                            <select
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(e.target.value as "paid" | "unpaid")}
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="unpaid">Unpaid</option>
                                                <option value="paid">Paid</option>
                                            </select>
                                            <FieldError errors={field.state.meta.errors} />
                                        </Field>
                                    )}
                                </form.Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <form.Field name="workersCount">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel>Regular Workers</FieldLabel>
                                            <Input
                                                type="number"
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(Number(e.target.value))}
                                            />
                                            <FieldError errors={field.state.meta.errors} />
                                        </Field>
                                    )}
                                </form.Field>

                                <form.Field name="unionCount">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel>Union Workers</FieldLabel>
                                            <Input
                                                type="number"
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(Number(e.target.value))}
                                            />
                                            <FieldError errors={field.state.meta.errors} />
                                        </Field>
                                    )}
                                </form.Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <form.Field name="ratePerUnload">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel>Rate per Unload (₹)</FieldLabel>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(Number(e.target.value))}
                                            />
                                            <FieldError errors={field.state.meta.errors} />
                                        </Field>
                                    )}
                                </form.Field>

                                <form.Field name="totalUnloads">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel>Total Unloads</FieldLabel>
                                            <Input
                                                type="number"
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(Number(e.target.value))}
                                            />
                                            <FieldError errors={field.state.meta.errors} />
                                        </Field>
                                    )}
                                </form.Field>
                            </div>

                            {/* Fixed State Subscription using form.Subscribe */}
                            <form.Subscribe selector={(state) => state.values}>
                                {(values) => {
                                    const wc = Number(values.workersCount) || 0;
                                    const uc = Number(values.unionCount) || 0;
                                    const rate = Number(values.ratePerUnload) || 0;
                                    const unloads = Number(values.totalUnloads) || 0;

                                    const totalLabours = wc + uc;
                                    const totalSum = rate * unloads;
                                    const perPerson = totalLabours > 0 ? (totalSum / totalLabours) : 0;
                                    const workersSalary = perPerson * wc;

                                    return (
                                        <div className="rounded-lg border bg-muted/40 p-4 space-y-2 mt-2 text-sm">
                                            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Calculations Preview</h3>
                                            <div className="grid grid-cols-2 gap-y-2 pt-1 border-t">
                                                <div>Total Labours:</div>
                                                <div className="font-medium text-right">{totalLabours}</div>
                                                <div>Total Sum of Unloads:</div>
                                                <div className="font-medium text-right">₹{totalSum.toFixed(2)}</div>
                                                <div>Per Person Salary:</div>
                                                <div className="font-medium text-right">₹{perPerson.toFixed(4)}</div>
                                                <div className="font-semibold text-primary">Total Workers Salary:</div>
                                                <div className="font-bold text-right text-primary">₹{workersSalary.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    );
                                }}
                            </form.Subscribe>

                            {mutation.error && (
                                <Alert variant="destructive">
                                    <InfoIcon className="h-4 w-4" />
                                    <AlertDescription>{mutation.error.message}</AlertDescription>
                                </Alert>
                            )}
                        </FieldGroup>

                        <DialogFooter>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending ? "Saving..." : "Save Record"}
                            </Button>
                        </DialogFooter>
                    </form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}