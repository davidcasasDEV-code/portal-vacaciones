"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorBanner, Field, Input } from "../../../components/ui-kit.jsx";

export default function LoginPage() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No se pudo iniciar sesión");
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
      <h1 className="text-xl font-semibold text-slate-900">Iniciar sesión</h1>
      <ErrorBanner>{error}</ErrorBanner>
      <Field label="Correo">
        <Input type="email" required value={correo} onChange={(event) => setCorreo(event.target.value)} autoComplete="email" />
      </Field>
      <Field label="Contraseña">
        <Input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
      </Field>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Entrando..." : "Entrar"}
      </Button>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <Link href="/recover" className="hover:text-blue-600">¿Olvidaste tu contraseña?</Link>
        <Link href="/register" className="hover:text-blue-600">Registrarme</Link>
      </div>
    </form>
  );
}
