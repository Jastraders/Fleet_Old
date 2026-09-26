import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Suspense, useDeferredValue, useMemo } from "react";
import * as v from "valibot";
import {
	TrendingUpIcon,
	CalendarIcon,
	SearchIcon,
	XIcon,
	ExternalLinkIcon,
	EyeIcon,
} from "lucide-react";
import { orpc } from "@/orpc";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn, formatINR } from "@/lib/utils";

const periodSchema = v.picklist([
	"all_time",
	"last_30d",
	"last_3m",
	"last_6m",
	"last_12m",
	"custom",
]);

type Period = v.InferOutput<typeof periodSchema>;

const querySchema = v.object({
	period: v.optional(v.fallback(periodSchema, "all_time"), "all_time"),
	startDate: v.optional(v.string()),
	endDate: v.optional(v.string()),
	search: v.optional(v.string()),
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 20), 20),
});

export const Route = createFileRoute("/dashboard/admin/revenue/")({
	validateSearch: querySchema,
	loaderDeps: ({ search: { period, startDate, endDate, search, offset, limit } }) => ({
		period,
		startDate,
		endDate,
		search,
		offset,
		limit,
	}),
	loader: ({ context: { orpc: orpcClient, queryClient }, deps: query }) => {
		queryClient.prefetchQuery(
			orpcClient.admin.revenue.list.queryOptions({
				input: {
					period: query.period,
					startDate: query.startDate,
					endDate: query.endDate,
					search: query.search,
					limit: query.limit,
					offset: query.offset,
				},
			}),
		);
	},
	component: RouteComponent,
});

const periodOptions = [
	{ value: "all_time", label: "All time" },
	{ value: "last_30d", label: "Last 30 days" },
	{ value: "last_3m", label: "Last 3 months" },
	{ value: "last_6m", label: "Last 6 months" },
	{ value: "last_12m", label: "Last 12 months" },
	{ value: "custom", label: "Custom date range" },
] as const;

function RouteComponent() {
	return (
		<Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Revenue records...</div>}>
			<RevenueTableContent />
		</Suspense>
	);
}

