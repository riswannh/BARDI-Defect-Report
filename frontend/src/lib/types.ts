export type Role = "admin" | "pabrik";

export interface Factory {
  id: number;
  name: string;
}

export interface User {
  id: number;
  username: string;
  factoryId: number | null;
  isAdmin: boolean;
}

export interface Product {
  id: number;
  name: string;
}

export interface Problem {
  id: number;
  name: string;
}

export interface Status {
  id: number;
  name: string;
}

export interface Defect {
  id: number;
  codeGaransi: string;
  timestamp: string;
  photosLink: string;
  videosLink: string;
  problemId: number;
  problemDetail: string;
  productId: number;
  quantity: number;
  statusId: number;
  factoryId: number;
  value: number;
}

export interface Sale {
  id: number;
  productId: number;
  factoryId: number;
  month: string;
  quantity: number;
  value: number;
}

export type PeriodType = "daily" | "weekly" | "monthly" | "custom";

export interface ImportIssue {
  row: number;
  key: string;
  reason: string;
}

export interface ImportResult {
  module: string;
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: ImportIssue[];
  skippedDetails: ImportIssue[];
}
