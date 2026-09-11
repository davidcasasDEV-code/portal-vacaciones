import { Card, EmptyState } from "./ui-kit.jsx";

function humanizar(clave) {
  return clave
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letra) => letra.toUpperCase());
}

export function BalanceCard({ saldo }) {
  const entradas = saldo && typeof saldo === "object" ? Object.entries(saldo) : [];

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Saldo de beneficios</h2>
      {entradas.length === 0 ? (
        <EmptyState>No se pudo obtener el saldo en este momento.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {entradas.map(([clave, valor]) => (
            <div key={clave} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-2xl font-semibold text-slate-800">{typeof valor === "number" ? valor : String(valor)}</p>
              <p className="text-xs text-slate-500">{humanizar(clave)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
