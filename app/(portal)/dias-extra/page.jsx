import { Card, PageHeader } from "../../../components/ui-kit.jsx";
import { RequestTable } from "../../../components/request-table.jsx";
import { SolicitudForm } from "../../../components/solicitud-form.jsx";
import { getContext } from "../../../lib/context.js";
import { listUsuarios } from "../../../lib/usuarios.js";
import { EVENT_TYPES, listarPorSolicitante } from "../../../lib/vacaciones.js";

export default async function DiasExtraPage() {
  const context = await getContext();
  const [usuarios, solicitudes] = await Promise.all([
    listUsuarios(),
    listarPorSolicitante(context.correo)
  ]);

  const diasExtra = solicitudes
    .filter((solicitud) => solicitud.tipo_solicitud === "dia_extra")
    .sort((a, b) => (a.id < b.id ? 1 : -1));

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Solicitar día extra</h2>
        <SolicitudForm
          usuarios={usuarios}
          tipos={{ dia_extra: EVENT_TYPES.dia_extra }}
          fixedTipo="dia_extra"
          correoActual={context.correo}
        />
      </Card>
      <div>
        <PageHeader title="Días Extra" description="Tus solicitudes de días extra." />
        <Card className="p-4">
          <RequestTable solicitudes={diasExtra} mode="mine" />
        </Card>
      </div>
    </div>
  );
}
