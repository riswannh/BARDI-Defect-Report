import {
  purchaseOrdersDELETEALL,
  purchaseOrdersGET,
  purchaseOrdersPOST,
} from "@/lib/api/records";

export const GET = purchaseOrdersGET;
export const POST = purchaseOrdersPOST;
export const DELETE = purchaseOrdersDELETEALL;
