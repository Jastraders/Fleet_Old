import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useDeferredValue } from "react";
import * as v from "valibot";
import { orpc } from "@/orpc";
import { DriversDataTable } from "@/routes/dashboard/accountant/drivers/-index/drivers-data-table";
import { DriversDataTableSkeleton } from "@/routes/dashboard/accountant/drivers/-index/drivers-data-table-skeleton";
import { DriversEmptyState } from "@/routes/dashboard/accountant/drivers/-index/drivers-empty-state";
import { DriversSearchInput } from "@/routes/dashboard/accountant/drivers/-index/drivers-search-input";
import { CreateDriverDialog } from "@/routes/dashboard/accountant/drivers/-index/create-driver-dialog";
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
			v.picklist([
				"driverName",
				"driverPhoneNumber",
				"totalExpense",
				"createdAt",
				"createdBy",
			]),
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
	"/dashboard/accountant/drivers/",
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
			orpc.accountant.drivers.list.queryOptions({
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
		<Suspense fallback={<DriversDataTableSkeleton />}>
			<DriversList />
		</Suspense>
	);
}

function DriversList() {
	const _query = Route.useSearch();
	const query = useDeferredValue(_query);

	const { data } = useSuspenseQuery({
		...orpc.accountant.drivers.list.queryOptions({
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
						Drivers
					</h1>
					<p className="text-muted-foreground text-sm">
						List of your organization drivers
					</p>
				</div>
				<div className="flex gap-4 max-sm:flex-col max-sm:w-full">
					<AccountantDownloadButton
						onDownload={() =>
							downloadExcelCompatibleCsv(
								"drivers",
								(data?.data ?? []).map((driver) => ({
									Name: driver.name,
									"Phone Number": driver.phoneNumber ?? "",
									Color: driver.color ?? "",
									"Total Expense": driver.totalExpense ?? "",
									"Created At": String(driver.createdAt),
									"Created By": driver.createdByUser?.name ?? "",
								})),
							)
						}
					/>
					<DriversSearchInput initialValue={query.search ?? ""} />
					<CreateDriverDialog />
				</div>
			</div>
			{isEmpty ? (
				<DriversEmptyState search={hasSearch} />
			) : (
				<DriversDataTable
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
