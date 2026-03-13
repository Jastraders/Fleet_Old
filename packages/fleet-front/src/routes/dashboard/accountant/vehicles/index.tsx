import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useDeferredValue } from "react";
import * as v from "valibot";
import { orpc } from "@/orpc";
import { CreateVehicleDialog } from "@/routes/dashboard/accountant/vehicles/-index/create-vehicle-dialog";
import { VehiclesDataTable } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-data-table";
import { VehiclesDataTableSkeleton } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-data-table-skeleton";
import { VehiclesEmptyState } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-empty-state";
import { VehiclesSearchInput } from "@/routes/dashboard/accountant/vehicles/-index/vehicles-search-input";

const querySchema = v.object({
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 20), 20),
	search: v.optional(v.string()),
	sortBy: v.optional(
		v.fallback(
			v.picklist(["vehicleName", "createdAt", "createdBy"]),
			"createdAt",
		),
		"createdAt",
	),
	sortOrder: v.optional(
		v.fallback(v.picklist(["asc", "desc"]), "desc"),
		"desc",
	),
});

export const Route = createFileRoute("/dashboard/accountant/vehicles/")({
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
			orpc.accountant.vehicles.list.queryOptions({
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
		<Suspense fallback={<VehiclesDataTableSkeleton />}>
			<VehiclesList />
		</Suspense>
	);
}

function VehiclesList() {
	const _query = Route.useSearch();
	const query = useDeferredValue(_query);

	const { data } = useSuspenseQuery({
		...orpc.accountant.vehicles.list.queryOptions({
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
					<h1 className="text-2xl font-bold tracking-tight">Vehicles</h1>
					<p className="text-muted-foreground text-sm">
						List of your organization vehicles
					</p>
				</div>
				<div className="flex gap-4 max-sm:flex-col max-sm:w-full">
					<VehiclesSearchInput initialValue={query.search ?? ""} />
					<CreateVehicleDialog />
				</div>
			</div>
			{isEmpty ? (
				<VehiclesEmptyState search={hasSearch} />
			) : (
				<VehiclesDataTable
					// biome-ignore lint/suspicious/noExplicitAny: Backend returns union type with extra properties
					data={data.data as any}
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
