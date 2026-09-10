import { masterCollectionHandlers } from "@/lib/api/master";
import { statuses } from "@/lib/db/schema";

const handlers = masterCollectionHandlers(statuses);
export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
