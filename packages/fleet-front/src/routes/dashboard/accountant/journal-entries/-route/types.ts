import type { AppRouter, InferRouterOutputs } from "fleet-back";

export type JournalEntry =
	InferRouterOutputs<AppRouter>["accountant"]["journalEntries"]["get"];
