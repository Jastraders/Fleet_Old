export type DashboardPeriod =
	| "all_time"
	| "last_7d"
	| "last_30d"
	| "last_6m"
	| "last_12m"
	| "custom";

export interface SummaryStatValue {
	value: number;
	change: number | null;
}

export interface SummaryStatsData {
	revenue: SummaryStatValue;
	expenses: SummaryStatValue;
	profit: SummaryStatValue;
	roi: SummaryStatValue;
}

export interface FleetStatsItem {
	vehicleId: string;
	vehicleName: string;
	vehicleColor: string;
	credit: number;
	debit: number;
	profit: number;
}

export interface ExpenseCategoryStatsItem {
	id: string;
	name: string;
	color: string;
	amount: number;
}
