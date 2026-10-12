"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState, useId } from "react";
import { toast } from "sonner";
import {
  FileText,
  Network,
  Pencil,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Link2,
  LockKeyhole,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  api,
  mutate,
  Entity,
  Envelope,
  Session,
  QuoteItem,
  ApiError,
  name,
  money,
  date,
} from "@/lib/api";
import {
  Avatar,
  Badge,
  Empty,
  EntitySelect,
  ErrorBox,
  Field,
  Loading,
  Submit,
  useResource,
} from "./ui";
import {
  RecordPage,
  RecordSection,
  RecordFields,
  RecordLink,
  useRecordNavigation,
} from "./record-page";
import { routeHref } from "@/lib/record-route";
const recordIcons = {
  contacts: Users,
  companies: Building2,
  opportunities: Network,
  tasks: CheckCircle2,
  events: CalendarDays,
  quotes: FileText,
};
const stages: Record<string, string> = {
  new: "Nueva",
  qualified: "Cualificada",
  proposal: "Propuesta",
  won: "Ganada",
  lost: "Perdida",
};
function message(error: unknown) {
  if (
    error instanceof ApiError &&
    error.details &&
    typeof error.details === "object"
  ) {
    const details = Object.values(error.details)
      .flat()
      .filter((v) => typeof v === "string");
    return [error.message, ...details].join(" · ");
  }
  return (error as Error).message;
}
function localDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function RecordEditor({
  kind,
  record,
  onClose,
  onSaved,
}: {
  kind: string;
  record?: Entity;
  onClose: () => void;
  onSaved: (record: Entity) => void;
}) {
  const formId = useId();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [company, setCompany] = useState(record?.company_id || ""),
    [contact, setContact] = useState(record?.contact_id || ""),
    [attendees, setAttendees] = useState<string[]>(record?.contact_ids || []);
  const { data: contacts } = useResource<Entity[]>(
    kind === "events" ? "contacts?per_page=100" : null,
  );
  const labels: Record<string, string> = {
    contacts: "contacto",
    companies: "cliente",
    opportunities: "oportunidad",
    tasks: "tarea",
    events: "evento",
  };
  function input(
    field: keyof Entity,
    label: string,
    type = "text",
    required = false,
  ) {
    const value = record?.[field];
    return (
      <Field key={field} label={label}>
        <Input
          name={field}
          type={type}
          required={required}
          defaultValue={typeof value === "string" ? value : ""}
          maxLength={type === "url" ? 2048 : 255}
        />
      </Field>
    );
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(fd);
    if (["opportunities", "tasks"].includes(kind)) {
      payload.company_id = company || null;
      payload.contact_id = contact || null;
    }
    if (kind === "opportunities") {
      payload.value_minor = Math.round(Number(fd.get("amount")) * 100);
      delete payload.amount;
      payload.currency = "EUR";
      payload.expected_close_on = fd.get("expected_close_on") || null;
    }
    if (kind === "tasks")
      payload.due_at = fd.get("due_at")
        ? new Date(String(fd.get("due_at"))).toISOString()
        : null;
    if (kind === "events") {
      payload.starts_at = new Date(String(fd.get("starts_at"))).toISOString();
      payload.contact_ids = attendees;
    }
    setBusy(true);
    setError("");
    try {
      const response = await mutate<Envelope<Entity>>(
        `${kind}${record ? `/${record.id}` : ""}`,
        record ? "PATCH" : "POST",
        payload,
      );
      toast.success("Cambios guardados");
      onSaved(response.data);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <RecordPage
      icon={recordIcons[kind as keyof typeof recordIcons]}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" type="submit" form={formId} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
      title={`${record ? "Editar" : ["tasks", "opportunities"].includes(kind) ? "Nueva" : "Nuevo"} ${labels[kind]}`}
      onBack={onClose}
    >
      <form id={formId} onSubmit={submit} className="record-section stack">
        <h2>Datos de la ficha</h2>
        <div className="form-grid">
          {kind === "contacts" ? (
            <>
              {input("first_name", "Nombre", "text", true)}
              {input("last_name", "Apellidos")}
              {input("email", "Correo electrónico", "email")}
              {input("phone", "Teléfono", "tel")}
              {input("job_title", "Cargo")}
              {input("linkedin_url", "Perfil de LinkedIn", "url")}
            </>
          ) : kind === "companies" ? (
            <>
              {input("name", "Nombre del cliente", "text", true)}
              {input("industry", "Sector")}
              {input("domain", "Dominio (ejemplo.com)")}
              {input("website", "Sitio web", "url")}
              <Field label="Estado">
                <select
                  name="status"
                  defaultValue={record?.status || "prospect"}
                >
                  <option value="prospect">Potencial</option>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </Field>
            </>
          ) : kind === "opportunities" ? (
            <>
              {input("title", "Nombre de la oportunidad", "text", true)}
              <Field label="Etapa">
                <select name="stage" defaultValue={record?.stage || "new"}>
                  {Object.entries(stages).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Importe estimado (€)">
                <Input
                  name="amount"
                  type="number"
                  min="0"
                  max="999999999"
                  step="0.01"
                  defaultValue={(record?.value_minor || 0) / 100}
                  required
                />
              </Field>
              <Field label="Cierre previsto">
                <Input
                  name="expected_close_on"
                  type="date"
                  defaultValue={record?.expected_close_on?.slice(0, 10) || ""}
                />
              </Field>
            </>
          ) : kind === "tasks" ? (
            <>
              <div className="span-2">
                {input("title", "¿Qué tienes pendiente?", "text", true)}
              </div>
              <Field label="Fecha y hora">
                <Input
                  name="due_at"
                  type="datetime-local"
                  defaultValue={localDateTime(record?.due_at)}
                />
              </Field>
              <Field label="Estado">
                <select
                  name="status"
                  defaultValue={record?.status || "pending"}
                >
                  <option value="pending">Pendiente</option>
                  <option value="completed">Completada</option>
                </select>
              </Field>
            </>
          ) : (
            <>
              {input("name", "Nombre del evento", "text", true)}
              {input("location", "Lugar")}
              <Field label="Fecha y hora">
                <Input
                  name="starts_at"
                  type="datetime-local"
                  required
                  defaultValue={localDateTime(record?.starts_at)}
                />
              </Field>
            </>
          )}
          {["opportunities", "tasks"].includes(kind) && (
            <>
              <EntitySelect
                label="Cliente"
                endpoint="companies"
                value={company}
                onChange={setCompany}
              />
              <EntitySelect
                label="Contacto"
                endpoint="contacts"
                value={contact}
                onChange={setContact}
              />
            </>
          )}
        </div>
        {["contacts", "companies", "events"].includes(kind) && (
          <Field label="Notas de la ficha (visibles en este espacio)">
            <textarea
              name="notes"
              rows={4}
              defaultValue={record?.notes || ""}
            />
          </Field>
        )}
        {kind === "events" && (
          <fieldset>
            <legend>Contactos que esperas encontrar</legend>
            <p className="muted">
              Prepara las personas y el contexto antes del encuentro.
            </p>
            <div className="attendee-list">
              {contacts?.map((c) => (
                <label className="checkbox-label" key={c.id}>
                  <input
                    type="checkbox"
                    checked={attendees.includes(c.id)}
                    onChange={(e) =>
                      setAttendees((a) =>
                        e.target.checked
                          ? [...a, c.id]
                          : a.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {name(c)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {kind === "contacts" && (
          <p className="muted small-text">
            Las relaciones con empresas y su historial se añaden desde la ficha
            del contacto.
          </p>
        )}
        {error && <ErrorBox message={error} />}
        <div className="form-actions">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Submit
            busy={busy}
            label={record ? "Guardar cambios" : `Crear ${labels[kind]}`}
          />
        </div>
      </form>
    </RecordPage>
  );
}
export function ContactDetail({ id }: { id: string }) {
  const { route, navigate } = useRecordNavigation();
  const [revision, setRevision] = useState(0);
  const [noteBusy, setNoteBusy] = useState(false),
    [noteError, setNoteError] = useState("");
  const noteKey = useRef(crypto.randomUUID());
  const {
    data: contact,
    error,
    loading,
  } = useResource<Entity>(`contacts/${id}`, revision);
  const tab = route.tab === "messages" ? "messages" : "notes";
  const notes = useResource<Entity[]>(
    `notes?contact_id=${id}&per_page=100`,
    revision,
  );
  const messages = useResource<Entity[]>(
    tab === "messages" ? `messages?contact_id=${id}&per_page=100` : null,
    revision,
  );
  async function saveNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setNoteBusy(true);
    setNoteError("");
    try {
      await mutate("notes", "POST", {
        contact_id: id,
        body: fd.get("body"),
        visibility: fd.get("visibility"),
        client_request_id: noteKey.current,
      });
      form.reset();
      noteKey.current = crypto.randomUUID();
      setRevision((v) => v + 1);
      toast.success("Nota guardada");
    } catch (e) {
      setNoteError(message(e));
    } finally {
      setNoteBusy(false);
    }
  }
  async function endRelation(relationId: string) {
    try {
      await mutate(`affiliations/${relationId}`, "PATCH", {
        ended_on: new Date().toISOString().slice(0, 10),
      });
      setRevision((v) => v + 1);
      toast.success("Relación profesional finalizada; historial conservado");
    } catch (e) {
      toast.error(message(e));
    }
  }
  if (loading || error || !contact)
    return (
      <RecordPage
        title={error ? "Contacto no disponible" : "Cargando contacto…"}
        icon={Users}
      >
        {error ? <ErrorBox message={error} /> : <Loading />}
      </RecordPage>
    );
  return (
    <RecordPage
      title={name(contact)}
      avatar={name(contact)}
      icon={Users}
      badge={contact.job_title}
      actions={
        <Button size="sm" variant="outline" asChild>
          <RecordLink href={routeHref({ ...route, mode: "edit" })}>
            <Pencil size={14} />
            Editar contacto
          </RecordLink>
        </Button>
      }
    >
      <RecordSection title="Datos" id="datos">
        <RecordFields
          fields={[
            ["Nombre", contact.first_name],
            ["Apellidos", contact.last_name],
            ["Cargo", contact.job_title],
            [
              "Email",
              contact.email ? (
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              ) : null,
            ],
            [
              "Teléfono",
              contact.phone ? (
                <a href={`tel:${contact.phone}`}>{contact.phone}</a>
              ) : null,
            ],
            [
              "LinkedIn",
              contact.linkedin_url &&
              /^https?:\/\//.test(contact.linkedin_url) ? (
                <a href={contact.linkedin_url} target="_blank" rel="noreferrer">
                  Ver perfil <ExternalLink size={12} className="inline" />
                </a>
              ) : null,
            ],
          ]}
        />
      </RecordSection>
      <RecordSection
        title="Relaciones profesionales"
        count={contact.affiliations?.length || 0}
        id="relaciones"
        description="Relaciones actuales e históricas con tus clientes."
        actions={
          <Button variant="outline" size="sm" asChild>
            <RecordLink href={routeHref({ ...route, mode: "affiliation" })}>
              <Plus size={14} />
              Añadir relación
            </RecordLink>
          </Button>
        }
      >
        {contact.affiliations?.length ? (
          <div className="relationship-list">
            {contact.affiliations.map((a) => (
              <div className="relationship-row" key={a.id}>
                <Building2 size={16} className="muted" />
                <div>
                  <RecordLink
                    className="record-text-link"
                    href={routeHref({
                      view: "companies",
                      id: a.company_id,
                      mode: "detail",
                    })}
                  >
                    {a.company_name || a.company?.name || "Ver cliente"}
                  </RecordLink>
                  <span className="muted">
                    {a.role || "Sin cargo indicado"}
                  </span>
                  <small>
                    {a.started_on ? date(a.started_on) : "Sin fecha de inicio"}{" "}
                    — {a.ended_on ? date(a.ended_on) : "Actualidad"}
                  </small>
                </div>
                <Badge tone={a.ended_on ? "neutral" : "green"}>
                  {a.ended_on ? "Histórica" : "Actual"}
                </Badge>
                {!a.ended_on && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => endRelation(a.id)}
                  >
                    Finalizar relación
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Todavía sin empresas vinculadas.</p>
        )}
      </RecordSection>
      {contact.notes && (
        <RecordSection title="Notas de la ficha">
          <p className="plain-text">{contact.notes}</p>
          <small>Visibles en este espacio de trabajo.</small>
        </RecordSection>
      )}
      <RecordSection title="Actividad" id="actividad">
        <div
          className="record-tabs"
          role="group"
          aria-label="Actividad del contacto"
        >
          <Button
            variant="outline"
            size="sm"
            aria-pressed={tab === "notes"}
            onClick={() =>
              navigate(routeHref({ ...route, tab: undefined }), true)
            }
          >
            Notas y contexto
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={tab === "messages"}
            onClick={() =>
              navigate(routeHref({ ...route, tab: "messages" }), true)
            }
          >
            Correo autorizado
          </Button>
        </div>
        {tab === "notes" ? (
          <>
            <form className="note-form" onSubmit={saveNote}>
              <label htmlFor="note-body">Nueva nota</label>
              <textarea
                id="note-body"
                name="body"
                placeholder="¿Qué te gustaría recordar de esta persona?"
                rows={3}
                required
                maxLength={20000}
              />
              <div>
                <label className="select-inline">
                  <LockKeyhole size={14} />
                  <select name="visibility" aria-label="Visibilidad de la nota">
                    <option value="private">Solo yo</option>
                    <option value="workspace">Todo el espacio</option>
                  </select>
                </label>
                <Submit busy={noteBusy} label="Añadir nota" />
              </div>
              {noteError && <ErrorBox message={noteError} />}
            </form>
            {notes.loading ? (
              <Loading />
            ) : notes.error ? (
              <ErrorBox message={notes.error} />
            ) : notes.data?.length ? (
              <div className="notes-list">
                {notes.data.map((n) => (
                  <article className="note" key={n.id}>
                    <header>
                      <Avatar label={n.author_name || "Usuario"} small />
                      <strong>{n.author_name || "Nota"}</strong>
                      <Badge>
                        {n.visibility === "private" ? "Privada" : "Equipo"}
                      </Badge>
                    </header>
                    <p className="plain-text">{n.body}</p>
                    <small>{date(n.created_at, true)}</small>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Sin notas todavía"
                description="Anota el contexto que quieras recordar para vuestro próximo encuentro."
              />
            )}
          </>
        ) : messages.loading ? (
          <Loading />
        ) : messages.error ? (
          <ErrorBox message={messages.error} />
        ) : messages.data?.length ? (
          <div className="record-messages">
            {messages.data.map((m) => (
              <RecordLink
                key={m.id}
                href={routeHref({
                  view: "messages",
                  id: m.id,
                  mode: "detail",
                  contact: id,
                })}
              >
                <Mail size={16} />
                <div>
                  <strong>{m.subject}</strong>
                  <small>
                    {m.from_name || m.from_email} · {date(m.received_at)}
                  </small>
                </div>
                <LockKeyhole size={14} />
              </RecordLink>
            ))}
          </div>
        ) : (
          <Empty
            title="Sin conversaciones visibles"
            description="Solo aparecen los mensajes en los que participas o que han compartido contigo."
          />
        )}
      </RecordSection>
    </RecordPage>
  );
}
export function AffiliationEditor({
  contactId,
  onClose,
  onSaved,
}: {
  contactId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [company, setCompany] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await mutate(`contacts/${contactId}/affiliations`, "POST", {
        company_id: company,
        role: fd.get("role"),
        started_on: fd.get("started_on") || null,
        ended_on: fd.get("ended_on") || null,
      });
      toast.success("Relación añadida");
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <RecordPage
      title="Añadir relación profesional"
      icon={Building2}
      onBack={onClose}
    >
      <form className="record-section stack" onSubmit={submit}>
        <p className="muted">
          Una persona puede pertenecer a varias empresas a la vez. Conservamos
          cada relación por separado.
        </p>
        <EntitySelect
          label="Empresa"
          endpoint="companies"
          required
          value={company}
          onChange={setCompany}
        />
        <Field label="Cargo o relación">
          <Input name="role" required />
        </Field>
        <div className="form-grid">
          <Field label="Desde">
            <Input name="started_on" type="date" />
          </Field>
          <Field label="Hasta (vacío si está en activo)">
            <Input name="ended_on" type="date" />
          </Field>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Submit busy={busy} label="Añadir relación" />
        </div>
      </form>
    </RecordPage>
  );
}
export function MessageDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [revision, setRevision] = useState(0),
    [user, setUser] = useState(""),
    [busy, setBusy] = useState(false);
  const {
    data: m,
    error,
    loading,
  } = useResource<Entity>(`messages/${id}`, revision);
  const { data: members } = useResource<Entity[]>(
    m?.can_share ? "members?per_page=100" : null,
  );
  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate(`messages/${id}/grants`, "POST", { user_id: user });
      setUser("");
      setRevision((v) => v + 1);
      toast.success("Acceso a este mensaje concedido");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(grantId: string) {
    setBusy(true);
    try {
      await mutate(`messages/${id}/grants/${grantId}`, "DELETE");
      setRevision((v) => v + 1);
      toast.success("Acceso retirado");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <RecordPage
      title={
        m?.subject || (error ? "Mensaje no disponible" : "Conversación privada")
      }
      icon={Mail}
      badge={m ? "Acceso restringido" : undefined}
      onBack={onClose}
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        m && (
          <div className="record-section stack">
            <div className="message-heading">
              <div className="person-cell">
                <Avatar label={m.from_name || m.from_email || "?"} />
                <div>
                  <strong>{m.from_name || m.from_email}</strong>
                  <small>
                    {m.from_email} · {date(m.received_at, true)}
                  </small>
                </div>
              </div>
              <p className="muted">
                Para: {m.to?.join(", ") || "—"}
                {m.cc?.length ? ` · CC: ${m.cc.join(", ")}` : ""}
              </p>
            </div>
            <div className="message-body plain-text">
              {m.body_text || "Este mensaje no contiene texto."}
            </div>
            <section className="sharing">
              <h3>
                <Users size={17} />
                Quién puede ver este mensaje
              </h3>
              <div className="access-list">
                {m.participants?.map((p) => (
                  <div key={p.id}>
                    <Avatar label={name(p)} small />
                    <span>{name(p)}</span>
                    <Badge>Participante</Badge>
                  </div>
                ))}
                {m.grants?.map((g) => (
                  <div key={g.id}>
                    <Avatar label={g.name || "Usuario"} small />
                    <span>{g.name}</span>
                    <Badge tone="neutral">Compartido</Badge>
                    {m.can_share && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        onClick={() => revoke(g.id)}
                        aria-label={`Retirar acceso a ${g.name}`}
                      >
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {m.can_share ? (
                <form onSubmit={grant} className="sharing-form">
                  <label className="sr-only" htmlFor="share-member">
                    Compartir con
                  </label>
                  <select
                    id="share-member"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    required
                  >
                    <option value="">Selecciona una persona del equipo</option>
                    {members
                      ?.filter(
                        (u) =>
                          !m.participants?.some((p) => p.id === u.id) &&
                          !m.grants?.some((g) => g.user_id === u.id),
                      )
                      .map((u) => (
                        <option value={u.id} key={u.id}>
                          {name(u)} · {u.email}
                        </option>
                      ))}
                  </select>
                  <Submit busy={busy} label="Compartir mensaje" />
                </form>
              ) : (
                <p className="muted">
                  Solo los participantes originales pueden gestionar el acceso.
                </p>
              )}
              <p className="small-text muted">
                El permiso se aplica únicamente a este mensaje. No da acceso al
                resto del hilo ni a correos futuros.
              </p>
            </section>
          </div>
        )
      )}
    </RecordPage>
  );
}
export function QuoteEditor({
  record,
  onClose,
  onSaved,
}: {
  record?: Entity;
  onClose: () => void;
  onSaved: (record: Entity) => void;
}) {
  const formId = useId();
  const detail = useResource<Entity>(record ? `quotes/${record.id}` : null);
  const source = detail.data || record;
  const [items, setItems] = useState<QuoteItem[]>([
      { description: "", quantity: 1, unit_price_minor: 0 },
    ]),
    [company, setCompany] = useState(record?.company_id || ""),
    [opportunity, setOpportunity] = useState(record?.opportunity_id || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (detail.data) {
      setItems(
        detail.data.items?.length
          ? detail.data.items
          : [{ description: "", quantity: 1, unit_price_minor: 0 }],
      );
      setCompany(detail.data.company_id || "");
      setOpportunity(detail.data.opportunity_id || "");
    }
  }, [detail.data]);
  function change(i: number, patch: Partial<QuoteItem>) {
    setItems((a) => a.map((v, j) => (i === j ? { ...v, ...patch } : v)));
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await mutate<Envelope<Entity>>(
        `quotes${record ? `/${record.id}` : ""}`,
        record ? "PATCH" : "POST",
        {
          title: fd.get("title"),
          company_id: company || null,
          opportunity_id: opportunity || null,
          status: fd.get("status"),
          currency: "EUR",
          notes: fd.get("notes"),
          items: items.map(({ description, quantity, unit_price_minor }) => ({
            description,
            quantity,
            unit_price_minor,
          })),
        },
      );
      toast.success(
        `Presupuesto guardado · Total sin impuestos: ${money(r.data.total_minor)}`,
      );
      onSaved(r.data);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <RecordPage
      icon={FileText}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} size="sm" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
      title={record ? "Editar presupuesto" : "Nuevo presupuesto"}
      onBack={onClose}
    >
      {record && detail.loading ? (
        <Loading />
      ) : detail.error ? (
        <ErrorBox message={detail.error} />
      ) : (
        <form id={formId} className="record-section stack" onSubmit={save}>
          <div className="form-grid">
            <Field label="Título de la propuesta">
              <Input name="title" required defaultValue={source?.title || ""} />
            </Field>
            <Field label="Estado">
              <select name="status" defaultValue={source?.status || "draft"}>
                <option value="draft">Borrador</option>
                <option value="approved">Aprobado</option>
                <option value="sent">Enviado</option>
              </select>
            </Field>
            <EntitySelect
              label="Cliente"
              endpoint="companies"
              value={company}
              onChange={setCompany}
            />
            <EntitySelect
              label="Oportunidad"
              endpoint="opportunities"
              value={opportunity}
              onChange={setOpportunity}
            />
          </div>
          <div className="quote-lines">
            <div className="quote-line-heading">
              <span>Concepto</span>
              <span>Cantidad</span>
              <span>Precio unitario (€)</span>
              <span />
            </div>
            {items.map((item, i) => (
              <div className="quote-line" key={i}>
                <Input
                  aria-label={`Descripción partida ${i + 1}`}
                  placeholder="Servicio o entregable"
                  value={item.description}
                  required
                  onChange={(e) => change(i, { description: e.target.value })}
                />
                <Input
                  aria-label={`Cantidad partida ${i + 1}`}
                  type="number"
                  min="0.01"
                  max="100000"
                  step="0.01"
                  required
                  value={item.quantity}
                  onChange={(e) =>
                    change(i, { quantity: Number(e.target.value) })
                  }
                />
                <Input
                  aria-label={`Precio partida ${i + 1}`}
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  required
                  value={item.unit_price_minor / 100}
                  onChange={(e) =>
                    change(i, {
                      unit_price_minor: Math.round(
                        Number(e.target.value) * 100,
                      ),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  disabled={items.length === 1}
                  onClick={() => setItems((a) => a.filter((_, j) => j !== i))}
                  aria-label={`Eliminar partida ${i + 1}`}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              className="h-auto p-0 text-xs font-normal"
              type="button"
              onClick={() =>
                setItems((a) => [
                  ...a,
                  { description: "", quantity: 1, unit_price_minor: 0 },
                ])
              }
            >
              <Plus size={16} />
              Añadir partida
            </Button>
          </div>
          <div className="quote-total">
            <div>
              <strong>
                {source?.total_minor === undefined
                  ? "Total sin impuestos"
                  : "Último total guardado · sin impuestos"}
              </strong>
              <small>
                El servidor calcula y confirma el importe al guardar.
              </small>
            </div>
            <strong>
              {source?.total_minor === undefined
                ? "Pendiente de guardar"
                : money(source.total_minor, source.currency)}
            </strong>
          </div>
          <Field label="Alcance, condiciones y exclusiones">
            <textarea
              name="notes"
              rows={4}
              defaultValue={source?.notes || ""}
            />
          </Field>
          <p className="muted small-text">
            La marca «Enviado» registra un envío realizado fuera del CRM. Esta
            versión no envía emails ni genera propuestas con IA.
          </p>
          {error && <ErrorBox message={error} />}
          <div className="form-actions">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Submit busy={busy} label="Guardar presupuesto" />
          </div>
        </form>
      )}
    </RecordPage>
  );
}
export function EntityDetail({
  kind,
  record,
}: {
  kind: string;
  record: Entity;
}) {
  const { route } = useRecordNavigation();
  const company = useResource<Entity>(
    record.company_id ? `companies/${record.company_id}` : null,
  );
  const contact = useResource<Entity>(
    record.contact_id ? `contacts/${record.contact_id}` : null,
  );
  const attendees = useResource<Entity[]>(
    kind === "events" && record.contact_ids?.length
      ? "contacts?per_page=100"
      : null,
  );
  const stateLabels: Record<string, string> = {
    prospect: "Potencial",
    active: "Activo",
    inactive: "Inactivo",
    pending: "Pendiente",
    completed: "Completada",
    draft: "Borrador",
    approved: "Aprobado",
    sent: "Enviado",
  };
  const linked = (view: string, value: Entity | null, id?: string | null) =>
    id ? (
      <RecordLink
        className="record-text-link"
        href={routeHref({ view, id, mode: "detail" })}
      >
        {value ? name(value) : "Ver registro vinculado"}
      </RecordLink>
    ) : null;
  let fields: [string, React.ReactNode][] = [];
  if (kind === "companies")
    fields = [
      ["Nombre", record.name],
      ["Sector", record.industry],
      ["Estado", stateLabels[record.status || ""]],
      ["Dominio", record.domain],
      [
        "Web",
        record.website && /^https?:\/\//.test(record.website) ? (
          <a href={record.website} target="_blank" rel="noreferrer">
            {record.website}
          </a>
        ) : (
          record.website
        ),
      ],
    ];
  if (kind === "opportunities")
    fields = [
      ["Oportunidad", record.title],
      ["Etapa", stages[record.stage || ""]],
      ["Importe estimado", money(record.value_minor, record.currency)],
      ["Cierre previsto", date(record.expected_close_on)],
      ["Cliente", linked("companies", company.data, record.company_id)],
      ["Contacto", linked("contacts", contact.data, record.contact_id)],
    ];
  if (kind === "tasks")
    fields = [
      ["Tarea", record.title],
      ["Estado", stateLabels[record.status || ""]],
      ["Fecha", date(record.due_at, true)],
      ["Cliente", linked("companies", company.data, record.company_id)],
      ["Contacto", linked("contacts", contact.data, record.contact_id)],
    ];
  if (kind === "events")
    fields = [
      ["Evento", record.name],
      ["Lugar", record.location],
      ["Fecha y hora", date(record.starts_at, true)],
    ];
  if (kind === "quotes")
    fields = [
      ["Título", record.title],
      ["Estado", stateLabels[record.status || ""]],
      ["Cliente", linked("companies", company.data, record.company_id)],
      [
        "Oportunidad",
        record.opportunity_id ? (
          <RecordLink
            className="record-text-link"
            href={routeHref({
              view: "opportunities",
              id: record.opportunity_id,
              mode: "detail",
            })}
          >
            Ver oportunidad
          </RecordLink>
        ) : null,
      ],
      ["Moneda", record.currency],
    ];
  return (
    <RecordPage
      title={name(record)}
      icon={recordIcons[kind as keyof typeof recordIcons]}
      badge={
        kind === "opportunities"
          ? stages[record.stage || ""]
          : stateLabels[record.status || ""]
      }
      actions={
        <Button variant="outline" size="sm" asChild>
          <RecordLink href={routeHref({ ...route, mode: "edit" })}>
            <Pencil size={14} />
            Editar
          </RecordLink>
        </Button>
      }
    >
      <RecordSection title="Datos">
        <RecordFields fields={fields} />
      </RecordSection>
      {kind === "quotes" && (
        <RecordSection title="Partidas" count={record.items?.length || 0}>
          <div className="record-line-table">
            <table>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Cantidad</th>
                  <th>Precio unitario</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {record.items?.map((item, i) => (
                  <tr key={i}>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unit_price_minor, record.currency)}</td>
                    <td>
                      {money(
                        Math.round(item.quantity * item.unit_price_minor),
                        record.currency,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="record-total">
            <span>Total sin impuestos</span>
            <strong>{money(record.total_minor, record.currency)}</strong>
          </div>
        </RecordSection>
      )}
      {kind === "events" && (
        <RecordSection
          title="Contactos del encuentro"
          count={record.contact_ids?.length || 0}
        >
          {attendees.loading && record.contact_ids?.length ? (
            <Loading />
          ) : attendees.error ? (
            <ErrorBox message={attendees.error} />
          ) : record.contact_ids?.length ? (
            <div className="record-messages">
              {record.contact_ids.map((id) => {
                const person = attendees.data?.find((c) => c.id === id);
                return (
                  <RecordLink
                    key={id}
                    href={routeHref({ view: "contacts", id, mode: "detail" })}
                  >
                    <Avatar label={person ? name(person) : "?"} small />
                    <div>
                      <strong>{person ? name(person) : "Ver contacto"}</strong>
                      {person?.job_title && <small>{person.job_title}</small>}
                    </div>
                  </RecordLink>
                );
              })}
            </div>
          ) : (
            <p className="muted">No hay contactos vinculados a este evento.</p>
          )}
        </RecordSection>
      )}
      <RecordSection
        title={
          kind === "quotes" ? "Alcance y condiciones" : "Notas de la ficha"
        }
      >
        <p className="plain-text muted">
          {record.notes || "Todavía no hay notas en esta ficha."}
        </p>
      </RecordSection>
    </RecordPage>
  );
}

interface Gmail {
  configured: boolean;
  connected: boolean;
  email?: string;
  last_synced_at?: string;
  status: string;
}
export function SettingsView({
  session,
  switchWorkspace,
}: {
  session: Session;
  switchWorkspace: (id: string) => void;
}) {
  const [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  const gmail = useResource<Gmail>("integrations/gmail", revision);
  const gmailStatus = gmail.data?.status;
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("gmail");
    if (!result) return;
    if (result === "connected") toast.success("Gmail conectado. Primera sincronización solicitada.");
    else if (result === "cancelled") toast.info("Conexión de Gmail cancelada.");
    else if (result === "account_mismatch") toast.error("Selecciona el buzón ya conectado. Para cambiar de cuenta, desconecta primero Gmail.");
    else toast.error("No se pudo conectar Gmail. Vuelve a intentarlo.");
    url.searchParams.delete("gmail");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  useEffect(() => {
    if (gmailStatus !== "queued" && gmailStatus !== "syncing") return;
    const timer = window.setInterval(() => setRevision((v) => v + 1), 5000);
    return () => window.clearInterval(timer);
  }, [gmailStatus]);
  async function connect() {
    setBusy(true);
    try {
      const r = await mutate<Envelope<{ authorization_url: string }>>(
        "integrations/gmail/connect",
        "POST",
      );
      const url = new URL(r.data.authorization_url);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com")
        throw new Error(
          "El servidor devolvió una dirección de autorización no válida.",
        );
      window.location.assign(url.href);
    } catch (e) {
      toast.error(message(e));
      setBusy(false);
    }
  }
  async function sync() {
    setBusy(true);
    try {
      await mutate("integrations/gmail/sync", "POST");
      toast.success(
        "Sincronización encolada. Actualiza el estado en unos instantes.",
      );
      setRevision((v) => v + 1);
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    try {
      await mutate("integrations/gmail", "DELETE");
      toast.success("Cuenta desconectada");
      setRevision((v) => v + 1);
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-page">
      <h1 className="sr-only">Configuración</h1>
      <section className="settings-group" id="perfil">
        <h2>Perfil</h2>
        <div className="settings-rows">
          <div className="settings-row">
            <div>
              <h3>Nombre</h3>
              <p>Tu cuenta en el CRM.</p>
            </div>
            <span>{name(session.user)}</span>
          </div>
          <div className="settings-row">
            <div>
              <h3>Correo electrónico</h3>
              <p>Dirección asociada a tu acceso.</p>
            </div>
            <span>{session.user.email}</span>
          </div>
        </div>
      </section>
      <section className="settings-group" id="empresa">
        <h2>Empresa</h2>
        <div className="settings-rows">
          <div className="settings-row">
            <div>
              <h3>Espacio de trabajo</h3>
              <p>
                Trabajas en una empresa cada vez. Sus contactos y actividad se
                mantienen separados.
              </p>
            </div>
            <select
              aria-label="Espacio de trabajo"
              value={session.workspace.id}
              onChange={(e) => switchWorkspace(e.target.value)}
            >
              {session.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
      <section className="settings-group" id="gmail">
        <h2>Gmail</h2>
        <div className="settings-rows">
          <div className="settings-row">
            <div>
              <h3>Conexión de correo</h3>
              <p>
                Importa conversaciones de contactos conocidos con acceso
                restringido a sus participantes.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Actualizar estado de Gmail"
              onClick={() => setRevision((v) => v + 1)}
            >
              <RefreshCw size={16} />
            </Button>
          </div>
          {gmail.loading ? (
            <Loading />
          ) : gmail.error ? (
            <div className="settings-row">
              <ErrorBox message={gmail.error} />
            </div>
          ) : (
            gmail.data && (
              <>
                <div className="settings-row">
                  <div>
                    <h3>
                      {gmail.data.connected
                        ? gmail.data.email
                        : "Cuenta de Gmail"}
                    </h3>
                    <p>
                      {gmail.data.connected
                        ? `Última sincronización: ${gmail.data.last_synced_at ? date(gmail.data.last_synced_at, true) : "Todavía sin sincronizar"}`
                        : gmail.data.configured
                          ? "Conecta tu cuenta para empezar."
                          : "El administrador debe configurar OAuth de Google para habilitar la conexión."}
                    </p>
                  </div>
                  <Badge tone={gmail.data.connected && !["sync_error", "reauthorization_required"].includes(gmail.data.status) ? "green" : "neutral"}>
                    {gmail.data.status === "reauthorization_required"
                      ? "Renueva el permiso"
                      : gmail.data.status === "sync_error"
                        ? "Error de sincronización"
                        : gmail.data.status === "queued"
                          ? "En cola"
                          : gmail.data.status === "syncing"
                            ? "Sincronizando"
                            : gmail.data.connected
                      ? "Conectada"
                      : gmail.data.configured
                        ? "Sin conectar"
                        : "Pendiente de configuración"}
                  </Badge>
                </div>
                <div className="settings-row">
                  <div>
                    <h3>Sincronización</h3>
                    <p>Conectar el buzón requiere tu autorización.</p>
                  </div>
                  <div className="button-row">
                    {gmail.data.connected ? (
                      <>
                        {gmail.data.status === "reauthorization_required" ? (
                          <Button size="sm" disabled={busy || !gmail.data.configured} onClick={connect}>
                            Volver a conectar Gmail
                          </Button>
                        ) : (
                          <Button size="sm" disabled={busy || ["queued", "syncing"].includes(gmail.data.status)} onClick={sync}>
                            {gmail.data.status === "sync_error" ? "Reintentar sincronización" : "Sincronizar"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={disconnect}
                        >
                          Desconectar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy || !gmail.data.configured}
                        onClick={connect}
                      >
                        <Link2 size={14} />
                        Conectar mi Gmail
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </section>
      <section className="settings-group" id="privacidad">
        <h2>Privacidad</h2>
        <div className="settings-rows">
          <div className="settings-row">
            <div>
              <h3>Acceso a los mensajes</h3>
              <p>
                Solo los participantes originales y las personas autorizadas
                pueden leer cada mensaje. Compartir uno no comparte el hilo
                completo.
              </p>
            </div>
            <LockKeyhole size={18} className="muted" />
          </div>
          <div className="settings-row">
            <div>
              <h3>Notas personales</h3>
              <p>
                Las notas son privadas por defecto. Puedes compartirlas con el
                espacio al guardarlas.
              </p>
            </div>
            <ShieldCheck size={18} className="muted" />
          </div>
        </div>
      </section>
    </div>
  );
}
