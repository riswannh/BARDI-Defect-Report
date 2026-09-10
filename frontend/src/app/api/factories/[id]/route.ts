import { masterItemHandlers } from "@/lib/api/master";
import { factories } from "@/lib/db/schema";

const handlers = masterItemHandlers(factories);
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
