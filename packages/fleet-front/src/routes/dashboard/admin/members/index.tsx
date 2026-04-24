import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useDeferredValue } from "react";
import * as v from "valibot";
import { orpc } from "@/orpc";
import { CreateMemberDialog } from "@/routes/dashboard/admin/members/-index/create-member-dialog";
import { MembersDataTable } from "@/routes/dashboard/admin/members/-index/members-data-table";
import { MembersDataTableSkeleton } from "@/routes/dashboard/admin/members/-index/members-data-table-skeleton";
import { MembersEmptyState } from "@/routes/dashboard/admin/members/-index/members-empty-state";
import { MembersSearchInput } from "@/routes/dashboard/admin/members/-index/members-search-input";

const querySchema = v.object({
	offset: v.optional(v.fallback(v.number(), 0), 0),
	limit: v.optional(v.fallback(v.number(), 20), 20),
	search: v.optional(v.string()),
	sortBy: v.optional(
		v.fallback(
			v.picklist(["memberName", "createdAt", "lastLogin"]),
			"createdAt",
		),
		"createdAt",
	),
	sortOrder: v.optional(
		v.fallback(v.picklist(["asc", "desc"]), "desc"),
		"desc",
	),
});

export const Route = createFileRoute("/dashboard/admin/members/")({
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
			orpc.admin.members.list.queryOptions({
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
		<Suspense fallback={<MembersDataTableSkeleton />}>
			<MembersList />
		</Suspense>
	);
}

function MembersList() {
	const _query = Route.useSearch();
	const query = useDeferredValue(_query);

	const { data } = useSuspenseQuery({
		...orpc.admin.members.list.queryOptions({
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
					<h1 className="text-2xl font-bold tracking-tight">Members</h1>
					<p className="text-muted-foreground text-sm">
						List of your organization members
					</p>
				</div>
				<div className="flex gap-4 max-sm:flex-col max-sm:w-full">
					<MembersSearchInput initialValue={query.search ?? ""} />
					<CreateMemberDialog />
				</div>
			</div>
			{isEmpty ? (
				<MembersEmptyState search={hasSearch} />
			) : (
				<MembersDataTable
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
