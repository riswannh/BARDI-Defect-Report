import { masterItemHandlers } from "@/lib/api/master";
import { statuses } from "@/lib/db/schema";

const handlers = masterItemHandlers(statuses);
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
