import { masterCollectionHandlers } from "@/lib/api/master";
import { products } from "@/lib/db/schema";

const handlers = masterCollectionHandlers(products);
export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
