"use client";
// GTT GADD UX: workspace-shell/negociado.tsx and sidebar-nav.tsx.
import { useState } from "react";
import {
  ChevronDown,
  LogOut,
  Settings,
  Search,
  PanelLeft,
  UserRound,
  Building2,
  Mail,
  LockKeyhole,
  ArrowLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar } from "@/components/ui";
import { name, Session } from "@/lib/api";
export function WorkspaceSidebar({
  session,
  view,
  navigation,
  onNavigate,
  onLogout,
}: {
  session: Session;
  view: string;
  navigation: { id: string; label: string; icon: LucideIcon }[];
  onNavigate: (view: string) => void;
  onLogout: () => void;
}) {
  const { toggleSidebar, setOpenMobile, state, isMobile } = useSidebar();
  const [query, setQuery] = useState("");
  const collapsed = state === "collapsed" && !isMobile;
  function go(id: string) {
    setOpenMobile(false);
    setQuery("");
    onNavigate(id);
  }
  const groups = [
    ["dashboard", "messages", "tasks"],
    ["contacts", "companies"],
    ["opportunities", "quotes"],
    ["events"],
  ];
  const matches = navigation.filter((item) =>
    item.label.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")),
  );
  if (view === "settings")
    return (
      <Sidebar collapsible="icon" variant="inset" className="crm-sidebar p-1">
        <SidebarHeader className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="sm"
                onClick={() => go("dashboard")}
                tooltip="Volver a la aplicación"
              >
                <ArrowLeft />
                <span>Volver a la aplicación</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0.5 py-1">
            <SidebarMenu>
              {[
                { id: "perfil", label: "Perfil", icon: UserRound },
                { id: "empresa", label: "Empresa", icon: Building2 },
                { id: "gmail", label: "Gmail", icon: Mail },
                { id: "privacidad", label: "Privacidad", icon: LockKeyhole },
              ].map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton asChild size="sm">
                    <a
                      href={`#${item.id}`}
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-2">
          <div className="sidebar-account">
            <Avatar label={name(session.user)} small />
            <span className="truncate flex-1">{name(session.user)}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Cerrar sesión"
              onClick={onLogout}
            >
              <LogOut />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  return (
    <Sidebar collapsible="icon" variant="inset" className="crm-sidebar p-1">
      <SidebarHeader className="gap-2 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              className="h-9"
              onClick={() => go("settings")}
              tooltip={session.workspace.name}
              aria-label={`Empresa: ${session.workspace.name}. Configuración`}
            >
              <span className="workspace-mark">N</span>
              <span className="truncate font-medium">
                {session.workspace.name}
              </span>
              <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <div className="sidebar-search">
            <Search aria-hidden="true" />
            <Input
              className="pl-8"
              aria-label="Buscar sección"
              placeholder="Buscar sección…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {groups.map((ids, i) => {
          const items = matches.filter((item) => ids.includes(item.id));
          return items.length ? (
            <SidebarGroup key={i} className="crm-nav-group px-1.5 py-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={view === item.id}
                        size="sm"
                        tooltip={item.label}
                      >
                        <a
                          href={`/${item.id}`}
                          aria-current={view === item.id ? "page" : undefined}
                          onClick={(e) => {
                            if (
                              e.metaKey ||
                              e.ctrlKey ||
                              e.shiftKey ||
                              e.altKey
                            )
                              return;
                            e.preventDefault();
                            go(item.id);
                          }}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null;
        })}
        {!matches.length && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No hay secciones con ese nombre.
          </p>
        )}
      </SidebarContent>
      <SidebarFooter className="gap-1 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={view === "settings"}
              size="sm"
              onClick={() => go("settings")}
              tooltip="Configuración"
            >
              <Settings />
              <span>Configuración</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              onClick={toggleSidebar}
              tooltip={collapsed ? "Ampliar menú" : "Contraer menú"}
            >
              <PanelLeft />
              <span>{collapsed ? "Ampliar menú" : "Contraer menú"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="sidebar-account">
          <button
            aria-label={`Perfil de ${name(session.user)}`}
            className="sidebar-profile"
            onClick={() => go("settings")}
            title={session.user.email}
          >
            <Avatar label={name(session.user)} small />
            {!collapsed && <span>{name(session.user)}</span>}
          </button>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Cerrar sesión"
              onClick={onLogout}
            >
              <LogOut />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
