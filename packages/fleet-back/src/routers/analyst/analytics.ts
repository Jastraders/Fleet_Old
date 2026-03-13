import { and, eq, gte, sql, sum } from "drizzle-orm";
import * as v from "valibot";
import {
	journalEntryCreditItems,
	journalEntryDebitItems,
} from "@/db/analytics-schema";
import { expenseCategory, vehicles } from "@/db/schema";
import { analystAuthorized } from "@/procedures/analyst-authorized";
import { vehicleAnalyticsRouter } from "@/routers/analyst/analytics/vehicle";

const periodSchema = v.picklist([
	"all_time",
	"last_7d",
	"last_30d",
	"last_6m",
	"last_12m",
]);

type Period = v.InferOutput<typeof periodSchema>;

function getPeriodDates(period: Period): {
	currentStart: Date | null;
	previousStart: Date | null;
	previousEnd: Date | null;
} {
	if (period === "all_time") {
		return { currentStart: null, previousStart: null, previousEnd: null };
	}

	const now = new Date();
	const currentStart = new Date();
	const previousStart = new Date();
	const previousEnd = new Date();

	switch (period) {
		case "last_7d":
			currentStart.setDate(now.getDate() - 7);
			previousEnd.setDate(now.getDate() - 7);
			previousStart.setDate(now.getDate() - 14);
			break;
		case "last_30d":
			currentStart.setDate(now.getDate() - 30);
			previousEnd.setDate(now.getDate() - 30);
			previousStart.setDate(now.getDate() - 60);
			break;
		case "last_6m":
			currentStart.setMonth(now.getMonth() - 6);
			previousEnd.setMonth(now.getMonth() - 6);
			previousStart.setMonth(now.getMonth() - 12);
			break;
		case "last_12m":
			currentStart.setMonth(now.getMonth() - 12);
			previousEnd.setMonth(now.getMonth() - 12);
			previousStart.setMonth(now.getMonth() - 24);
			break;
	}

	return { currentStart, previousStart, previousEnd };
}

function calculatePercentageChange(
	current: number,
	previous: number,
): number | null {
	if (previous === 0) {
		return current > 0 ? 100 : null;
	}
	return ((current - previous) / previous) * 100;
}

const summaryStats = analystAuthorized
	.input(v.object({ period: periodSchema }))
	.handler(async ({ input, context: { db } }) => {
		const { currentStart, previousStart, previousEnd } = getPeriodDates(
			input.period,
		);

		// Build conditions for current period
		const currentCreditConditions =
			currentStart !== null
				? and(gte(journalEntryCreditItems.transactionDate, currentStart))
				: undefined;

		const currentDebitConditions =
			currentStart !== null
				? and(gte(journalEntryDebitItems.transactionDate, currentStart))
				: undefined;

		// Build conditions for previous period
		const previousCreditConditions =
			previousStart !== null && previousEnd !== null
				? and(
						gte(journalEntryCreditItems.transactionDate, previousStart),
						sql`${journalEntryCreditItems.transactionDate} < ${previousEnd}`,
					)
				: undefined;

		const previousDebitConditions =
			previousStart !== null && previousEnd !== null
				? and(
						gte(journalEntryDebitItems.transactionDate, previousStart),
						sql`${journalEntryDebitItems.transactionDate} < ${previousEnd}`,
					)
				: undefined;

		// Execute all queries in parallel
		const [
			currentCreditResult,
			currentDebitResult,
			previousCreditResult,
			previousDebitResult,
		] = await Promise.all([
			// Current period revenue (credits)
			db
				.select({
					total: sum(journalEntryCreditItems.amount),
				})
				.from(journalEntryCreditItems)
				.where(currentCreditConditions),

			// Current period expenses (debits)
			db
				.select({
					total: sum(journalEntryDebitItems.amount),
				})
				.from(journalEntryDebitItems)
				.where(currentDebitConditions),

			// Previous period revenue (credits) - only if not all_time
			input.period !== "all_time"
				? db
						.select({
							total: sum(journalEntryCreditItems.amount),
						})
						.from(journalEntryCreditItems)
						.where(previousCreditConditions)
				: Promise.resolve([{ total: null }]),

			// Previous period expenses (debits) - only if not all_time
			input.period !== "all_time"
				? db
						.select({
							total: sum(journalEntryDebitItems.amount),
						})
						.from(journalEntryDebitItems)
						.where(previousDebitConditions)
				: Promise.resolve([{ total: null }]),
		]);

		// Parse results
		const currentRevenue = Number(currentCreditResult[0]?.total ?? 0);
		const currentExpenses = Number(currentDebitResult[0]?.total ?? 0);
		const currentProfit = currentRevenue - currentExpenses;
		const currentProfitPercentage =
			currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;

		const previousRevenue = Number(previousCreditResult[0]?.total ?? 0);
		const previousExpenses = Number(previousDebitResult[0]?.total ?? 0);
		const previousProfit = previousRevenue - previousExpenses;
		const previousProfitPercentage =
			previousRevenue > 0 ? (previousProfit / previousRevenue) * 100 : 0;

		// Calculate percentage changes
		const revenueChange = calculatePercentageChange(
			currentRevenue,
			previousRevenue,
		);
		const expensesChange = calculatePercentageChange(
			currentExpenses,
			previousExpenses,
		);
		const profitChange = calculatePercentageChange(
			currentProfit,
			previousProfit,
		);
		const profitPercentageChange = calculatePercentageChange(
			currentProfitPercentage,
			previousProfitPercentage,
		);

		return {
			revenue: {
				value: currentRevenue,
				change: revenueChange,
			},
			expenses: {
				value: currentExpenses,
				change: expensesChange,
			},
			profit: {
				value: currentProfit,
				change: profitChange,
			},
			profitPercentage: {
				value: currentProfitPercentage,
				change: profitPercentageChange,
			},
		};
	});

