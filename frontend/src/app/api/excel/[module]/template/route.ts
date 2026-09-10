import type { NextRequest } from "next/server";
import { excelTemplate } from "@/lib/api/excel";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ module: string }> }
) {
  const { module } = await ctx.params;
  return excelTemplate(module);
}
