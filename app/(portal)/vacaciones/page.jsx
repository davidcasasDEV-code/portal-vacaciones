import { Card, PageHeader } from "../../../components/ui-kit.jsx";
import { CalendarMonth } from "../../../components/calendar-month.jsx";
import { SolicitudForm } from "../../../components/solicitud-form.jsx";
import { getContext } from "../../../lib/context.js";
import { listUsuarios } from "../../../lib/usuarios.js";
import { EVENT_TYPES, listarActivasPorSolicitante } from "../../../lib/vacaciones.js";

const TIPOS_VACACIONES = Object.fromEntries(
  Object.entries(EVENT_TYPES).filter(([tipo]) => tipo !== "dia_extra")
);

export default async function VacacionesPage() {
  const context = await getContext();
  const [usuarios, solicitudes] = await Promise.all([
    listUsuarios(),
    listarActivasPorSolicitante(context.correo)
  ]);

  return (
    <div>
      <PageHeader title="Vacaciones" description="Consulta tu calendario y registra una nueva solicitud." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="p-4">
          <CalendarMonth solicitudes={solicitudes} />
        </Card>
        <Card className="p-4">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Nueva solicitud</h2>
          <SolicitudForm usuarios={usuarios} tipos={TIPOS_VACACIONES} correoActual={context.correo} />
        </Card>
      </div>
    </div>
  );
}
