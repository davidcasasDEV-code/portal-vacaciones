const TONES = {
  brand: "bg-blue-50 text-blue-700 border border-blue-200",
  success: "bg-green-50 text-green-700 border border-green-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  danger: "bg-red-50 text-red-700 border border-red-200",
  neutral: "bg-slate-100 text-slate-600 border border-slate-200"
};

export function Badge({ tone = "neutral", children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone] || TONES.neutral}`}>
      {children}
    </span>
  );
}

export function estatusTone(estatus) {
  if (estatus === "Aprobado") return "success";
  if (estatus === "Rechazado") return "danger";
  if (estatus === "Cancelado") return "neutral";
  return "warning";
}

export function Card({ className = "", children }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({ variant = "primary", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "text-white bg-gradient-to-r from-[var(--nave-brand-start)] to-[var(--nave-brand-end)] hover:opacity-90",
    secondary: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100"
  };
  return <button className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props} />;
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export function Input(props) {
  return <input className={inputClass} {...props} />;
}

export function Select(props) {
  return <select className={inputClass} {...props} />;
}

export function TextArea(props) {
  return <textarea className={inputClass} {...props} />;
}

export function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return <p className="py-8 text-center text-sm text-slate-400">{children}</p>;
}
