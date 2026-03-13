import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
	CORSPlugin,
	RequestHeadersPlugin,
	ResponseHeadersPlugin,
} from "@orpc/server/plugins";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@/db";
import { env } from "@/env";
import { accountantRouter } from "@/routers/accountant";
import { adminRouter } from "@/routers/admin";
import { analystRouter } from "@/routers/analyst";
import { userRouter } from "@/routers/user";
import { seed } from "./db/seed";

// migrate db
await migrate(db, {
	migrationsFolder: "drizzle",
});

// seed db
await seed(db);

const router = {
	accountant: accountantRouter,
	admin: adminRouter,
	analyst: analystRouter,
	user: userRouter,
};

const handler = new RPCHandler(router, {
	plugins: [
		new CORSPlugin({
			origin: () => env.FRONTEND_URL,
			allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
			credentials: true,
			allowHeaders: ["authorization", "content-type"],
		}),
		new RequestHeadersPlugin(),
		new ResponseHeadersPlugin(),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

Bun.serve({
	async fetch(request: Request) {
		const { matched, response } = await handler.handle(request, {
			prefix: "/orpc",
			context: {
				db,
			},
		});

		if (matched) {
			return response;
		}

		return new Response("Not found", { status: 404 });
	},
});

export type AppRouter = typeof router;
export type {
	InferRouterInputs,
	InferRouterOutputs,
	RouterClient,
} from "@orpc/server";
