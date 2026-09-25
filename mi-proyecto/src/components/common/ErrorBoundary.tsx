import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-white rounded-2xl border border-rose-200 shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 shadow-xs">
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 mb-1">
            {this.props.fallbackTitle || "Ocurrió un inconveniente al cargar esta sección"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mb-4">
            {this.state.error?.message || "Error inesperado de ejecución. Por favor recarga la vista para continuar."}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Recargar módulo</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
