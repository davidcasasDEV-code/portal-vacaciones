"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorBanner, Field, Input, Select, TextArea } from "./ui-kit.jsx";

export function SolicitudForm({ usuarios, tipos, fixedTipo, correoActual, onCreated }) {
  const router = useRouter();
  const opciones = usuarios.filter((usuario) => usuario.correo !== correoActual);
  const [form, setForm] = useState({
    tipoSolicitud: fixedTipo || Object.keys(tipos)[0] || "",
    desde: "",
    hasta: "",
    aprobador: opciones[0]?.correo || "",
    descripcion: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await fetch("/api/vacaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No se pudo crear la solicitud");
      }
      setSuccess(`Solicitud enviada a ${data.solicitud.aprobador} (${data.solicitud.dias_solicitados} día(s) hábiles).`);
      setForm((prev) => ({ ...prev, desde: "", hasta: "", descripcion: "" }));
      router.refresh();
      onCreated?.(data.solicitud);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <ErrorBanner>{error}</ErrorBanner>
      {success ? <p className="text-sm text-green-600">{success}</p> : null}

      {!fixedTipo ? (
        <Field label="Tipo de solicitud">
          <Select value={form.tipoSolicitud} onChange={update("tipoSolicitud")}>
            {Object.entries(tipos).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Desde">
          <Input type="date" required value={form.desde} onChange={update("desde")} />
        </Field>
        <Field label="Hasta">
          <Input type="date" required value={form.hasta} onChange={update("hasta")} />
        </Field>
      </div>

      <Field label="Aprobador" hint="Quien recibirá tu solicitud para aprobar o rechazar">
        <Select required value={form.aprobador} onChange={update("aprobador")}>
          <option value="">Selecciona...</option>
          {opciones.map((usuario) => (
            <option key={usuario.correo} value={usuario.correo}>
              {usuario.nombre} {usuario.apellido}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Descripción (opcional)">
        <TextArea rows={3} value={form.descripcion} onChange={update("descripcion")} />
      </Field>

      <Button type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviar solicitud"}
      </Button>
    </form>
  );
}
