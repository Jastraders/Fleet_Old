import { and, eq, gte, lte, sql, sum } from "drizzle-orm";
import * as v from "valibot";
import {
	journalEntryCreditItems,
	journalEntryDebitItems,
} from "@/db/analytics-schema";
import { expenseCategory } from "@/db/schema";
import { analystAuthorized } from "@/procedures/analyst-authorized";

const periodSchema = v.picklist([
	"all_time",
	"last_30d",
	"last_3m",
	"last_6m",
	"last_9m",
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
		case "last_30d":
			currentStart.setDate(now.getDate() - 30);
			previousEnd.setDate(now.getDate() - 30);
			previousStart.setDate(now.getDate() - 60);
			break;
		case "last_3m":
			currentStart.setMonth(now.getMonth() - 3);
			previousEnd.setMonth(now.getMonth() - 3);
			previousStart.setMonth(now.getMonth() - 6);
			break;
		case "last_6m":
			currentStart.setMonth(now.getMonth() - 6);
			previousEnd.setMonth(now.getMonth() - 6);
			previousStart.setMonth(now.getMonth() - 12);
			break;
		case "last_9m":
			currentStart.setMonth(now.getMonth() - 9);
			previousEnd.setMonth(now.getMonth() - 9);
			previousStart.setMonth(now.getMonth() - 18);
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
	.input(v.object({ vehicleId: v.string(), period: periodSchema }))
	.handler(async ({ input, context: { db } }) => {
		const { currentStart, previousStart, previousEnd } = getPeriodDates(
			input.period,
		);

		// Build conditions for current period
		const currentCreditConditions =
			currentStart !== null
				? and(
						gte(journalEntryCreditItems.transactionDate, currentStart),
						eq(journalEntryCreditItems.vehicleId, input.vehicleId),
					)
				: eq(journalEntryCreditItems.vehicleId, input.vehicleId);

		const currentDebitConditions =
			currentStart !== null
				? and(
						gte(journalEntryDebitItems.transactionDate, currentStart),
						eq(journalEntryDebitItems.vehicleId, input.vehicleId),
					)
				: eq(journalEntryDebitItems.vehicleId, input.vehicleId);

		// Build conditions for previous period
		const previousCreditConditions =
			previousStart !== null && previousEnd !== null
				? and(
						gte(journalEntryCreditItems.transactionDate, previousStart),
						sql`${journalEntryCreditItems.transactionDate} < ${previousEnd}`,
						eq(journalEntryCreditItems.vehicleId, input.vehicleId),
					)
				: undefined;

		const previousDebitConditions =
			previousStart !== null && previousEnd !== null
				? and(
						gte(journalEntryDebitItems.transactionDate, previousStart),
						sql`${journalEntryDebitItems.transactionDate} < ${previousEnd}`,
						eq(journalEntryDebitItems.vehicleId, input.vehicleId),
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

const vehicleStats = analystAuthorized
	.input(v.object({ vehicleId: v.string(), period: periodSchema }))
	.handler(async ({ input, context: { db } }) => {
		const { currentStart } = getPeriodDates(input.period);
		const now = new Date();

		// Build date condition
		const creditDateCondition =
			currentStart !== null
				? and(
						gte(journalEntryCreditItems.transactionDate, currentStart),
						lte(journalEntryCreditItems.transactionDate, now),
						eq(journalEntryCreditItems.vehicleId, input.vehicleId),
					)
				: and(
						lte(journalEntryCreditItems.transactionDate, now),
						eq(journalEntryCreditItems.vehicleId, input.vehicleId),
					);

		const debitDateCondition =
			currentStart !== null
				? and(
						gte(journalEntryDebitItems.transactionDate, currentStart),
						lte(journalEntryDebitItems.transactionDate, now),
						eq(journalEntryDebitItems.vehicleId, input.vehicleId),
					)
				: and(
						lte(journalEntryDebitItems.transactionDate, now),
						eq(journalEntryDebitItems.vehicleId, input.vehicleId),
					);

		// Use time_bucket_gapfill for bounded periods, time_bucket for all_time
		const bucketFn =
			currentStart !== null ? "time_bucket_gapfill" : "time_bucket";

		// Get monthly credit data
		const creditResults = await db
			.select({
				bucket: sql<Date>`${sql.raw(bucketFn)}('1 month', ${journalEntryCreditItems.transactionDate})`,
				total: sum(journalEntryCreditItems.amount),
			})
			.from(journalEntryCreditItems)
			.where(creditDateCondition)
			.groupBy(
				sql`${sql.raw(bucketFn)}('1 month', ${journalEntryCreditItems.transactionDate})`,
			)
			.orderBy(
				sql`${sql.raw(bucketFn)}('1 month', ${journalEntryCreditItems.transactionDate})`,
			);

		// Get monthly debit data
		const debitResults = await db
			.select({
				bucket: sql<Date>`${sql.raw(bucketFn)}('1 month', ${journalEntryDebitItems.transactionDate})`,
				total: sum(journalEntryDebitItems.amount),
			})
			.from(journalEntryDebitItems)
			.where(debitDateCondition)
			.groupBy(
				sql`${sql.raw(bucketFn)}('1 month', ${journalEntryDebitItems.transactionDate})`,
			)
			.orderBy(
				sql`${sql.raw(bucketFn)}('1 month', ${journalEntryDebitItems.transactionDate})`,
			);

		// Create maps for easy lookup
		const creditMap = new Map(
			creditResults.map((r) => [r.bucket.getTime(), Number(r.total ?? 0)]),
		);
		const debitMap = new Map(
			debitResults.map((r) => [r.bucket.getTime(), Number(r.total ?? 0)]),
		);

		// Get all unique buckets and sort them
		const allBuckets = Array.from(
			new Set([...creditMap.keys(), ...debitMap.keys()]),
		).sort();

		// Combine results for all months
		const monthlyData = allBuckets.map((bucket) => {
			const credit = creditMap.get(bucket) ?? 0;
			const debit = debitMap.get(bucket) ?? 0;
			const profit = credit - debit;

			return {
				bucket,
				credit,
				debit,
				profit,
			};
		});

		return monthlyData;
	});

const expensesStats = analystAuthorized
	.input(v.object({ vehicleId: v.string(), period: periodSchema }))
	.handler(async ({ input, context: { db } }) => {
		const { currentStart } = getPeriodDates(input.period);
		const now = new Date();

		// Build date condition
		const dateCondition =
			currentStart !== null
				? and(
						gte(journalEntryDebitItems.transactionDate, currentStart),
						lte(journalEntryDebitItems.transactionDate, now),
						eq(journalEntryDebitItems.vehicleId, input.vehicleId),
					)
				: and(
						lte(journalEntryDebitItems.transactionDate, now),
						eq(journalEntryDebitItems.vehicleId, input.vehicleId),
					);

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

export const vehicleAnalyticsRouter = {
	summaryStats,
	vehicleStats,
	expensesStats,
};
