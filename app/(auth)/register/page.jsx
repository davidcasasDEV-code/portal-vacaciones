"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorBanner, Field, Input, Select } from "../../../components/ui-kit.jsx";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    correo: "",
    password: "",
    sexo: "Hombre",
    fechaIngreso: "",
    fechaNacimiento: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No se pudo completar el registro");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Completa tu registro</h1>
      <p className="text-sm text-slate-500">Tu correo debe estar pre-autorizado por un administrador.</p>
      <ErrorBanner>{error}</ErrorBanner>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre">
          <Input required value={form.nombre} onChange={update("nombre")} />
        </Field>
        <Field label="Apellido">
          <Input required value={form.apellido} onChange={update("apellido")} />
        </Field>
      </div>
      <Field label="Correo">
        <Input type="email" required value={form.correo} onChange={update("correo")} autoComplete="email" />
      </Field>
      <Field label="Contraseña" hint="Al menos 6 caracteres">
        <Input type="password" required minLength={6} value={form.password} onChange={update("password")} autoComplete="new-password" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Género">
          <Select value={form.sexo} onChange={update("sexo")}>
            <option value="Hombre">Masculino</option>
            <option value="Mujer">Femenino</option>
          </Select>
        </Field>
        <Field label="Fecha de nacimiento">
          <Input type="date" required value={form.fechaNacimiento} onChange={update("fechaNacimiento")} />
        </Field>
      </div>
      <Field label="Fecha de ingreso">
        <Input type="date" required value={form.fechaIngreso} onChange={update("fechaIngreso")} />
      </Field>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Registrando..." : "Registrarme"}
      </Button>
      <p className="text-center text-sm text-slate-500">
        ¿Ya tienes cuenta? <Link href="/login" className="text-blue-600 hover:underline">Inicia sesión</Link>
      </p>
    </form>
  );
}
