import { z } from "zod";

export function normalizeTimestamp(value: string): string {
  const s = value.trim().replace(" ", "T");
  return s.length === 10 ? `${s}T00:00` : s;
}

export const masterNameSchema = z.object({
  name: z.string().trim().min(1),
});

export const defectSchema = z.object({
  codeGaransi: z.string().trim().min(1),
  timestamp: z
    .string()
    .trim()
    .min(1)
    .transform(normalizeTimestamp),
  photosLink: z.string().trim().default(""),
  videosLink: z.string().trim().default(""),
  problemId: z.coerce.number().int().positive(),
  problemDetail: z.string().trim().default(""),
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(0).default(0),
  statusId: z.coerce.number().int().positive(),
  factoryId: z.coerce.number().int().positive(),
  value: z.coerce.number().int().min(0).default(0),
});

export const defectUpdateSchema = defectSchema.partial();

export const saleSchema = z.object({
  productId: z.coerce.number().int().positive(),
  factoryId: z.coerce.number().int().positive(),
  month: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(0).default(0),
  value: z.coerce.number().int().min(0).default(0),
});

export const saleUpdateSchema = saleSchema.partial();

export const userCreateSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(6),
  factoryId: z.coerce.number().int().positive().nullable().optional(),
  isAdmin: z.boolean().default(false),
});

export const userUpdateSchema = z.object({
  username: z.string().trim().min(3).optional(),
  password: z.string().min(6).optional(),
  factoryId: z.coerce.number().int().positive().nullable().optional(),
  isAdmin: z.boolean().optional(),
});
