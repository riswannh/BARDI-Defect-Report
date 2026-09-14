import { masterCollectionHandlers } from "@/lib/api/master";
import { keterangan } from "@/lib/db/schema";

const handlers = masterCollectionHandlers(keterangan);
export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
