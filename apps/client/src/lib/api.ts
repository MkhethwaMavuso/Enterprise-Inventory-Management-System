export type Role = "ADMIN" | "MANAGER" | "STAFF" | "EXECUTIVE";
export type Session = { token: string; user: { id: string; email: string; firstName: string; lastName: string; role: Role } };
export type Category = { id: string; name: string };
export type Location = { id: string; name: string };
export type UserOption = { id: string; firstName: string; lastName: string; email: string; role: Role };
export type Asset = {
  id: string; name: string; sku: string; serialNumber: string; status: string;
  purchasePrice: string | null; category: Category; location: Location;
  assignments: { user: { firstName: string; lastName: string } }[];
};
export type InventoryItem = {
  id: string; name: string; sku: string; quantity: number; minThreshold: number;
  unitPrice: string; category: Category; location: Location;
};
export type Dashboard = { totalValuation: number; activeUnits: number; assignedUnits: number; lowStockAlerts: number; trackedAssets: number };

export function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return "";
  return "http://localhost:4000";
}

export async function api<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    let message = result.error ?? "Request failed";
    if (typeof result.details === "string") {
      try {
        const issues: unknown = JSON.parse(result.details);
        if (Array.isArray(issues)) {
          message = issues.map((issue) => {
            if (typeof issue !== "object" || issue === null) return "Invalid value";
            const field = Array.isArray(issue.path) ? issue.path.join(".") : "request";
            return `${field}: ${issue.message ?? "Invalid value"}`;
          }).join("; ");
        }
      } catch {
        message = result.details;
      }
    }
    throw new Error(message);
  }
  return result as T;
}