"use client";

import { useEffect, useState } from "react";
import { Badge, EmptyState, estatusTone } from "./ui-kit.jsx";
import { EVENT_LABELS } from "./request-table.jsx";

function diasDelRango(desde, hasta, mesDesde, mesHasta) {
  const inicio = desde > mesDesde ? desde : mesDesde;
  const fin = hasta < mesHasta ? hasta : mesHasta;
  const dias = [];
  const cursor = new Date(`${inicio}T00:00:00Z`);
  const finDate = new Date(`${fin}T00:00:00Z`);
  while (cursor <= finDate) {
    dias.push(cursor.toISOString().split("T")[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

export function TeamMapModal({ desde, hasta, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [porDia, setPorDia] = useState({});

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    fetch(`/api/vacaciones?scope=team&desde=${desde}&hasta=${hasta}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelado) return;
        const agrupado = {};
        for (const solicitud of data.solicitudes || []) {
          for (const dia of diasDelRango(solicitud.desde, solicitud.hasta, desde, hasta)) {
            agrupado[dia] = agrupado[dia] || [];
            agrupado[dia].push(solicitud);
          }
        }
        setPorDia(agrupado);
      })
      .catch(() => !cancelado && setError("No se pudo cargar el mapa de equipo"))
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [desde, hasta]);

  const dias = Object.keys(porDia).sort();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Mapa de equipo</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {loading ? <p className="text-sm text-slate-400">Cargando...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading && !error && dias.length === 0 ? (
          <EmptyState>Nadie del equipo tiene ausencias este mes.</EmptyState>
        ) : null}

        <div className="space-y-3">
          {dias.map((dia) => (
            <div key={dia} className="rounded-lg border border-slate-100 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">{dia}</p>
              <div className="flex flex-wrap gap-2">
                {porDia[dia].map((solicitud) => (
                  <Badge key={`${solicitud.id}-${dia}`} tone={estatusTone(solicitud.estatus)}>
                    {solicitud.solicitante} · {EVENT_LABELS[solicitud.tipo_solicitud] || solicitud.tipo_solicitud}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
