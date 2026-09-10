import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useDeferredValue } from "react";
import * as v from "valibot";
import { orpc } from "@/orpc";
import {
	ExpensesDataTable,
	type ExpensesDataTableProps,
} from "./-index/expenses-data-table";
import { ExpensesEmptyState } from "./-index/expenses-empty-state";

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
	limit: v.optional(v.fallback(v.number(), 20), 20),
	search: v.optional(v.string()),
	period: v.optional(v.fallback(periodSchema, "all_time"), "all_time"),
	startDate: v.optional(v.string()),
	endDate: v.optional(v.string()),
	sortBy: v.optional(
		v.fallback(
			v.picklist([
				"voucherId",
				"expenseCategory",
				"amount",
				"handler",
				"nextRenewalDate",
				"expenseImpact",
				"vehicle",
				"driver",
				"createdBy",
				"createdAt",
			]),
			"createdAt",
		),
		"createdAt",
	),
	sortOrder: v.optional(v.fallback(v.picklist(["asc", "desc"]), "desc"), "desc"),
});

interface ExpensesListResponse {
	data: ExpensesDataTableProps["data"];
	meta: { total: number; totalAmount?: number };
}

export const Route = createFileRoute("/dashboard/accountant/expenses/")({
	validateSearch: querySchema,
	loaderDeps: ({ search: { offset, limit, search, period, startDate, endDate, sortBy, sortOrder } }) => ({
		offset,
		limit,
		search,
		period,
		startDate,
		endDate,
		sortBy,
		sortOrder,
	}),
	loader: ({ context: { orpc, queryClient }, deps: query }) => {
		queryClient.prefetchQuery(
			orpc.accountant.expenses.list.queryOptions({
				input: {
					limit: query.limit,
					offset: query.offset,
					search: query.search,
					period: query.period,
					startDate: query.startDate,
					endDate: query.endDate,
					sortBy: query.sortBy,
					sortOrder: query.sortOrder,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Suspense fallback={<div className="text-sm text-muted-foreground">Loading expenses...</div>}>
			<ExpensesList />
		</Suspense>
	);
}

function ExpensesList() {
	const _query = Route.useSearch();
	const query = useDeferredValue(_query);

	const { data } = useSuspenseQuery<ExpensesListResponse>({
		...orpc.accountant.expenses.list.queryOptions({
			input: {
				limit: query.limit,
				offset: query.offset,
				search: query.search,
				period: query.period,
				startDate: query.startDate,
				endDate: query.endDate,
				sortBy: query.sortBy,
				sortOrder: query.sortOrder,
			},
		}),
	});

	const isFiltered = (query.period && query.period !== "all_time") || Boolean(query.search);
	if ((!data || data.meta.total === 0) && !isFiltered) {
		return <ExpensesEmptyState />;
	}

	return (
		<div className="min-w-0 overflow-x-hidden">
			<ExpensesDataTable
				data={data?.data ?? []}
				total={data?.meta.total ?? 0}
				totalAmount={data?.meta.totalAmount ?? 0}
				offset={query.offset}
				limit={query.limit}
				search={query.search}
				period={query.period}
				startDate={query.startDate}
				endDate={query.endDate}
				sortBy={query.sortBy}
				sortOrder={query.sortOrder}
			/>
		</div>
	);
}