function RevenueTableContent() {
	const navigate = useNavigate();
	const query = Route.useSearch();
	const deferredQuery = useDeferredValue(query);

	const period = query.period || "all_time";
	const startDate = query.startDate || "";
	const endDate = query.endDate || "";
	const search = query.search || "";

	const { data } = useSuspenseQuery({
		...orpc.admin.revenue.list.queryOptions({
			input: {
				period: deferredQuery.period,
				startDate: deferredQuery.startDate,
				endDate: deferredQuery.endDate,
				search: deferredQuery.search,
				limit: deferredQuery.limit,
				offset: deferredQuery.offset,
			},
		}),
	});

	const handlePeriodChange = (value: Period | null) => {
		if (value === null) return;
		if (value === "custom") {
			const today = new Date().toISOString().split("T")[0];
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			navigate({
				search: (prev) => ({
					...prev,
					period: "custom",
					startDate: prev.startDate || thirtyDaysAgo,
					endDate: prev.endDate || today,
					offset: 0,
				}),
			});
		} else {
			navigate({
				search: (prev) => ({
					...prev,
					period: value,
					startDate: undefined,
					endDate: undefined,
					offset: 0,
				}),
			});
		}
	};

	const handleDateChange = (field: "startDate" | "endDate", value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				[field]: value || undefined,
				offset: 0,
			}),
		});
	};

	const handleSearchChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				search: value || undefined,
				offset: 0,
			}),
		});
	};

	const handleRowClick = (id: string) => {
		navigate({ to: "/dashboard/admin/revenue/$revenueId", params: { revenueId: id } });
	};

	const totalRevenueAmount = data?.meta?.totalAmount ?? 0;
	const totalCount = data?.meta?.total ?? 0;
	const isEmpty = !data || data.data.length === 0;

	return (
		<div className="w-full space-y-6">
			{/* Top Header & Overview */}
			<div className="flex flex-wrap justify-between items-center gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<TrendingUpIcon className="h-6 w-6 text-green-600" />
						<h1 className="text-2xl font-bold tracking-tight">Revenue Table (Admin)</h1>
					</div>
					<p className="text-muted-foreground text-sm">
						Admin-only view of all revenue entries derived directly from Journal.
					</p>
				</div>

				<Card className="min-w-[220px]">
					<CardHeader className="p-4 pb-1">
						<CardDescription className="text-xs">Total Filtered Revenue</CardDescription>
						<CardTitle className="text-xl font-bold text-green-600">
							{formatINR(totalRevenueAmount)}
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4 pt-0 text-xs text-muted-foreground">
						{totalCount} total revenue entries
					</CardContent>
				</Card>
			</div>

			{/* Filters & Search Bar */}
			<div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border bg-card shadow-2xs">
				{/* Search Bar */}
				<div className="relative w-full sm:w-80">
					<SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search Voucher, Vehicle, Driver, Product..."
						value={search}
						onChange={(e) => handleSearchChange(e.target.value)}
						className="pl-8 h-9 text-xs"
					/>
					{search && (
						<button
							onClick={() => handleSearchChange("")}
							className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
						>
							<XIcon className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* Date Filter & Period Select */}
				<div className="flex flex-wrap items-center gap-3 text-sm">
					<Select value={period} onValueChange={handlePeriodChange}>
						<SelectTrigger className="w-[170px] h-9 text-xs">
							<SelectValue placeholder="Select period" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{periodOptions.map((option) => (
									<SelectItem key={option.value} value={option.value} className="text-xs">
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>

					{period === "custom" && (
						<div className="flex items-center gap-1.5">
							<CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
							<Input
								type="date"
								value={startDate}
								onChange={(e) => handleDateChange("startDate", e.target.value)}
								className="h-9 w-32 text-xs"
							/>
							<span className="text-muted-foreground text-xs">to</span>
							<Input
								type="date"
								value={endDate}
								onChange={(e) => handleDateChange("endDate", e.target.value)}
								className="h-9 w-32 text-xs"
							/>
						</div>
					)}
				</div>
			</div>

			{/* Table */}
			{isEmpty ? (
				<div className="flex flex-col items-center justify-center p-12 border rounded-lg bg-card text-center space-y-2">
					<p className="text-muted-foreground text-sm">No revenue entries found.</p>
					{(search || startDate || endDate || period !== "all_time") && (
						<p className="text-xs text-muted-foreground">Try clearing date or search filters.</p>
					)}
				</div>
			) : (
				<div className="rounded-lg border bg-card shadow-2xs overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/50">
								<TableHead>Vehicle</TableHead>
								<TableHead>Driver</TableHead>
								<TableHead>Date</TableHead>
								<TableHead className="text-right">Revenue Amount</TableHead>
								<TableHead>Product Name</TableHead>
								<TableHead>Depo</TableHead>
								<TableHead>Delivery Location</TableHead>
								<TableHead>Created By</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.data.map((item: any) => (
								<TableRow
									key={item.id}
									onClick={() => handleRowClick(item.id)}
									className="cursor-pointer transition-colors hover:bg-muted/60"
								>
									<TableCell className="font-medium whitespace-nowrap">
										{item.vehicleName ? (
											<div>
												<div>{item.vehicleName}</div>
												{item.vehicleLicensePlate && (
													<div className="text-xs text-muted-foreground font-normal">
														{item.vehicleLicensePlate}
													</div>
												)}
											</div>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell className="font-medium">{item.driverName || "—"}</TableCell>
									<TableCell className="whitespace-nowrap font-medium text-xs">
										{item.revenueDate ? new Date(item.revenueDate).toLocaleDateString() : "—"}
									</TableCell>
									<TableCell className="text-right font-bold text-green-600 whitespace-nowrap">
										{formatINR(item.amount)}
									</TableCell>
									<TableCell>{item.productName || "—"}</TableCell>
									<TableCell>{item.depo || "—"}</TableCell>
									<TableCell>{item.deliveryLocation || "—"}</TableCell>
									<TableCell className="text-xs">{item.createdByName || "System"}</TableCell>
									<TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
										<div className="flex items-center justify-end gap-1.5">
											<Button
												variant="ghost"
												size="sm"
												asChild
												className="h-8 text-xs text-muted-foreground hover:text-foreground"
											>
												<Link to="/dashboard/admin/revenue/$revenueId" params={{ revenueId: item.id }}>
													<EyeIcon className="h-3.5 w-3.5 mr-1" />
													Details
												</Link>
											</Button>

											<Button
												variant="outline"
												size="sm"
												asChild
												className="h-8 text-xs gap-1"
											>
												<Link
													to="/dashboard/accountant/journal-entries"
													search={{ search: item.voucherId ? String(item.voucherId) : item.journalEntryId }}
												>
													<ExternalLinkIcon className="h-3.5 w-3.5" />
													Journal
												</Link>
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
