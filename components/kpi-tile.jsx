import { Card } from "./ui-kit.jsx";

export function KpiTile({ label, value, tone = "brand" }) {
  const tones = {
    brand: "text-blue-600",
    success: "text-green-600",
    warning: "text-amber-600",
    danger: "text-red-600",
    neutral: "text-slate-500"
  };
  return (
    <Card className="p-4 text-center">
      <p className={`text-3xl font-semibold ${tones[tone] || tones.brand}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </Card>
  );
}
