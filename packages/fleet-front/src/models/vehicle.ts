export interface Vehicle {
	id: string;
	name: string;
	licensePlate: string;
	model: string;
	year: number | null;
	renewalDate: string | null;
	loadCapacity: number;
	investmentMode: "full_amount" | "full_loan" | "flexible";
	totalPrice: number;
	monthlyEmi: number;
	emiStartDate: string | null;
	emiDurationMonths: number;
	downPayment: number;
	totalRevenue: number;
	investmentCharge: number;
	totalExpense: number;
	roi: number;
	color: string | null;
	createdAt: Date;
	updatedAt: Date;
	createdByUser?: {
		id: string;
		name: string;
		image?: string | null;
	} | null;
}
