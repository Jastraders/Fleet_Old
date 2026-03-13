import { config } from "dotenv";
import * as v from "valibot";

config({ path: [".env"] });

const envVariables = v.object({
	NODE_ENV: v.picklist(["development", "production"]),
	DATABASE_URL: v.string(),
	FRONTEND_URL: v.pipe(v.string(), v.url()),
});

export const env = v.parse(envVariables, process.env);

declare global {
	namespace NodeJS {
		interface ProcessEnv extends v.InferInput<typeof envVariables> {}
	}
}
