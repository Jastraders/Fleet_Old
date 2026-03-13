import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ORPCTanstackQueryUtils } from "@/orpc";

export interface RouterAppContext {
	orpc: ORPCTanstackQueryUtils;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	beforeLoad: async ({ context: { queryClient, orpc } }) => {
		// check query cache initialized
		const state = queryClient.getQueryState(orpc.user.auth.getMe.queryKey());

		if (state) {
			return {
				user: state.data,
			};
		}

		// initialize query cache on app load
		const user = await queryClient
			.fetchQuery(orpc.user.auth.getMe.queryOptions())
			.catch((_err) => {
				// ignore errors when unauthenticated
				return undefined;
			});

		return {
			user,
		};
	},
	component: () => (
		<>
			<Outlet />
			<TanStackDevtools
				config={{
					position: "bottom-right",
				}}
				plugins={[
					{
						name: "Tanstack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
					{
						name: "Tanstack Query",
						render: <ReactQueryDevtoolsPanel />,
					},
				]}
			/>
		</>
	),
});
