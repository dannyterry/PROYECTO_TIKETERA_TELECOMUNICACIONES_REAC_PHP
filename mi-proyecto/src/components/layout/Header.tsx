import { ArrowLeft } from "lucide-react";
import { DASHBOARD_URL } from "../../config/api";

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
        Portal de Gestión de Personal
      </h1>

      <a
        href={DASHBOARD_URL}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-xl border border-slate-300 shadow-sm transition-all hover:shadow"
      >
        <ArrowLeft size={18} className="text-slate-600" />
        <span>Volver al Panel Principal</span>
      </a>
    </header>
  );
}