const fleetStats = analystAuthorized
	.input(v.object({ period: periodSchema }))
	.handler(async ({ input, context: { db } }) => {
		const { currentStart } = getPeriodDates(input.period);

		// Build date condition
		const creditDateCondition =
			currentStart !== null
				? gte(journalEntryCreditItems.transactionDate, currentStart)
				: undefined;

		const debitDateCondition =
			currentStart !== null
				? gte(journalEntryDebitItems.transactionDate, currentStart)
				: undefined;

		// Get credit totals per vehicle
		const creditQuery = db
			.select({
				vehicleId: journalEntryCreditItems.vehicleId,
				vehicleName: vehicles.name,
				total: sum(journalEntryCreditItems.amount),
			})
			.from(journalEntryCreditItems)
			.innerJoin(vehicles, eq(journalEntryCreditItems.vehicleId, vehicles.id))
			.where(creditDateCondition)
			.groupBy(journalEntryCreditItems.vehicleId, vehicles.name);

		// Get debit totals per vehicle
		const debitQuery = db
			.select({
				vehicleId: journalEntryDebitItems.vehicleId,
				vehicleName: vehicles.name,
				total: sum(journalEntryDebitItems.amount),
			})
			.from(journalEntryDebitItems)
			.innerJoin(vehicles, eq(journalEntryDebitItems.vehicleId, vehicles.id))
			.where(debitDateCondition)
			.groupBy(journalEntryDebitItems.vehicleId, vehicles.name);

		// Get all vehicles (to include those with no transactions)
		const allVehiclesQuery = db
			.select({
				id: vehicles.id,
				name: vehicles.name,
				color: vehicles.color,
			})
			.from(vehicles);

		const [creditResults, debitResults, allVehicles] = await Promise.all([
			creditQuery,
			debitQuery,
			allVehiclesQuery,
		]);

		// Create maps for easy lookup
		const creditMap = new Map(
			creditResults.map((r) => [r.vehicleId, Number(r.total ?? 0)]),
		);
		const debitMap = new Map(
			debitResults.map((r) => [r.vehicleId, Number(r.total ?? 0)]),
		);

		// Combine results for all vehicles
		const vehicleData = allVehicles.map((vehicle) => {
			const credit = creditMap.get(vehicle.id) ?? 0;
			const debit = debitMap.get(vehicle.id) ?? 0;
			const profit = credit - debit;

			return {
				vehicleId: vehicle.id,
				vehicleName: vehicle.name,
				vehicleColor: vehicle.color,
				credit,
				debit,
				profit,
			};
		});

		// Sort by profit descending (best performing first)
		vehicleData.sort((a, b) => b.profit - a.profit);

		return vehicleData;
	});

const expensesStats = analystAuthorized
	.input(v.object({ period: periodSchema }))
	.handler(async ({ input, context: { db } }) => {
		const { currentStart } = getPeriodDates(input.period);

		// Build date condition
		const dateCondition =
			currentStart !== null
				? gte(journalEntryDebitItems.transactionDate, currentStart)
				: undefined;

		// Get expense totals per category
		const results = await db
			.select({
				categoryId: expenseCategory.id,
				categoryName: expenseCategory.name,
				categoryColor: expenseCategory.color,
				total: sum(journalEntryDebitItems.amount),
			})
			.from(journalEntryDebitItems)
			.innerJoin(
				expenseCategory,
				eq(journalEntryDebitItems.expenseCategoryId, expenseCategory.id),
			)
			.where(dateCondition)
			.groupBy(expenseCategory.id, expenseCategory.name, expenseCategory.color);

		// Transform results
		const categoryData = results.map((row) => ({
			id: row.categoryId,
			name: row.categoryName,
			color: row.categoryColor,
			amount: Number(row.total ?? 0),
		}));

		// Sort by amount descending (highest expenses first)
		categoryData.sort((a, b) => b.amount - a.amount);

		return categoryData;
	});

export const analyticsRouter = {
	summaryStats,
	fleetStats,
	expensesStats,
	vehicle: vehicleAnalyticsRouter,
};
