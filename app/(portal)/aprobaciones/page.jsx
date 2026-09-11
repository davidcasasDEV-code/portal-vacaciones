import { Card, PageHeader } from "../../../components/ui-kit.jsx";
import { RequestTable } from "../../../components/request-table.jsx";
import { getContext } from "../../../lib/context.js";
import { listarPendientesParaAprobador } from "../../../lib/vacaciones.js";

export default async function AprobacionesPage() {
  const context = await getContext();
  const solicitudes = await listarPendientesParaAprobador(context.correo);

  return (
    <div>
      <PageHeader title="Aprobaciones" description="Solicitudes pendientes dirigidas a ti como aprobador." />
      <Card className="p-4">
        <RequestTable solicitudes={solicitudes} mode="pending" />
      </Card>
    </div>
  );
}
