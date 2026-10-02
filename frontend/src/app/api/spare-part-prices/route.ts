import {
  sparePartPricesDELETEALL,
  sparePartPricesGET,
  sparePartPricesPOST,
} from "@/lib/api/spare-part-prices";

export const GET = sparePartPricesGET;
export const POST = sparePartPricesPOST;
export const DELETE = sparePartPricesDELETEALL;
