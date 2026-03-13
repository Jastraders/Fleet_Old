import type { AppRouter, InferRouterOutputs } from "fleet-back";

export type ExpenseCategory =
	InferRouterOutputs<AppRouter>["accountant"]["expenseCategories"]["get"];
