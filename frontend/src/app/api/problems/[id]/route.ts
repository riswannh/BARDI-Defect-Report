import { masterItemHandlers } from "@/lib/api/master";
import { problems } from "@/lib/db/schema";

const handlers = masterItemHandlers(problems);
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
