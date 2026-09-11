import { redirect } from "next/navigation";
import { AppShell } from "../../components/app-shell.jsx";
import { getContext } from "../../lib/context.js";
import { listarPendientesParaAprobador } from "../../lib/vacaciones.js";

export default async function PortalLayout({ children }) {
  const context = await getContext();
  if (!context) {
    redirect("/login");
  }

  const pendientes = await listarPendientesParaAprobador(context.correo);
  const mostrarAprobaciones = pendientes.length > 0 || context.rol === "Admin";

  return (
    <AppShell user={context} mostrarAprobaciones={mostrarAprobaciones} pendientesCount={pendientes.length}>
      {children}
    </AppShell>
  );
}
