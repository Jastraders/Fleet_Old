import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useDeferredValue } from "react";
import * as v from "valibot";
import { orpc } from "@/orpc";
import { CategoriesDataTable } from "@/routes/dashboard/accountant/expense-categories/-index/categories-data-table";
import { CategoriesDataTableSkeleton } from "@/routes/dashboard/accountant/expense-categories/-index/categories-data-table-skeleton";
import { CategoriesEmptyState } from "@/routes/dashboard/accountant/expense-categories/-index/categories-empty-state";
import { CategoriesSearchInput } from "@/routes/dashboard/accountant/expense-categories/-index/categories-search-input";
import { CreateCategoryDialog } from "@/routes/dashboard/accountant/expense-categories/-index/create-category-dialog";
import {
	AccountantDownloadButton,
	downloadExcelCompatibleCsv,
} from "@/routes/dashboard/accountant/-shared/admin-helpers";

const querySchema = v.object({
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 20), 20),
	search: v.optional(v.string()),
	sortBy: v.optional(
		v.fallback(
			v.picklist(["categoryName", "createdAt", "createdBy"]),
			"createdAt",
		),
		"createdAt",
	),
	sortOrder: v.optional(
		v.fallback(v.picklist(["asc", "desc"]), "desc"),
		"desc",
	),
});

export const Route = createFileRoute(
	"/dashboard/accountant/expense-categories/",
)({
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
			orpc.accountant.expenseCategories.list.queryOptions({
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
		<Suspense fallback={<CategoriesDataTableSkeleton />}>
			<CategoriesList />
		</Suspense>
	);
}

function CategoriesList() {
	const _query = Route.useSearch();
	const query = useDeferredValue(_query);

	const { data } = useSuspenseQuery({
		...orpc.accountant.expenseCategories.list.queryOptions({
			input: {
				limit: query.limit,
				offset: query.offset,
				search: query.search,
				sortBy: query.sortBy,
				sortOrder: query.sortOrder,
			},
		}),
	});

	const hasSearch = !!query.search;
	const isEmpty = !data || data.meta.total === 0;

	return (
		<div className="w-full space-y-4">
			<div className="flex flex-wrap justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">
						Expense Categories
					</h1>
					<p className="text-muted-foreground text-sm">
						List of your organization expense categories
					</p>
				</div>
				<div className="flex gap-4 max-sm:flex-col max-sm:w-full">
					<AccountantDownloadButton
						onDownload={() =>
							downloadExcelCompatibleCsv(
								"expense-categories",
								(data?.data ?? []).map((category) => ({
									Name: category.name,
									Color: category.color ?? "",
									"Created At": String(category.createdAt),
									"Created By": category.createdByUser?.name ?? "",
								})),
							)
						}
					/>
					<CategoriesSearchInput initialValue={query.search ?? ""} />
					<CreateCategoryDialog />
				</div>
			</div>
			{isEmpty ? (
				<CategoriesEmptyState search={hasSearch} />
			) : (
				<CategoriesDataTable
					data={data.data}
					total={data.meta.total}
					offset={query.offset}
					limit={query.limit}
					sortBy={query.sortBy}
					sortOrder={query.sortOrder}
				/>
			)}
		</div>
	);
}
