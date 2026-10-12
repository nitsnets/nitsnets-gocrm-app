"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge as BaseBadge } from "@/components/ui/badge";
import { useEffect, useRef, useState, useId } from "react";
import {
  X,
  LoaderCircle,
  Search,
  Inbox,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { api, Envelope, Entity } from "@/lib/api";
export function useResource<T>(path: string | null, revision = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    setLoading(true);
    if (!path) {
      setLoading(false);
      return;
    }
    api<Envelope<T>>(path, { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setData(r.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  return { data, error, loading };
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={20} />
        </Button>
      </header>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>Cargando información…</span>
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div className="error-content">
        <p className="error-message">{message}</p>
        {retry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="error-retry"
            onClick={retry}
          >
            <RotateCw size={14} aria-hidden="true" />
            Reintentar
          </Button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "Todavía no hay registros",
  description = "Empieza añadiendo el primero.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Avatar({
  label,
  small = false,
}: {
  label: string;
  small?: boolean;
}) {
  return (
    <span className={`avatar ${small ? "small" : ""}`}>
      {label
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((v) => v[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <BaseBadge
      variant="secondary"
      className={`badge rounded-md ${tone === "green" ? "bg-emerald-50 text-emerald-700" : "text-muted-foreground"}`}
    >
      {children}
    </BaseBadge>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <Search size={17} />
      <Input
        className="h-7 rounded-md pl-8 text-xs"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function EntitySelect({
  label,
  endpoint,
  value,
  onChange,
  required = false,
}: {
  label: string;
  endpoint: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const { data } = useResource<Entity[]>(`${endpoint}?per_page=100`);
  return (
    <label>
      {label}
      <select
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Seleccionar…</option>
        {data?.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name || v.title || `${v.first_name || ""} ${v.last_name || ""}`}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
export function Submit({
  busy,
  label = "Guardar cambios",
}: {
  busy: boolean;
  label?: string;
}) {
  return (
    <Button type="submit" disabled={busy}>
      {busy && <LoaderCircle className="spin" size={16} />}{" "}
      {busy ? "Guardando…" : label}
    </Button>
  );
}
