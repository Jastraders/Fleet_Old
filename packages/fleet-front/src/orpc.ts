import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter, RouterClient } from "fleet-back";

function resolveApiUrl() {
	const configuredUrl = import.meta.env.VITE_API_URL?.trim();
	const defaultPath = "/orpc";

	const toAbsoluteUrl = (rawUrl: string) => {
		if (typeof window === "undefined") {
			return rawUrl;
		}

		return new URL(rawUrl, window.location.origin).toString();
	};

	if (!configuredUrl) {
		return toAbsoluteUrl(defaultPath);
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
			return toAbsoluteUrl(configuredUrl);
		} catch {
			return toAbsoluteUrl(defaultPath);
		}
	}

	try {
		return new URL(configuredUrl).toString();
	} catch {
		return `${window.location.protocol}//${configuredUrl}`;
	}
}

const resolvedApiUrl = resolveApiUrl();

if (import.meta.env.DEV) {
	console.info("[orpc] API URL resolved", {
		configuredUrl: import.meta.env.VITE_API_URL,
		resolvedApiUrl,
	});
}

const link = new RPCLink({
	url: resolvedApiUrl,
	fetch: async (input, init) => {
		try {
			return await fetch(input, {
				...init,
				credentials: "include",
			});
		} catch (error) {
			console.error("[orpc] fetch failed", {
				input,
				resolvedApiUrl,
				configuredUrl: import.meta.env.VITE_API_URL,
				error,
			});

			throw error;
		}
	},
});

const orpcClient: RouterClient<AppRouter> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(orpcClient);
export type ORPCTanstackQueryUtils = typeof orpc;
