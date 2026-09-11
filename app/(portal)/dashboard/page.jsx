import Link from "next/link";
import { BalanceCard } from "../../../components/balance-card.jsx";
import { KpiTile } from "../../../components/kpi-tile.jsx";
import { RequestTable } from "../../../components/request-table.jsx";
import { Card, PageHeader } from "../../../components/ui-kit.jsx";
import { obtenerResumenDashboard } from "../../../lib/dashboard.js";
import { getContext } from "../../../lib/context.js";

export default async function DashboardPage() {
  const context = await getContext();
  const resumen = await obtenerResumenDashboard(context.correo);

  return (
    <div>
      <PageHeader title={`Hola, ${context.nombre}`} description="Resumen de tus vacaciones y solicitudes." />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiTile label="Pendientes" value={resumen.kpis["Pendiente de Aprobación"] || 0} tone="warning" />
        <KpiTile label="Aprobadas" value={resumen.kpis["Aprobado"] || 0} tone="success" />
        <KpiTile label="Rechazadas" value={resumen.kpis["Rechazado"] || 0} tone="danger" />
        <KpiTile label="Por aprobar (tuyas)" value={resumen.pendientesParaMi} tone="brand" />
      </div>

      <div className="mb-6">
        <BalanceCard saldo={resumen.saldo} />
      </div>

      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Solicitudes recientes</h2>
          <Link href="/mis-solicitudes" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
        </div>
        <RequestTable solicitudes={resumen.recientes} mode="all" />
      </Card>
    </div>
  );
}
