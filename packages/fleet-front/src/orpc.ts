import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter, RouterClient } from "fleet-back";

function resolveApiUrl() {
	const configuredUrl = import.meta.env.VITE_API_URL?.trim();

	if (!configuredUrl) {
		return "/orpc";
	}

	if (configuredUrl.startsWith("http://") || configuredUrl.startsWith("https://")) {
		return configuredUrl;
	}

	if (typeof window === "undefined") {
		return configuredUrl;
	}

	if (configuredUrl.startsWith("//")) {
		return `${window.location.protocol}${configuredUrl}`;
	}

	if (configuredUrl.startsWith("/")) {
		try {
			return new URL(configuredUrl, window.location.origin).toString();
		} catch {
			return "/orpc";
		}
	}

	try {
		return new URL(configuredUrl).toString();
	} catch {
		return `${window.location.protocol}//${configuredUrl}`;
	}
}

const link = new RPCLink({
	url: resolveApiUrl(),
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
