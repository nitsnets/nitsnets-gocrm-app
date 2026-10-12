let activeWorkspace: string | null = null;
export function setActiveWorkspace(id: string | null) {
  activeWorkspace = id;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(activeWorkspace ? { "X-Workspace-ID": activeWorkspace } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/"))
      window.dispatchEvent(new Event("crm:unauthorized"));
    if (response.status === 409 && body.error?.code === "workspace_mismatch")
      window.dispatchEvent(new Event("crm:stale-session"));
    throw new ApiError(
      body.error?.message ||
        body.message ||
        "No se pudo completar la operación",
      response.status,
      body.error?.details ?? body.errors,
    );
  }
  return body as T;
}
export function mutate<T>(path: string, method: string, value?: unknown) {
  return api<T>(path, {
    method,
    body: value === undefined ? undefined : JSON.stringify(value),
  });
}
export interface Entity {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  linkedin_url?: string;
  notes?: string;
  domain?: string;
  industry?: string;
  status?: string;
  website?: string;
  title?: string;
  company_id?: string | null;
  contact_id?: string | null;
  due_at?: string | null;
  stage?: string;
  value_minor?: number;
  currency?: string;
  expected_close_on?: string | null;
  body?: string;
  visibility?: string;
  author_name?: string;
  created_at?: string;
  subject?: string;
  from_email?: string;
  from_name?: string;
  received_at?: string;
  body_text?: string;
  to?: string[];
  cc?: string[];
  can_share?: boolean;
  participants?: Entity[];
  grants?: Entity[];
  user_id?: string;
  affiliations?: Affiliation[];
  items?: QuoteItem[];
  total_minor?: number;
  opportunity_id?: string | null;
  location?: string;
  starts_at?: string;
  contact_ids?: string[];
  company?: Entity;
  contact?: Entity;
  role?: string;
}
export interface QuoteItem {
  description: string;
  quantity: number;
  unit_price_minor: number;
}
export interface Affiliation {
  id: string;
  company_id: string;
  role: string;
  started_on?: string;
  ended_on?: string | null;
  company?: Entity;
  company_name?: string;
}
export interface Envelope<T> {
  data: T;
  meta?: { total: number; page: number; per_page: number };
}
export interface Session {
  user: Entity;
  workspace: Entity;
  workspaces: Entity[];
}
export function money(value = 0, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    value / 100,
  );
}
export function date(value?: string | null, withTime = false) {
  return value
    ? new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "short",
        ...(withTime
          ? { hour: "2-digit", minute: "2-digit" }
          : { year: "numeric" }),
      }).format(new Date(value))
    : "Sin fecha";
}
export function name(entity?: Entity | null) {
  return (
    entity?.name ||
    [entity?.first_name, entity?.last_name].filter(Boolean).join(" ") ||
    entity?.title ||
    "Sin nombre"
  );
}
