import type { NextRequest } from "next/server";
import { excelImport } from "@/lib/api/excel";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ module: string }> }
) {
  const { module } = await ctx.params;
  return excelImport(module, req);
}
