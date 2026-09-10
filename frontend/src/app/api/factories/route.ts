import { masterCollectionHandlers } from "@/lib/api/master";
import { factories } from "@/lib/db/schema";

const handlers = masterCollectionHandlers(factories);
export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
