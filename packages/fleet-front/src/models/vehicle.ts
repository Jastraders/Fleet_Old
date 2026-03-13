export interface Vehicle {
	id: string;
	name: string;
	licensePlate: string;
	color: string | null;
	createdAt: Date;
	updatedAt: Date;
	createdByUser?: {
		id: string;
		name: string;
		image?: string | null;
	} | null;
}
