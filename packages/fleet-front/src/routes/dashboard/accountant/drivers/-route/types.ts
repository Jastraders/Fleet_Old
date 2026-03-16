import type { AppRouter, InferRouterOutputs } from "fleet-back";

export type Driver =
	InferRouterOutputs<AppRouter>["accountant"]["drivers"]["get"];
