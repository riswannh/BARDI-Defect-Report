import { spareParts } from "@/lib/db/schema";
import { masterItemHandlers } from "@/lib/api/master";

const handlers = masterItemHandlers(spareParts);

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
