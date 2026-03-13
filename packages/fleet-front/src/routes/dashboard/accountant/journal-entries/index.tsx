import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import * as v from "valibot";
import { orpc } from "@/orpc";
import { EntriesDataTable } from "@/routes/dashboard/accountant/journal-entries/-index/entries-data-table";
import { EntriesDataTableSkeleton } from "@/routes/dashboard/accountant/journal-entries/-index/entries-data-table-skeleton";
import { EntriesEmptyState } from "@/routes/dashboard/accountant/journal-entries/-index/entries-empty-state";

const querySchema = v.object({
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 20), 20),
});

export const Route = createFileRoute("/dashboard/accountant/journal-entries/")({
	validateSearch: querySchema,
	loaderDeps: ({ search: { offset, limit } }) => ({
		offset,
		limit,
	}),
	loader: ({ context: { orpc, queryClient }, deps: query }) => {
		queryClient.prefetchQuery(
			orpc.accountant.journalEntries.list.queryOptions({
				input: {
					limit: query.limit,
					offset: query.offset,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Suspense fallback={<EntriesDataTableSkeleton />}>
			<EntriesList />
		</Suspense>
	);
}

function EntriesList() {
	const query = Route.useSearch();

	const { data } = useSuspenseQuery({
		...orpc.accountant.journalEntries.list.queryOptions({
			input: {
				limit: query.limit,
				offset: query.offset,
			},
		}),
	});

	if (!data || data.meta.total === 0) {
		return <EntriesEmptyState />;
	}

	return (
		<EntriesDataTable
			data={data.data}
			total={data.meta.total}
			offset={query.offset}
			limit={query.limit}
		/>
	);
}
