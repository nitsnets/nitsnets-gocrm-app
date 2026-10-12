"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useCallback, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  readRoute,
  routeHref,
  parentRoute,
  type CRMRoute,
} from "@/lib/record-route";
import {
  RecordNavigation,
  RecordPage,
  RecordLink,
  useRecordNavigation,
} from "./record-page";
import { Toaster, toast } from "sonner";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Network,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  api,
  mutate,
  Entity,
  Envelope,
  Session,
  money,
  date,
  name,
  ApiError,
  setActiveWorkspace,
} from "@/lib/api";
import {
  Avatar,
  Badge,
  Empty,
  ErrorBox,
  Loading,
  SearchBox,
  useResource,
} from "./ui";
import {
  RecordEditor,
  ContactDetail,
  MessageDetail,
  QuoteEditor,
  SettingsView,
  AffiliationEditor,
  EntityDetail,
} from "./records";
const navigation = [
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "contacts", label: "Contactos", icon: Users },
  { id: "companies", label: "Clientes", icon: Building2 },
  { id: "opportunities", label: "Oportunidades", icon: Network },
  { id: "messages", label: "Correo privado", icon: Mail },
  { id: "tasks", label: "Agenda y tareas", icon: CheckCircle2 },
  { id: "events", label: "Eventos", icon: CalendarDays },
  { id: "quotes", label: "Presupuestos", icon: FileText },
];
const singular: Record<string, string> = {
  contacts: "contacto",
  companies: "cliente",
  opportunities: "oportunidad",
  tasks: "tarea",
  events: "evento",
  quotes: "presupuesto",
};
export const stages: Record<string, string> = {
  new: "Nueva",
  qualified: "Cualificada",
  proposal: "Propuesta",
  won: "Ganada",
  lost: "Perdida",
};
export function CRM() {
  const sessionChannel = useRef<BroadcastChannel | null>(null);
  const sessionRequest = useRef<AbortController | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [initialError, setInitialError] = useState(""),
    [switching, setSwitching] = useState(false);
  const load = useCallback(() => {
    sessionRequest.current?.abort();
    const controller = new AbortController();
    sessionRequest.current = controller;
    setInitialError("");
    setReady(false);
    api<Envelope<Session>>("me", { signal: controller.signal })
      .then((r) => {
        if (controller.signal.aborted) return;
        setActiveWorkspace(r.data.workspace.id);
        setSession(r.data);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        if (!(e instanceof ApiError && e.status === 401))
          setInitialError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
  }, []);
  useEffect(() => {
    load();
    const reset = () => {
      sessionRequest.current?.abort();
      setReady(true);
      setInitialError("");
      setActiveWorkspace(null);
      setSession(null);
    };
    const stale = () => {
      setActiveWorkspace(null);
      load();
      toast.info(
        "La empresa activa cambió en otra pestaña. Hemos actualizado tu espacio.",
      );
    };
    if (typeof BroadcastChannel !== "undefined") {
      sessionChannel.current = new BroadcastChannel("nitsnets-session");
      sessionChannel.current.onmessage = (event) => {
        if (event.data === "logout") reset();
        else if (event.data === "refresh") {
          setActiveWorkspace(null);
          load();
        }
      };
    }
    window.addEventListener("crm:unauthorized", reset);
    window.addEventListener("crm:stale-session", stale);
    return () => {
      sessionChannel.current?.close();
      sessionRequest.current?.abort();
      window.removeEventListener("crm:unauthorized", reset);
      window.removeEventListener("crm:stale-session", stale);
    };
  }, [load]);
  async function switchWorkspace(id: string) {
    if (id === session?.workspace.id) return;
    setSwitching(true);
    try {
      const r = await mutate<
        Envelope<{ workspace: Entity; workspaces: Entity[] }>
      >("session/workspace", "POST", { workspace_id: id });
      setActiveWorkspace(r.data.workspace.id);
      history.replaceState({}, "", "/settings");
      setSession((s) => (s ? { ...s, ...r.data } : s));
      sessionChannel.current?.postMessage("refresh");
      toast.success("Empresa activa actualizada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSwitching(false);
    }
  }
  async function logout() {
    setSwitching(true);
    try {
      await mutate("auth/logout", "POST");
      sessionRequest.current?.abort();
      sessionChannel.current?.postMessage("logout");
      setActiveWorkspace(null);
      setSession(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSwitching(false);
    }
  }
  return (
    <>
      <Toaster richColors position="bottom-right" />
      {!ready || switching ? (
        <div className="full-loading">
          <Loading />
        </div>
      ) : initialError ? (
        <div className="connection-error">
          <ErrorBox message={initialError} retry={load} />
        </div>
      ) : session ? (
        <Shell
          key={session.workspace.id}
          session={session}
          switchWorkspace={switchWorkspace}
          logout={logout}
        />
      ) : (
        <Login
          onLogin={(s) => {
            setActiveWorkspace(s.workspace.id);
            setSession(s);
            sessionChannel.current?.postMessage("refresh");
          }}
        />
      )}
    </>
  );
}
function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const google = useResource<{ configured: boolean }>("auth/google");
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("login_error");
    if (code) {
      const messages: Record<string, string> = {
        access_denied: "Has cancelado el acceso con Google.",
        not_allowed:
          "Esta cuenta de Google no tiene acceso al CRM. Contacta con el administrador.",
        invalid_state:
          "La solicitud de acceso ha caducado. Vuelve a intentarlo.",
        provider_error:
          "No se pudo completar el acceso con Google. Inténtalo de nuevo.",
      };
      setError(messages[code] || messages.provider_error);
      history.replaceState({}, "", location.pathname);
    }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await mutate<Envelope<Session>>("auth/login", "POST", {
        email: values.get("email"),
        password: values.get("password"),
      });
      onLogin(result.data);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-main">
        <div className="login-brand">
          <img src="/brand/gocrm.png" alt="" width={32} height={32} />
          gocrm
        </div>
        <div className="login-form">
          <div className="login-form-inner">
            <h1>Accede a tu cuenta</h1>
            <p>Introduce tu correo para entrar al CRM.</p>
            <form onSubmit={submit}>
              <label>
                Correo electrónico
                <Input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="tu@empresa.com"
                  required
                />
              </label>
              <label>
                Contraseña
                <Input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                />
              </label>
              {error && <ErrorBox message={error} />}
              <Button type="submit" disabled={busy}>
                {busy ? "Entrando…" : "Entrar"}
              </Button>
            </form>
            <div className="login-divider">O continúa con</div>
            <form
              action="/api/auth/google/start"
              method="post"
              className="!mt-0 !gap-3"
            >
              <Button
                type="submit"
                variant="outline"
                className="login-google"
                disabled={google.loading || !google.data?.configured}
              >
                <GoogleMark />
                Continuar con Google
              </Button>
            </form>
            {!google.loading && !google.data?.configured && (
              <p className="login-footnote">
                El acceso con Google estará disponible cuando el administrador
                configure la conexión.
              </p>
            )}
            {google.error && (
              <p className="login-footnote">
                No se ha podido comprobar la conexión con Google.
              </p>
            )}
            {process.env.NEXT_PUBLIC_CRM_DEMO === "true" && (
              <p className="login-footnote">
                Entorno de demostración · datos de ejemplo
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="login-secondary" aria-hidden="true" />
    </main>
  );
}
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="currentColor"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.2 3-7.4ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22ZM6.4 13.8A6 6 0 0 1 6.1 12c0-.6.1-1.2.3-1.8V7.6H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l3.3-2.6ZM12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.6l3.3 2.6A6 6 0 0 1 12 6Z"
      />
    </svg>
  );
}
function Shell({
  session,
  switchWorkspace,
  logout,
}: {
  session: Session;
  switchWorkspace: (id: string) => void;
  logout: () => void;
}) {
  const [route, setRoute] = useState<CRMRoute>(() =>
    readRoute(location.pathname, location.search),
  );
  const view = route.view;
  useEffect(() => {
    const read = () => setRoute(readRoute(location.pathname, location.search));
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const [actionContainer, setActionContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [breadcrumbContainer, setBreadcrumbContainer] =
    useState<HTMLDivElement | null>(null);
  function navigate(href: string, replace = false) {
    if (replace) history.replaceState({}, "", href);
    else history.pushState({}, "", href);
    setRoute(readRoute(location.pathname, location.search));
  }
  function go(id: string) {
    navigate(routeHref({ view: id, mode: "list" }));
  }
  useEffect(() => {
    document.getElementById("main")?.scrollTo(0, 0);
  }, [route.view, route.id, route.mode]);
  return (
    <RecordNavigation.Provider
      value={{
        route,
        navigate,
        actions: actionContainer,
        breadcrumb: breadcrumbContainer,
      }}
    >
      <SidebarProvider
        defaultOpen
        style={{ "--sidebar-width": "196px" } as React.CSSProperties}
      >
        <a href="#main" className="skip-link">
          Saltar al contenido
        </a>
        <WorkspaceSidebar
          session={session}
          view={view}
          navigation={navigation}
          onNavigate={go}
          onLogout={logout}
        />
        <SidebarInset className="h-svh max-h-svh overflow-hidden !bg-transparent p-1 !shadow-none md:!m-0 md:!rounded-none">
          <div className="content-panel">
            <header
              className={`workspace-header ${view === "dashboard" ? "home-header" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger
                  aria-label="Mostrar u ocultar menú"
                  className="size-6 text-muted-foreground md:hidden"
                />
                <div
                  ref={setBreadcrumbContainer}
                  className="shell-breadcrumb"
                />
                {route.mode === "list" && (
                  <span className="shell-title">
                    {navigation.find((item) => item.id === view)?.label ||
                      "Configuración"}
                  </span>
                )}
              </div>
              <div ref={setActionContainer} className="header-actions" />
            </header>
            <div id="main" className="page">
              {!route.valid ? (
                <ErrorBox message="Esta página no existe." />
              ) : route.mode !== "list" ? (
                <RecordRouteView
                  key={`${route.view}-${route.id}-${route.mode}`}
                />
              ) : view === "dashboard" ? (
                <Dashboard go={go} session={session} />
              ) : view === "settings" ? (
                <div className="stack-lg">
                  <SettingsView
                    session={session}
                    switchWorkspace={switchWorkspace}
                  />
                </div>
              ) : (
                <Collection
                  key={view}
                  kind={view}
                  actionContainer={actionContainer}
                />
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RecordNavigation.Provider>
  );
}
function RecordRouteView() {
  const { route, navigate } = useRecordNavigation();
  const isContact = route.view === "contacts" && route.mode === "detail";
  const isMessage = route.view === "messages";
  const detail = useResource<Entity>(
    route.id && !isContact && !isMessage ? `${route.view}/${route.id}` : null,
  );
  const back = () => navigate(parentRoute(route));
  const saved = (record: Entity) =>
    navigate(routeHref({ ...route, id: record.id, mode: "detail" }), true);
  if (isContact) return <ContactDetail id={route.id!} />;
  if (isMessage) return <MessageDetail id={route.id!} onClose={back} />;
  if (route.id && (detail.loading || detail.error))
    return (
      <RecordPage
        title={detail.error ? "Registro no disponible" : "Cargando ficha…"}
      >
        {detail.error ? <ErrorBox message={detail.error} /> : <Loading />}
      </RecordPage>
    );
  if (route.mode === "affiliation")
    return (
      <AffiliationEditor contactId={route.id!} onClose={back} onSaved={back} />
    );
  if (route.mode === "new" || route.mode === "edit") {
    return route.view === "quotes" ? (
      <QuoteEditor
        record={detail.data || undefined}
        onClose={back}
        onSaved={saved}
      />
    ) : (
      <RecordEditor
        kind={route.view}
        record={detail.data || undefined}
        onClose={back}
        onSaved={saved}
      />
    );
  }
  return detail.data ? (
    <EntityDetail kind={route.view} record={detail.data} />
  ) : null;
}
interface DashboardData {
  contacts_count: number;
  companies_count: number;
  open_opportunities_count: number;
  pipeline_value_minor: number;
  tasks_due_count: number;
  recent_activities: Entity[];
  upcoming_tasks: Entity[];
}
function PageHeading({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof Users;
}) {
  return (
    <div className="page-heading">
      <span className="page-icon">
        <Icon size={22} />
      </span>
      <h1>{title}</h1>
    </div>
  );
}
function Dashboard({
  go,
  session,
}: {
  go: (v: string) => void;
  session: Session;
}) {
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useResource<DashboardData>(
    "dashboard",
    revision,
  );
  if (loading) return <Loading />;
  if (error)
    return <ErrorBox message={error} retry={() => setRevision((v) => v + 1)} />;
  if (!data) return null;
  return (
    <div className="stack-lg dashboard-page">
      <section className="dashboard-welcome">
        <div className="welcome-workspace">
          <span className="workspace-mark">N</span>
          <span>{session.workspace.name}</span>
          <Badge>gocrm</Badge>
        </div>
        <h1>
          Hola, {name(session.user).split(" ")[0]}.<br />
          Tu actividad y tus próximos pasos.
        </h1>
        <div className="home-shortcuts">
          {[
            { id: "contacts", label: "Contactos", icon: Users },
            { id: "companies", label: "Clientes", icon: Building2 },
            { id: "tasks", label: "Agenda y tareas", icon: CheckCircle2 },
            { id: "quotes", label: "Presupuestos", icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => go(id)}>
              <span className={`shortcut-icon ${id}`}>
                <Icon size={19} />
              </span>
              {label}
              <ChevronRight size={14} className="muted" />
            </button>
          ))}
        </div>
      </section>
      <div className="stats">
        {[
          {
            label: "Contactos",
            value: data.contacts_count,
            icon: Users,
            route: "contacts",
            hint: "Contactos del espacio",
          },
          {
            label: "Clientes",
            value: data.companies_count,
            icon: Building2,
            route: "companies",
            hint: "Empresas registradas",
          },
          {
            label: "Oportunidades abiertas",
            value: data.open_opportunities_count,
            icon: Network,
            route: "opportunities",
            hint: "Pendientes de cierre",
          },
          {
            label: "Valor del pipeline",
            value: money(data.pipeline_value_minor),
            icon: ArrowUpRight,
            route: "opportunities",
            hint: "Importe de oportunidades abiertas",
          },
        ].map(({ label, value, icon: Icon, route, hint }) => (
          <button className="stat" key={label} onClick={() => go(route)}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Tareas pendientes</h2>
              <p>
                {data.tasks_due_count}{" "}
                {data.tasks_due_count === 1
                  ? "tarea vencida"
                  : "tareas vencidas"}
              </p>
            </div>
            <Button
              variant="ghost"
              className="h-auto p-0 text-xs font-normal"
              onClick={() => go("tasks")}
            >
              Ver agenda <ChevronRight size={15} />
            </Button>
          </div>
          {data.upcoming_tasks?.length ? (
            <div>
              {data.upcoming_tasks.map((t) => (
                <div className="task-row" key={t.id}>
                  <span className="task-bullet" />
                  <div>
                    <strong>{t.title}</strong>
                    <small>{date(t.due_at, true)}</small>
                  </div>
                  <Badge tone="neutral">Pendiente</Badge>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Todo al día"
              description="Añade tu próximo seguimiento a la agenda."
              action={
                <Button variant="outline" onClick={() => go("tasks")}>
                  Crear una tarea
                </Button>
              }
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Actividad reciente</h2>
              <p>Últimas notas que puedes consultar.</p>
            </div>
          </div>
          {data.recent_activities?.length ? (
            <div className="activity-list">
              {data.recent_activities.map((a, i) => (
                <div className="activity" key={a.id || i}>
                  <span className="activity-dot" />
                  <div>
                    <strong>
                      {a.title || a.body || a.name || "Actividad registrada"}
                    </strong>
                    <small>{date(a.created_at, true)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Sin actividad reciente"
              description="La actividad de tu equipo aparecerá en este espacio."
            />
          )}
        </section>
      </div>
    </div>
  );
}
function Collection({
  kind,
  actionContainer,
}: {
  kind: string;
  actionContainer: HTMLDivElement | null;
}) {
  const { route, navigate } = useRecordNavigation();
  const [search, setSearch] = useState(route.q);
  const [revision, setRevision] = useState(0);
  const query = route.q,
    page = route.page,
    filter = route.status;
  function setPage(value: number | ((page: number) => number)) {
    navigate(
      routeHref({
        ...route,
        page: typeof value === "function" ? value(page) : value,
      }),
    );
  }
  function setFilter(value: string) {
    navigate(routeHref({ ...route, status: value, page: 1 }));
  }
  function create() {
    navigate(routeHref({ ...route, mode: "new" }));
  }
  function recordHref(record: Entity) {
    return routeHref({ ...route, id: record.id, mode: "detail" });
  }
  useEffect(() => {
    setSearch(route.q);
  }, [route.q]);
  const [result, setResult] = useState<Envelope<Entity[]> | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    if (search === route.q) return;
    const timer = setTimeout(
      () => navigate(routeHref({ ...route, q: search, page: 1 }), true),
      250,
    );
    return () => clearTimeout(timer);
  }, [search, route.q]);
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    api<Envelope<Entity[]>>(
      `${kind}?search=${encodeURIComponent(query)}&page=${page}&per_page=20${filter !== "all" ? `&status=${encodeURIComponent(filter)}` : ""}`,
      { signal: ac.signal },
    )
      .then((r) => {
        if (!ac.signal.aborted) setResult(r);
      })
      .catch((e) => {
        if (!ac.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [kind, query, page, revision, filter]);
  const companyLookup = useResource<Entity[]>(
    kind === "opportunities" ? "companies?per_page=100" : null,
    revision,
  );
  const refresh = () => setRevision((v) => v + 1);
  const records = result?.data || [];
  function open(record: Entity) {
    navigate(recordHref(record));
  }
  async function toggle(t: Entity) {
    try {
      await mutate(`tasks/${t.id}`, "PATCH", {
        status: t.status === "completed" ? "pending" : "completed",
      });
      refresh();
      toast.success(
        t.status === "completed" ? "Tarea reabierta" : "Tarea completada",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="stack collection-page">
      <PageHeading
        title={navigation.find((n) => n.id === kind)?.label || kind}
        icon={navigation.find((n) => n.id === kind)?.icon || Users}
      />
      {kind !== "messages" &&
        actionContainer &&
        createPortal(
          <Button size="sm" className="px-4" onClick={create}>
            <Plus size={14} />
            {["tasks", "opportunities"].includes(kind) ? "Nueva" : "Nuevo"}{" "}
            {singular[kind]}
          </Button>,
          actionContainer,
        )}
      <div className="toolbar">
        <div className="toolbar-left">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={`Buscar ${navigation.find((n) => n.id === kind)?.label.toLowerCase()}…`}
          />
          {["tasks", "companies"].includes(kind) && (
            <div
              className="filter-chips"
              role="group"
              aria-label="Filtrar por estado"
            >
              {[
                ["all", "Todos"],
                ...(kind === "tasks"
                  ? [
                      ["pending", "Pendientes"],
                      ["completed", "Completadas"],
                    ]
                  : [
                      ["prospect", "Potenciales"],
                      ["active", "Activos"],
                      ["inactive", "Inactivos"],
                    ]),
              ].map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant="outline"
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
      {kind === "messages" && (
        <div className="notice">
          <LockKeyhole size={17} />
          <span>
            Solo tú, los participantes y las personas autorizadas pueden ver
            cada mensaje. Compartirlo no comparte el hilo completo.
          </span>
        </div>
      )}
      {error ? (
        <ErrorBox message={error} retry={refresh} />
      ) : loading ? (
        <Loading />
      ) : !records.length ? (
        <div className="panel">
          <Empty
            title={
              query
                ? "No hay coincidencias"
                : kind === "messages"
                  ? "Tu bandeja privada está lista"
                  : "Todavía no hay registros"
            }
            description={
              query
                ? "Prueba con otro nombre o término."
                : kind === "messages"
                  ? "Conecta Gmail desde Configuración para sincronizar tus conversaciones autorizadas."
                  : `Añade ${["tasks", "opportunities"].includes(kind) ? "tu primera" : "tu primer"} ${singular[kind]} para empezar.`
            }
            action={
              kind !== "messages" && !query ? (
                <Button onClick={create}>
                  <Plus size={16} />
                  Añadir {singular[kind]}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : kind === "opportunities" ? (
        <div className="pipeline">
          {Object.entries(stages).map(([stage, label]) => {
            const rows = records.filter((r) => r.stage === stage);
            return (
              <section className={`pipeline-column ${stage}`} key={stage}>
                <header>
                  <strong>{label}</strong>
                  <Badge>{rows.length}</Badge>
                </header>
                <small>
                  {money(rows.reduce((a, r) => a + (r.value_minor || 0), 0))}
                </small>
                {rows.map((r) => (
                  <button
                    key={r.id}
                    className="opportunity-card"
                    onClick={() => open(r)}
                  >
                    <strong>{r.title}</strong>
                    <span>
                      {companyLookup.data?.find((c) => c.id === r.company_id)
                        ?.name ||
                        (r.company_id
                          ? "Cliente vinculado"
                          : "Sin cliente asociado")}
                    </span>
                    <b>{money(r.value_minor, r.currency)}</b>
                    <footer>
                      <span>{date(r.expected_close_on)}</span>
                      <ArrowUpRight size={15} />
                    </footer>
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      ) : kind === "events" ? (
        <div className="event-grid">
          {records.map((r) => (
            <button className="event-card" key={r.id} onClick={() => open(r)}>
              <div className="event-date">
                <CalendarDays size={22} />
                <span>{date(r.starts_at)}</span>
              </div>
              <h2>{r.name}</h2>
              <p>{r.location || "Ubicación por definir"}</p>
              <span className="muted">
                {r.contact_ids?.length || 0} contactos vinculados
              </span>
              <span className="text-button">
                Ver y editar evento <ArrowUpRight size={16} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                {(kind === "contacts"
                  ? ["Nombre", "Empresa", "Cargo", "Email", "Teléfono", ""]
                  : kind === "companies"
                    ? ["Cliente", "Sector", "Estado", "Web"]
                    : kind === "messages"
                      ? ["Remitente", "Asunto", "Recibido", "Acceso"]
                      : kind === "tasks"
                        ? ["Completar", "Tarea", "Fecha", "Estado"]
                        : ["Presupuesto", "Estado", "Importe", ""]
                ).map((v, i) => (
                  <TableHead
                    key={i}
                    className="font-normal text-muted-foreground"
                  >
                    {v}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  {kind === "contacts" ? (
                    <>
                      <TableCell>
                        <RecordLink
                          className="person-cell"
                          href={recordHref(r)}
                        >
                          <Avatar label={name(r)} />
                          <span>
                            <strong>{name(r)}</strong>
                          </span>
                        </RecordLink>
                      </TableCell>
                      <TableCell>
                        <strong>
                          {r.affiliations?.find((a) => !a.ended_on)
                            ?.company_name ||
                            r.affiliations?.find((a) => !a.ended_on)?.company
                              ?.name ||
                            "Sin empresa vinculada"}
                        </strong>
                      </TableCell>
                      <TableCell>{r.job_title || "—"}</TableCell>
                      <TableCell className="muted">{r.email || "—"}</TableCell>
                      <TableCell className="muted">{r.phone || "—"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => open(r)}
                          aria-label={`Ver ${name(r)}`}
                        >
                          <ChevronRight size={18} />
                        </Button>
                      </TableCell>
                    </>
                  ) : kind === "companies" ? (
                    <>
                      <TableCell>
                        <RecordLink
                          className="person-cell"
                          href={recordHref(r)}
                        >
                          <span className="company-avatar">
                            <Building2 size={19} />
                          </span>
                          <strong>{r.name}</strong>
                        </RecordLink>
                      </TableCell>
                      <TableCell>{r.industry || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          tone={r.status === "active" ? "green" : "neutral"}
                        >
                          {(
                            {
                              active: "Activo",
                              prospect: "Potencial",
                              inactive: "Inactivo",
                            } as Record<string, string>
                          )[r.status || ""] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.domain || "—"}</TableCell>
                    </>
                  ) : kind === "messages" ? (
                    <>
                      <TableCell>
                        <RecordLink
                          className="person-cell"
                          href={recordHref(r)}
                        >
                          <Avatar
                            label={r.from_name || r.from_email || "?"}
                            small
                          />
                          <span>
                            <strong>{r.from_name || r.from_email}</strong>
                            <small>{r.from_email}</small>
                          </span>
                        </RecordLink>
                      </TableCell>
                      <TableCell>
                        <RecordLink className="text-cell" href={recordHref(r)}>
                          {r.subject || "(Sin asunto)"}
                        </RecordLink>
                      </TableCell>
                      <TableCell>{date(r.received_at, true)}</TableCell>
                      <TableCell>
                        <Badge tone="neutral">
                          <LockKeyhole size={12} />
                          Restringido
                        </Badge>
                      </TableCell>
                    </>
                  ) : kind === "tasks" ? (
                    <>
                      <TableCell>
                        <button
                          className={`check-button ${r.status === "completed" ? "checked" : ""}`}
                          aria-label={
                            r.status === "completed"
                              ? "Reabrir tarea"
                              : "Completar tarea"
                          }
                          onClick={() => toggle(r)}
                        >
                          {r.status === "completed" && <Check size={15} />}
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          className={`text-cell ${r.status === "completed" ? "completed" : ""}`}
                          onClick={() => open(r)}
                        >
                          {r.title}
                        </button>
                      </TableCell>
                      <TableCell>{date(r.due_at, true)}</TableCell>
                      <TableCell>
                        <Badge
                          tone={r.status === "completed" ? "green" : "neutral"}
                        >
                          {r.status === "completed"
                            ? "Completada"
                            : "Pendiente"}
                        </Badge>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <RecordLink className="text-cell" href={recordHref(r)}>
                          {r.title}
                        </RecordLink>
                      </TableCell>
                      <TableCell>
                        <Badge
                          tone={r.status === "approved" ? "green" : "neutral"}
                        >
                          {(
                            {
                              draft: "Borrador",
                              approved: "Aprobado",
                              sent: "Enviado",
                            } as Record<string, string>
                          )[r.status || ""] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="money">
                        {money(r.total_minor, r.currency)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => open(r)}
                          aria-label="Ver presupuesto"
                        >
                          <ChevronRight size={18} />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {result && (
        <div className="pagination">
          <span>
            {result.meta?.total ?? result.data.length}{" "}
            {(result.meta?.total ?? result.data.length) === 1
              ? "registro"
              : "registros"}{" "}
            · Página {page}
          </span>
          <div>
            <Button
              variant="outline"
              size="xs"
              aria-label="Página anterior"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={14} /> Anterior
            </Button>
            <Button
              variant="outline"
              size="xs"
              aria-label="Página siguiente"
              disabled={
                page * (result.meta?.per_page || 20) >=
                (result.meta?.total ?? result.data.length)
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
