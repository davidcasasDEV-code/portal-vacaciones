export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <img src="/images/cohete.png" alt="NAVE" className="h-10 w-10" />
          <span className="text-xl font-semibold text-slate-800">NAVE Vacaciones</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
