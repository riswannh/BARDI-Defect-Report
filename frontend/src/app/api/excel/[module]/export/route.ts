import type { NextRequest } from "next/server";
import { excelExport } from "@/lib/api/excel";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ module: string }> }
) {
  const { module } = await ctx.params;
  return excelExport(module, req);
}
