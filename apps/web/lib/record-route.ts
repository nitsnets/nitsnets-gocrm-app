export const sections = [
  "dashboard",
  "contacts",
  "companies",
  "opportunities",
  "messages",
  "tasks",
  "events",
  "quotes",
  "settings",
] as const;
export type CRMRoute = {
  view: string;
  mode: "list" | "detail" | "new" | "edit" | "affiliation";
  id?: string;
  q: string;
  page: number;
  status: string;
  contact?: string;
  tab?: string;
  valid: boolean;
};
const recordId = /^[a-zA-Z0-9-]+$/;
export function readRoute(pathname: string, search = ""): CRMRoute {
  const params = new URLSearchParams(search);
  const parts = pathname.split("/").filter(Boolean);
  const view = parts[0] || params.get("view") || "dashboard";
  let mode: CRMRoute["mode"] = "list";
  let id: string | undefined;
  let valid = sections.some((s) => s === view);
  if (parts.length > 1) {
    id = parts[1];
    if (id === "new" && parts.length === 2 && view !== "messages") {
      mode = "new";
      id = undefined;
    } else if (!recordId.test(id) || id === "new") valid = false;
    else if (parts.length === 2) mode = "detail";
    else if (parts.length === 3 && parts[2] === "edit" && view !== "messages")
      mode = "edit";
    else if (
      parts.length === 4 &&
      view === "contacts" &&
      parts[2] === "affiliations" &&
      parts[3] === "new"
    )
      mode = "affiliation";
    else valid = false;
    if (["dashboard", "settings"].includes(view)) valid = false;
  }
  const rawPage = Number(params.get("page") || 1);
  const contact = params.get("contact") || undefined;
  return {
    view,
    mode,
    id,
    valid,
    q: params.get("q") || "",
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    status: params.get("status") || "all",
    contact: contact && recordId.test(contact) ? contact : undefined,
    tab: params.get("tab") === "messages" ? "messages" : undefined,
  };
}
export function routeHref(route: Partial<CRMRoute> & { view: string }): string {
  let path = `/${route.view}`;
  if (route.mode === "new") path += "/new";
  else if (route.id && route.mode !== "list") {
    path += `/${encodeURIComponent(route.id)}`;
    if (route.mode === "edit") path += "/edit";
    if (route.mode === "affiliation") path += "/affiliations/new";
  }
  const params = new URLSearchParams();
  if (route.q) params.set("q", route.q);
  if (route.page && route.page > 1) params.set("page", String(route.page));
  if (route.status && route.status !== "all")
    params.set("status", route.status);
  if (route.contact) params.set("contact", route.contact);
  if (route.tab) params.set("tab", route.tab);
  return path + (params.size ? `?${params}` : "");
}
export function parentRoute(route: CRMRoute): string {
  if (route.view === "messages" && route.contact)
    return routeHref({
      view: "contacts",
      id: route.contact,
      mode: "detail",
      tab: "messages",
    });
  if (route.mode === "edit" || route.mode === "affiliation")
    return routeHref({ ...route, mode: "detail" });
  return routeHref({
    ...route,
    id: undefined,
    mode: "list",
    tab: undefined,
    contact: undefined,
  });
}
