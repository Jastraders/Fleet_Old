import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	ArrowLeft,
	Calendar,
	CheckSquare,
	CheckSquare2,
	Phone,
	ReceiptText,
	Square,
	UserCheck,
} from "lucide-react";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import * as v from "valibot";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { parseDateValue } from "@/lib/date";
import { cn, formatINR } from "@/lib/utils";
import { orpc } from "@/orpc";

const periodSchema = v.picklist([
	"all_time",
	"last_7d",
	"last_30d",
	"last_6m",
	"last_12m",
	"custom",
]);

const querySchema = v.object({
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 50), 50),
	search: v.optional(v.string()),
	period: v.optional(v.fallback(periodSchema, "all_time"), "all_time"),
	startDate: v.optional(v.string()),
	endDate: v.optional(v.string()),
});

const periodOptions = [
	{ value: "last_7d", label: "Last 7 days" },
	{ value: "last_30d", label: "Last 30 days" },
	{ value: "last_6m", label: "Last 6 months" },
	{ value: "last_12m", label: "Last 12 months" },
	{ value: "all_time", label: "All time" },
	{ value: "custom", label: "Custom date range" },
] as const;

export const Route = createFileRoute(
	"/dashboard/accountant/drivers/$driverId/",
)({
	validateSearch: querySchema,
	loaderDeps: ({ search: { offset, limit, search, period, startDate, endDate } }) => ({
		offset,
		limit,
		search,
		period,
		startDate,
		endDate,
	}),
	loader: ({ context: { orpc, queryClient }, params: { driverId }, deps: query }) => {
		queryClient.prefetchQuery(
			orpc.accountant.drivers.get.queryOptions({
				input: { id: driverId },
			}),
		);
		queryClient.prefetchQuery(
			orpc.accountant.expenses.list.queryOptions({
				input: {
					driverId,
					limit: query.limit,
					offset: query.offset,
					search: query.search,
					period: query.period,
					startDate: query.startDate,
					endDate: query.endDate,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading driver details...</div>}>
			<DriverDetailsView />
		</Suspense>
	);
}

function DriverDetailsView() {
	const router = useRouter();
	const { driverId } = Route.useParams();
	const _query = Route.useSearch();
	const query = useDeferredValue(_query);

	// Fetch Driver info
	const { data: driver } = useSuspenseQuery({
		...orpc.accountant.drivers.get.queryOptions({
			input: { id: driverId },
		}),
	});

	// Fetch Driver Expenses
	const { data: expensesResponse } = useQuery({
		...orpc.accountant.expenses.list.queryOptions({
			input: {
				driverId,
				limit: query.limit ?? 50,
				offset: query.offset ?? 0,
				search: query.search,
				period: query.period ?? "all_time",
				startDate: query.startDate,
				endDate: query.endDate,
			},
		}),
	});

	const expenses = expensesResponse?.data ?? [];
	const totalExpensesCount = expensesResponse?.meta?.total ?? 0;
	const filteredTotalAmount = expensesResponse?.meta?.totalAmount ?? 0;

	// Expense selection state
	const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

	// Calculate total amount of selected expenses
	const selectedTotal = useMemo(() => {
		return expenses
			.filter((expense: { id: string; amount: string }) => selectedExpenseIds.has(expense.id))
			.reduce((sum: number, expense: { amount: string }) => sum + (parseFloat(expense.amount) || 0), 0);
	}, [expenses, selectedExpenseIds]);

	const allVisibleSelected = expenses.length > 0 && expenses.every((exp: { id: string }) => selectedExpenseIds.has(exp.id));
	const isSomeSelected = selectedExpenseIds.size > 0;

	const toggleSelectAll = () => {
		if (allVisibleSelected) {
			setSelectedExpenseIds(new Set());
		} else {
			const newSet = new Set(selectedExpenseIds);
			for (const exp of expenses) {
				newSet.add(exp.id);
			}
			setSelectedExpenseIds(newSet);
		}
	};

	const toggleSelectExpense = (id: string) => {
		setSelectedExpenseIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handlePeriodChange = (value: string | null) => {
		if (!value) return;
		if (value === "custom") {
			const today = new Date().toISOString().split("T")[0];
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			void router.navigate({
				to: ".",
				search: (prev) => ({
					...prev,
					period: "custom",
					startDate: prev.startDate || thirtyDaysAgo,
					endDate: prev.endDate || today,
					offset: 0,
				}),
			});
		} else {
			void router.navigate({
				to: ".",
				search: (prev) => ({
					...prev,
					period: value as typeof query.period,
					startDate: undefined,
					endDate: undefined,
					offset: 0,
				}),
			});
		}
	};

	const handleDateChange = (field: "startDate" | "endDate", value: string) => {
		void router.navigate({
			to: ".",
			search: (prev) => ({
				...prev,
				period: "custom",
				[field]: value,
				offset: 0,
			}),
		});
	};

	const formatExpenseDate = (exp: {
		expense_date?: string | null;
		expenseDate?: string | null;
		transaction_date?: string | null;
		transactionDate?: string | null;
		created_at?: string | null;
		createdAt?: string | null;
	}) => {
		const raw = exp.expense_date ?? exp.expenseDate ?? exp.transaction_date ?? exp.transactionDate ?? exp.created_at ?? exp.createdAt;
		const parsed = parseDateValue(raw);
		if (!parsed) return "-";
		return parsed.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
	};

	return (
		<div className="w-full min-w-0 space-y-6">
			{/* Top Bar / Back Navigation */}
			<div className="flex items-center gap-4">
				<Button variant="outline" size="sm" render={<Link to="/dashboard/accountant/drivers" />}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to Drivers
				</Button>
			</div>

			{/* Driver Header Information Card */}
			<div className="rounded-xl border bg-card p-6 shadow-2xs">
				<div className="flex flex-wrap items-center justify-between gap-6">
					<div className="flex items-center gap-4">
						<div
							className="h-16 w-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-xs"
							style={{ backgroundColor: driver?.color ? `#${driver.color}` : "var(--primary)" }}
						>
							{driver?.name?.[0]?.toUpperCase() || "D"}
						</div>
						<div className="space-y-1">
							<div className="flex items-center gap-3">
								<h1 className="text-2xl font-bold tracking-tight text-foreground">
									{driver?.name || "Driver Details"}
								</h1>
							</div>
							<div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
								<div className="flex items-center gap-1.5">
									<Phone className="h-4 w-4 text-primary" />
									<span>{driver?.phoneNumber || "No phone number"}</span>
								</div>
								{driver?.createdByUser?.name && (
									<div className="flex items-center gap-1.5">
										<UserCheck className="h-4 w-4 text-muted-foreground" />
										<span>Created by {driver.createdByUser.name}</span>
									</div>
								)}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-4 max-sm:w-full max-sm:justify-between">
						<div className="rounded-lg bg-muted/60 px-4 py-3 text-right max-sm:text-left max-sm:w-full">
							<p className="text-xs font-medium text-muted-foreground">Total Driver Expense (All Time)</p>
							<p className="text-xl font-bold text-foreground">
								{formatINR(Number(driver?.totalExpense || 0))}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Filter Controls & Selected Total Section */}
			<div className="grid gap-4 md:grid-cols-2">
				{/* Selected Expense Sum Prominent Banner */}
				<div
					className={cn(
						"flex items-center justify-between gap-4 rounded-xl border p-4 shadow-2xs transition-colors",
						isSomeSelected
							? "bg-primary/5 border-primary/30"
							: "bg-card border-border",
					)}
				>
					<div className="flex items-center gap-3">
						<div
							className={cn(
								"rounded-lg p-2.5 transition-colors",
								isSomeSelected
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground",
							)}
						>
							<ReceiptText className="h-6 w-6" />
						</div>
						<div>
							<p className="text-xs font-medium text-muted-foreground">
								Selected Expenses Sum
							</p>
							<p className="text-2xl font-extrabold tracking-tight text-foreground">
								{formatINR(selectedTotal)}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
							{selectedExpenseIds.size} of {expenses.length} selected
						</span>
						{isSomeSelected && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setSelectedExpenseIds(new Set())}
							>
								Clear
							</Button>
						)}
					</div>
				</div>

				{/* Date Range Filter Controls */}
				<div className="flex items-center justify-end gap-3 flex-wrap rounded-xl border bg-card p-4 shadow-2xs">
					<Select
						items={periodOptions}
						value={query.period ?? "all_time"}
						onValueChange={handlePeriodChange}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Select period" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{periodOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>

					{query.period === "custom" && (
						<div className="flex items-center gap-2 max-sm:w-full">
							<Input
								type="date"
								value={query.startDate || ""}
								onChange={(e) => handleDateChange("startDate", e.target.value)}
								className="w-[140px] h-9"
							/>
							<span className="text-xs text-muted-foreground">to</span>
							<Input
								type="date"
								value={query.endDate || ""}
								onChange={(e) => handleDateChange("endDate", e.target.value)}
								className="w-[140px] h-9"
							/>
						</div>
					)}
				</div>
			</div>

			{/* Driver Individual Expenses Table */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-bold tracking-tight text-foreground">
						Driver Expenses
					</h2>
					<span className="text-xs text-muted-foreground">
						Showing {expenses.length} expense item{expenses.length === 1 ? "" : "s"}
					</span>
				</div>

				<div className="overflow-hidden rounded-xl border bg-card shadow-2xs">
					<Table>
						<TableHeader className="bg-muted/80 sticky top-0 z-10">
							<TableRow>
								<TableHead className="w-12 text-center">
									<Checkbox
										checked={allVisibleSelected}
										onCheckedChange={toggleSelectAll}
										aria-label="Select all expenses"
									/>
								</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Category</TableHead>
								<TableHead>Amount</TableHead>
								<TableHead>Vehicle</TableHead>
								<TableHead>Voucher</TableHead>
								<TableHead>Handler</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{expenses.length > 0 ? (
								expenses.map((expense: {
									id: string;
									expense_date: string | null;
									category_name: string | null;
									amount: string;
									vehicle_name: string | null;
									voucher_id: number | null;
									handler: string | null;
								}) => {
									const isSelected = selectedExpenseIds.has(expense.id);
									return (
										<TableRow
											key={expense.id}
											className={cn(
												"transition-colors cursor-pointer",
												isSelected && "bg-primary/5 hover:bg-primary/10",
											)}
											onClick={() => toggleSelectExpense(expense.id)}
										>
											<TableCell className="w-12 text-center" onClick={(e) => e.stopPropagation()}>
												<Checkbox
													checked={isSelected}
													onCheckedChange={() => toggleSelectExpense(expense.id)}
													aria-label={`Select expense ${expense.category_name}`}
												/>
											</TableCell>
											<TableCell className="font-medium text-sm">
												{formatExpenseDate(expense)}
											</TableCell>
											<TableCell>
												<span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
													{expense.category_name || "Uncategorized"}
												</span>
											</TableCell>
											<TableCell className="font-bold text-sm text-foreground">
												{formatINR(parseFloat(expense.amount) || 0)}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{expense.vehicle_name || "-"}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{expense.voucher_id ? `#${expense.voucher_id}` : "-"}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{expense.handler || "-"}
											</TableCell>
										</TableRow>
									);
								})
							) : (
								<TableRow>
									<TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
										No expenses found for this driver in the selected date range.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	);
}
