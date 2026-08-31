import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useDeferredValue, useState, useMemo } from "react";
import * as v from "valibot";
import { Trash2Icon, CheckCircle2Icon, CalendarIcon } from "lucide-react";
import { orpc } from "@/orpc";
import { WarehouseDialog } from "@/routes/dashboard/admin/warehouse/-index/warehouse-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const querySchema = v.object({
    offset: v.optional(v.fallback(v.number(), 0), 0),
    limit: v.optional(v.fallback(v.number(), 100), 100),
});

export const Route = createFileRoute("/dashboard/admin/warehouse/")({
    validateSearch: querySchema,
    loaderDeps: ({ search: { offset, limit } }) => ({ offset, limit }),
    loader: ({ context: { orpc, queryClient }, deps: query }) => {
        queryClient.prefetchQuery(
            orpc.admin.warehouse.list.queryOptions({
                input: { limit: query.limit, offset: query.offset, status: "all" },
            }),
        );
    },
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <Suspense fallback={<div className="p-6">Loading Warehouse records...</div>}>
            <WarehouseList />
        </Suspense>
    );
}

function WarehouseList() {
    const query = Route.useSearch();
    const deferredQuery = useDeferredValue(query);
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<"all" | "paid" | "unpaid">("all");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { data } = useSuspenseQuery({
        ...orpc.admin.warehouse.list.queryOptions({
            input: {
                limit: deferredQuery.limit,
                offset: deferredQuery.offset,
                status: activeTab,
            },
        }),
    });

    const deleteMutation = useMutation({
        ...orpc.admin.warehouse.delete.mutationOptions(),
        onSuccess: () => {
            queryClient.invalidateQueries();
            setSelectedIds([]);
        },
    });

    const bulkStatusMutation = useMutation({
        ...orpc.admin.warehouse.bulk_update_status.mutationOptions(),
        onSuccess: () => {
            queryClient.invalidateQueries();
            setSelectedIds([]);
        },
    });

    const selectedRecords = useMemo(() => {
        if (!data) return [];
        return data.data.filter((r: any) => selectedIds.includes(r.id));
    }, [data, selectedIds]);

    const selectedStats = useMemo(() => {
        let totalUnloads = 0;
        let totalWorkersSalary = 0;
        let totalSumOfUnloads = 0;

        for (const record of selectedRecords) {
            totalUnloads += record.totalUnloads;
            totalWorkersSalary += record.totalWorkersSalary;
            totalSumOfUnloads += record.totalSumOfUnload;
        }

        return {
            count: selectedRecords.length,
            totalUnloads,
            totalWorkersSalary: totalWorkersSalary.toFixed(2),
            totalSumOfUnloads: totalSumOfUnloads.toFixed(2),
        };
    }, [selectedRecords]);

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this warehouse record?")) {
            deleteMutation.mutate({ id });
        }
    };

    const handleBulkMarkAsPaid = () => {
        if (selectedIds.length === 0) return;
        if (confirm(`Are you sure you want to mark these ${selectedIds.length} records as PAID?`)) {
            bulkStatusMutation.mutate({ ids: selectedIds, status: "paid" });
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked && data) {
            setSelectedIds(data.data.map((r: any) => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds((prev) => [...prev, id]);
        } else {
            setSelectedIds((prev) => prev.filter((item) => item !== id));
        }
    };

    const isEmpty = !data || data.meta.total === 0;

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-wrap justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Warehouse Logs</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage daily warehouse numbers and labour wages.
                    </p>
                </div>
                <div className="flex gap-4">
                    <WarehouseDialog mode="create" />
                </div>
            </div>

            <div className="flex border-b">
                {(["all", "unpaid", "paid"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => {
                            setActiveTab(tab);
                            setSelectedIds([]);
                        }}
                        className={cn(
                            "px-4 py-2 border-b-2 text-sm font-medium capitalize -mb-px transition-colors",
                            activeTab === tab
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab} Records
                    </button>
                ))}
            </div>

            {selectedIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-lg bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-1">
                        <div className="text-sm font-semibold text-primary">
                            {selectedStats.count} entries selected
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Total Unloads: <span className="font-semibold text-foreground">{selectedStats.totalUnloads}</span> |
                            Total Sum: <span className="font-semibold text-foreground">₹{selectedStats.totalSumOfUnloads}</span> |
                            Total Workers Wage: <span className="font-semibold text-primary">₹{selectedStats.totalWorkersSalary}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleBulkMarkAsPaid} className="bg-green-600 hover:bg-green-700 text-white">
                            <CheckCircle2Icon className="h-4 w-4 mr-1" />
                            Mark as Paid
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>
                            Clear Selection
                        </Button>
                    </div>
                </div>
            )}

            {isEmpty ? (
                <div className="flex flex-col items-center justify-center p-12 border rounded-lg bg-card text-center">
                    <p className="text-muted-foreground text-sm">No records found under "{activeTab}".</p>
                </div>
            ) : (
                <div className="rounded-md border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={data.data.length > 0 && selectedIds.length === data.data.length}
                                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                    />
                                </TableHead>
                                <TableHead>Record Date</TableHead>
                                <TableHead className="text-right">Workers</TableHead>
                                <TableHead className="text-right">Union</TableHead>
                                <TableHead className="text-right">Total Labours</TableHead>
                                <TableHead className="text-right">Rate/Unload</TableHead>
                                <TableHead className="text-right">Total Unloads</TableHead>
                                <TableHead className="text-right">Total Sum</TableHead>
                                <TableHead className="text-right">Per Person Salary</TableHead>
                                <TableHead className="text-right">Total Workers Salary</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.data.map((record: any) => {
                                const isSelected = selectedIds.includes(record.id);
                                return (
                                    <TableRow key={record.id} className={cn(isSelected && "bg-muted/40")}>
                                        <TableCell>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) => handleSelectRow(record.id, !!checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                {record.recordDate}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">{record.workersCount}</TableCell>
                                        <TableCell className="text-right">{record.unionCount}</TableCell>
                                        <TableCell className="text-right font-semibold">{record.totalLabours}</TableCell>
                                        <TableCell className="text-right">₹{record.ratePerUnload}</TableCell>
                                        <TableCell className="text-right">{record.totalUnloads}</TableCell>
                                        <TableCell className="text-right">₹{record.totalSumOfUnload}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">₹{record.perPersonSalary}</TableCell>
                                        <TableCell className="text-right font-bold text-primary">₹{record.totalWorkersSalary}</TableCell>
                                        <TableCell className="text-center">
                                            <span
                                                className={cn(
                                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold select-none",
                                                    record.status === "paid"
                                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                                )}
                                            >
                                                <span className={cn("h-1.5 w-1.5 rounded-full", record.status === "paid" ? "bg-green-500" : "bg-amber-500")} />
                                                {record.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <WarehouseDialog
                                                    mode="edit"
                                                    initialValues={{
                                                        id: record.id,
                                                        recordDate: record.recordDate,
                                                        workersCount: record.workersCount,
                                                        unionCount: record.unionCount,
                                                        ratePerUnload: record.ratePerUnload,
                                                        totalUnloads: record.totalUnloads,
                                                        status: record.status,
                                                    }}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(record.id)}
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2Icon className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}