"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  dashboard: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z",
  calendar: "M8 2v3m8-3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  check: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  extra: "M12 8v8m-4-4h8m7 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  report: "M9 17V9m4 8V5m4 12v-6M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z"
};

function Icon({ path, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  );
}

function NavItem({ href, icon, children, badge }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active ? "bg-[var(--nave-sidebar-active)] text-white" : "text-[var(--nave-sidebar-text)] hover:bg-[var(--nave-sidebar-active)] hover:text-white"
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon path={icon} />
        {children}
      </span>
      {badge ? (
        <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">{badge}</span>
      ) : null}
    </Link>
  );
}

export function AppShell({ user, mostrarAprobaciones, pendientesCount, children }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function cerrarSesion() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-[var(--nave-bg)]">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-[var(--nave-sidebar-bg)] p-4 transition-transform md:static md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/images/cohete.png" alt="NAVE" className="h-8 w-8" />
          <span className="text-lg font-semibold text-white">NAVE Vacaciones</span>
        </div>
        <nav className="flex flex-col gap-1">
          <NavItem href="/dashboard" icon={ICONS.dashboard}>Dashboard</NavItem>
          <NavItem href="/vacaciones" icon={ICONS.calendar}>Vacaciones</NavItem>
          <NavItem href="/mis-solicitudes" icon={ICONS.list}>Mis Solicitudes</NavItem>
          <NavItem href="/dias-extra" icon={ICONS.extra}>Días Extra</NavItem>
          {mostrarAprobaciones ? (
            <NavItem href="/aprobaciones" icon={ICONS.check} badge={pendientesCount || null}>
              Aprobaciones
            </NavItem>
          ) : null}
          {user.rol === "Admin" ? (
            <NavItem href="/reportes" icon={ICONS.report}>Reportes</NavItem>
          ) : null}
        </nav>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          aria-label="Cerrar menu"
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col md:pl-0">
        <header className="flex items-center justify-between border-b border-[var(--nave-border)] bg-white px-4 py-3">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Icon path="M4 6h16M4 12h16M4 18h16" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user.nombre} {user.apellido}</p>
              <p className="text-xs text-slate-400">{user.rol}</p>
            </div>
            <button
              type="button"
              onClick={cerrarSesion}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
