import { redirect } from "next/navigation";
import { Badge, Card, PageHeader, estatusTone } from "../../../components/ui-kit.jsx";
import { RequestTable } from "../../../components/request-table.jsx";
import { getContext } from "../../../lib/context.js";
import { listarTodas } from "../../../lib/vacaciones.js";

export default async function ReportesPage() {
  const context = await getContext();
  if (context.rol !== "Admin") {
    redirect("/dashboard");
  }

  const solicitudes = (await listarTodas()).sort((a, b) => (a.id < b.id ? 1 : -1));
  const totalesPorEstatus = solicitudes.reduce((acc, solicitud) => {
    acc[solicitud.estatus] = (acc[solicitud.estatus] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Reporte de Vacaciones" description="Todas las solicitudes registradas en el portal." />
      <div className="mb-6 flex flex-wrap gap-3">
        {Object.entries(totalesPorEstatus).map(([estatus, total]) => (
          <Badge key={estatus} tone={estatusTone(estatus)}>
            {estatus}: {total}
          </Badge>
        ))}
      </div>
      <Card className="p-4">
        <RequestTable solicitudes={solicitudes} mode="all" />
      </Card>
    </div>
  );
}
