"use client";

import { useState } from "react";
import { Badge, Button, EmptyState, estatusTone } from "./ui-kit.jsx";

const EVENT_LABELS = {
  vacation: "Vacaciones",
  "personal-day": "Dia Personal",
  birthday: "Dia de Cumpleaños",
  enfermedad: "Enfermedad",
  "medio-dia": "Medio dia",
  permiso: "Permiso sin goce de sueldo",
  nacimiento_adopcion_padre: "Nacimiento y/o adopción (padre)",
  licencia_maternidad_madre: "Licencia de maternidad",
  licencia_adopcion_madre: "Licencia adopción (madre)",
  fallecimiento_familiar: "Fallecimiento Familiar",
  dia_extra: "Día Extra"
};

function puedeCancelarseLocal(solicitud) {
  if (solicitud.estatus === "Rechazado" || solicitud.estatus === "Cancelado") return false;
  const hoy = new Date().toISOString().split("T")[0];
  return solicitud.desde >= hoy;
}

export function RequestTable({ solicitudes, mode, extraColumn }) {
  const [items, setItems] = useState(solicitudes);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function accionar(id, accion) {
    setError("");
    setBusyId(id);
    try {
      const response = await fetch(`/api/vacaciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar la solicitud");
      }
      setItems((prev) =>
        mode === "pending"
          ? prev.filter((item) => item.id !== id)
          : prev.map((item) => (item.id === id ? { ...item, estatus: data.estatus } : item))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) {
    return <EmptyState>No hay solicitudes para mostrar.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            {mode !== "mine" ? <th className="py-2 pr-4">Solicitante</th> : null}
            <th className="py-2 pr-4">Tipo</th>
            <th className="py-2 pr-4">Desde</th>
            <th className="py-2 pr-4">Hasta</th>
            <th className="py-2 pr-4">Días</th>
            {mode === "pending" ? <th className="py-2 pr-4">Solicitante</th> : <th className="py-2 pr-4">Aprobador</th>}
            <th className="py-2 pr-4">Estatus</th>
            {mode !== "all" ? <th className="py-2 pr-4">Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((solicitud) => (
            <tr key={solicitud.id} className="border-b border-slate-100">
              {mode !== "mine" && mode !== "pending" ? <td className="py-2 pr-4">{solicitud.solicitante}</td> : null}
              <td className="py-2 pr-4">{EVENT_LABELS[solicitud.tipo_solicitud] || solicitud.tipo_solicitud}</td>
              <td className="py-2 pr-4">{solicitud.desde}</td>
              <td className="py-2 pr-4">{solicitud.hasta}</td>
              <td className="py-2 pr-4">{solicitud.dias_solicitados}</td>
              {mode === "pending" ? (
                <td className="py-2 pr-4">{solicitud.solicitante}</td>
              ) : (
                <td className="py-2 pr-4">{solicitud.aprobador}</td>
              )}
              <td className="py-2 pr-4">
                <Badge tone={estatusTone(solicitud.estatus)}>{solicitud.estatus}</Badge>
              </td>
              {mode === "mine" ? (
                <td className="py-2 pr-4">
                  {puedeCancelarseLocal(solicitud) ? (
                    <Button variant="danger" className="px-3 py-1 text-xs" disabled={busyId === solicitud.id} onClick={() => accionar(solicitud.id, "cancelar")}>
                      Cancelar
                    </Button>
                  ) : null}
                </td>
              ) : null}
              {mode === "pending" ? (
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
                    <Button className="px-3 py-1 text-xs" disabled={busyId === solicitud.id} onClick={() => accionar(solicitud.id, "aprobar")}>
                      Aprobar
                    </Button>
                    <Button variant="danger" className="px-3 py-1 text-xs" disabled={busyId === solicitud.id} onClick={() => accionar(solicitud.id, "rechazar")}>
                      Rechazar
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { EVENT_LABELS };
