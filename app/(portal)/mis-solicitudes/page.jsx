import { Card, PageHeader } from "../../../components/ui-kit.jsx";
import { RequestTable } from "../../../components/request-table.jsx";
import { getContext } from "../../../lib/context.js";
import { listarPorSolicitante } from "../../../lib/vacaciones.js";

export default async function MisSolicitudesPage() {
  const context = await getContext();
  const solicitudes = (await listarPorSolicitante(context.correo)).sort((a, b) => (a.id < b.id ? 1 : -1));

  return (
    <div>
      <PageHeader title="Mis Solicitudes" description="Historial de tus solicitudes de vacaciones y permisos." />
      <Card className="p-4">
        <RequestTable solicitudes={solicitudes} mode="mine" />
      </Card>
    </div>
  );
}
