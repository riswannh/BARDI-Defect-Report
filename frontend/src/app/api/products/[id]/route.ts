import { masterItemHandlers } from "@/lib/api/master";
import { products } from "@/lib/db/schema";

const handlers = masterItemHandlers(products);
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
