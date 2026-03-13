import { os } from "@orpc/server";
import type {
	RequestHeadersPluginContext,
	ResponseHeadersPluginContext,
} from "@orpc/server/plugins";
import type { db } from "./db";

export interface ORPCContext
	extends ResponseHeadersPluginContext,
		RequestHeadersPluginContext {
	db: typeof db;
}

export const base = os.$context<ORPCContext>();
