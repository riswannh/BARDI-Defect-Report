export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string } | null)?.error ?? "Terjadi kesalahan.",
      res.status
    );
  }
  return data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url));
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

export async function apiDelete<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url, { method: "DELETE" }));
}

export async function apiUpload<T>(url: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  return parse<T>(await fetch(url, { method: "POST", body: form }));
}

export function downloadUrl(url: string) {
  window.location.href = url;
}
