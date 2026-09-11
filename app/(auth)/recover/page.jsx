"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorBanner, Field, Input } from "../../../components/ui-kit.jsx";

export default function RecoverPage() {
  const router = useRouter();
  const [step, setStep] = useState("request");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function solicitarCodigo(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetch("/api/auth/recover/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo })
      });
      setInfo("Si el correo tiene una cuenta, te enviamos un código. Revisa tu bandeja de entrada.");
      setStep("confirm");
    } catch {
      setError("No se pudo procesar la solicitud, intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmarCodigo(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/recover/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, codigo, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No se pudo cambiar la contraseña");
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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Recuperar contraseña</h1>
      <ErrorBanner>{error}</ErrorBanner>
      {info ? <p className="text-sm text-green-600">{info}</p> : null}

      {step === "request" ? (
        <form onSubmit={solicitarCodigo} className="space-y-4">
          <Field label="Correo">
            <Input type="email" required value={correo} onChange={(event) => setCorreo(event.target.value)} />
          </Field>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Enviando..." : "Enviar código"}
          </Button>
        </form>
      ) : (
        <form onSubmit={confirmarCodigo} className="space-y-4">
          <Field label="Código de verificación">
            <Input required value={codigo} onChange={(event) => setCodigo(event.target.value)} />
          </Field>
          <Field label="Nueva contraseña" hint="Al menos 6 caracteres">
            <Input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Guardando..." : "Cambiar contraseña"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="text-blue-600 hover:underline">Volver a iniciar sesión</Link>
      </p>
    </div>
  );
}
