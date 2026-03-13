import { expenseCategoriesRouter } from "@/routers/accountant/expense-categories";
import { journalEntriesRouter } from "@/routers/accountant/journal-entries";
import { vehiclesRouter } from "@/routers/accountant/vehicles";

export const accountantRouter = {
	journalEntries: journalEntriesRouter,
	expenseCategories: expenseCategoriesRouter,
	vehicles: vehiclesRouter,
};
