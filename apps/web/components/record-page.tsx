"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Badge } from "./ui";
import { parentRoute, type CRMRoute } from "@/lib/record-route";
export const RecordNavigation = createContext<{
  route: CRMRoute;
  navigate: (href: string, replace?: boolean) => void;
  actions: HTMLElement | null;
  breadcrumb: HTMLElement | null;
} | null>(null);
export function useRecordNavigation() {
  const context = useContext(RecordNavigation);
  if (!context) throw new Error("Record navigation is missing");
  return context;
}
export const sectionLabels: Record<string, string> = {
  contacts: "Contactos",
  companies: "Clientes",
  opportunities: "Oportunidades",
  messages: "Correo privado",
  tasks: "Agenda y tareas",
  events: "Eventos",
  quotes: "Presupuestos",
  settings: "Configuración",
  dashboard: "Resumen",
};
export function RecordLink({
  href,
  children,
  ...props
}: React.ComponentProps<"a"> & { href: string }) {
  const { navigate } = useRecordNavigation();
  function click(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  }
  return (
    <a {...props} href={href} onClick={click}>
      {children}
    </a>
  );
}
export function RecordPage({
  title,
  children,
  icon: Icon = FileText,
  avatar,
  badge,
  actions,
  onBack,
  backLabel,
}: {
  title: string;
  children: ReactNode;
  icon?: LucideIcon;
  avatar?: string;
  badge?: string;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  const {
    route,
    navigate,
    actions: actionContainer,
    breadcrumb,
  } = useRecordNavigation();
  const heading = useRef<HTMLHeadingElement>(null);
  const parent = parentRoute(route);
  const label =
    backLabel ||
    (route.mode === "edit" || route.mode === "affiliation"
      ? "Volver a la ficha"
      : route.contact
        ? "Volver al contacto"
        : sectionLabels[route.view]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [route.view, route.id, route.mode]);
  useEffect(() => {
    document.title = `${title} · gocrm`;
    return () => {
      document.title = "gocrm";
    };
  }, [title]);
  return (
    <article className="record-page">
      {breadcrumb &&
        createPortal(
          <nav aria-label="Ruta de navegación" className="record-breadcrumb">
            <RecordLink href={parent}>
              {route.contact
                ? "Contacto"
                : route.mode === "edit" || route.mode === "affiliation"
                  ? "Ficha"
                  : sectionLabels[route.view]}
            </RecordLink>
            <ChevronRight size={12} />
            <span aria-current="page">{title}</span>
          </nav>,
          breadcrumb,
        )}
      {actions && actionContainer && createPortal(actions, actionContainer)}
      <a
        className="record-back"
        href={parent}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          onBack ? onBack() : navigate(parent);
        }}
      >
        <ChevronLeft size={14} />
        {label}
      </a>
      <header className="record-identity">
        <span className="page-icon">
          <Icon size={22} />
        </span>
        {avatar && <Avatar label={avatar} />}
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {badge && <Badge>{badge}</Badge>}
      </header>
      <div className="record-content">{children}</div>
    </article>
  );
}
export function RecordSection({
  title,
  children,
  actions,
  count,
  description,
  id,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  count?: number;
  description?: string;
  id?: string;
}) {
  return (
    <section className="record-section" id={id}>
      <header>
        <div>
          <h2>
            {title}
            {count !== undefined && <Badge>{count}</Badge>}
          </h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
export function RecordFields({ fields }: { fields: [string, ReactNode][] }) {
  return (
    <dl className="record-fields">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
