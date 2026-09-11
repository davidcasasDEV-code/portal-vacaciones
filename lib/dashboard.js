import { obtenerSaldosBeneficios } from "./lambda.js";
import { listarPendientesParaAprobador, listarPorSolicitante } from "./vacaciones.js";

export async function obtenerResumenDashboard(correo) {
  const [saldo, misSolicitudes, pendientesParaMi] = await Promise.all([
    obtenerSaldosBeneficios(correo).catch((error) => {
      console.error("No se pudo obtener el saldo de beneficios", error);
      return null;
    }),
    listarPorSolicitante(correo),
    listarPendientesParaAprobador(correo)
  ]);

  const kpis = misSolicitudes.reduce((acc, solicitud) => {
    acc[solicitud.estatus] = (acc[solicitud.estatus] || 0) + 1;
    return acc;
  }, {});

  const recientes = [...misSolicitudes].sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 5);

  return { saldo, kpis, recientes, pendientesParaMi: pendientesParaMi.length };
}
