import { masterItemHandlers } from "@/lib/api/master";
import { keterangan } from "@/lib/db/schema";

const handlers = masterItemHandlers(keterangan);
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
