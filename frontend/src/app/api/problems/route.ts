import { masterCollectionHandlers } from "@/lib/api/master";
import { problems } from "@/lib/db/schema";

const handlers = masterCollectionHandlers(problems);
export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
