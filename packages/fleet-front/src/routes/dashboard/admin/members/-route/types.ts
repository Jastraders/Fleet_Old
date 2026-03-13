import type { AppRouter, InferRouterOutputs } from "fleet-back";

export type Outputs = InferRouterOutputs<AppRouter>;

export type Member = Outputs["admin"]["members"]["get"];

export type MemberRole = Member["roles"][number]["role"];
