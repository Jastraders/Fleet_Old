import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter, RouterClient } from "fleet-back";

const link = new RPCLink({
	url: import.meta.env.VITE_API_URL ?? "/orpc",
	fetch: (input, init) => {
		return fetch(input, {
			...init,
			credentials: "include",
		});
	},
});

const orpcClient: RouterClient<AppRouter> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(orpcClient);
export type ORPCTanstackQueryUtils = typeof orpc;
