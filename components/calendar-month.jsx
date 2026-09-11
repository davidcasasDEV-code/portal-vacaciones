"use client";

import { useMemo, useState } from "react";
import { HOLIDAYS } from "../lib/holidays.js";
import { Button } from "./ui-kit.jsx";
import { EVENT_LABELS } from "./request-table.jsx";
import { TeamMapModal } from "./team-map-modal.jsx";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const DIAS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

const TIPO_COLOR = {
  vacation: "bg-blue-100 text-blue-800",
  "personal-day": "bg-purple-100 text-purple-800",
  birthday: "bg-pink-100 text-pink-800",
  enfermedad: "bg-red-100 text-red-800",
  "medio-dia": "bg-amber-100 text-amber-800",
  permiso: "bg-slate-200 text-slate-700",
  nacimiento_adopcion_padre: "bg-teal-100 text-teal-800",
  licencia_maternidad_madre: "bg-teal-100 text-teal-800",
  licencia_adopcion_madre: "bg-teal-100 text-teal-800",
  fallecimiento_familiar: "bg-gray-300 text-gray-800",
  dia_extra: "bg-indigo-100 text-indigo-800"
};

function pad(value) {
  return String(value).padStart(2, "0");
}

export function CalendarMonth({ solicitudes }) {
  const [offset, setOffset] = useState(0);
  const [showTeamMap, setShowTeamMap] = useState(false);

  const { year, month } = useMemo(() => {
    const base = new Date();
    const cursor = base.getMonth() + offset;
    const normalizedYear = base.getFullYear() + Math.floor(cursor / 12);
    const normalizedMonth = ((cursor % 12) + 12) % 12;
    return { year: normalizedYear, month: normalizedMonth };
  }, [offset]);

  const monthStart = `${year}-${pad(month + 1)}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;
  const startWeekday = new Date(year, month, 1).getDay();

  const eventoPorDia = useMemo(() => {
    const map = {};
    for (const solicitud of solicitudes) {
      const desde = solicitud.desde > monthStart ? solicitud.desde : monthStart;
      const hasta = solicitud.hasta < monthEnd ? solicitud.hasta : monthEnd;
      const cursor = new Date(`${desde}T00:00:00Z`);
      const fin = new Date(`${hasta}T00:00:00Z`);
      while (cursor <= fin) {
        map[cursor.toISOString().split("T")[0]] = solicitud;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    return map;
  }, [solicitudes, monthStart, monthEnd]);

  const celdas = [];
  for (let i = 0; i < startWeekday; i += 1) {
    celdas.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    celdas.push(day);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="secondary" onClick={() => setOffset((prev) => prev - 1)}>←</Button>
        <h3 className="text-lg font-semibold text-slate-800">{MESES[month]} {year}</h3>
        <Button variant="secondary" onClick={() => setOffset((prev) => prev + 1)}>→</Button>
      </div>

      <div className="mb-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
        {DIAS.map((dia) => (
          <div key={dia}>{dia}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celdas.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} />;
          }
          const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
          const isWeekend = new Date(year, month, day).getDay() % 6 === 0;
          const holiday = HOLIDAYS[iso];
          const solicitud = eventoPorDia[iso];
          const colorClass = solicitud ? TIPO_COLOR[solicitud.tipo_solicitud] || "bg-slate-200" : "";

          return (
            <div
              key={iso}
              title={holiday || solicitud?.estatus || ""}
              className={`flex h-16 flex-col items-center justify-center rounded-lg border text-sm ${
                isWeekend || holiday ? "border-transparent bg-slate-100 text-slate-400" : "border-slate-200"
              } ${colorClass}`}
            >
              <span className="font-medium">{day}</span>
              {holiday ? <span className="text-[10px]">Festivo</span> : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(EVENT_LABELS).map(([tipo, label]) => (
            <span key={tipo} className={`rounded-full px-2 py-0.5 ${TIPO_COLOR[tipo]}`}>{label}</span>
          ))}
        </div>
        <Button variant="secondary" onClick={() => setShowTeamMap(true)}>Ver mapa de equipo</Button>
      </div>

      {showTeamMap ? (
        <TeamMapModal desde={monthStart} hasta={monthEnd} onClose={() => setShowTeamMap(false)} />
      ) : null}
    </div>
  );
}
