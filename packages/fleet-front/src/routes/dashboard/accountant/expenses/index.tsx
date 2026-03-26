import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useDeferredValue } from "react";
import * as v from "valibot";
import { orpc } from "@/orpc";
import {
	ExpensesDataTable,
	type ExpensesDataTableProps,
} from "@/routes/dashboard/accountant/expenses/-index/expenses-data-table";

const querySchema = v.object({
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 20), 20),
	search: v.optional(v.string()),
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
	meta: { total: number };
}

export const Route = createFileRoute("/dashboard/accountant/expenses/")({
	validateSearch: querySchema,
	loaderDeps: ({ search: { offset, limit, search, sortBy, sortOrder } }) => ({
		offset,
		limit,
		search,
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
				sortBy: query.sortBy,
				sortOrder: query.sortOrder,
			},
		}),
	});

	return (
		<ExpensesDataTable
			data={data?.data || []}
			total={data?.meta.total || 0}
			offset={query.offset}
			limit={query.limit}
			search={query.search}
			sortBy={query.sortBy}
			sortOrder={query.sortOrder}
		/>
	);
}
