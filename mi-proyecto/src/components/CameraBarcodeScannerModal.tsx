import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, X, RefreshCw, Zap, CheckCircle2, AlertCircle } from "lucide-react";

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  subtitle?: string;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = "Escanear Código de Barras / QR",
  subtitle = "Apunta la cámara al código de barras o serie del equipo",
}) => {
  const [scannerActive, setScannerActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [manualCode, setManualCode] = useState("");
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "camera-barcode-reader";

  // Reproducir pitido de confirmación con Web Audio API
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz (A5)
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      if (navigator.vibrate) navigator.vibrate(120);
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("Error stopping scanner:", err);
      }
      html5QrCodeRef.current = null;
    }
    setScannerActive(false);
  };

  const startScanner = async () => {
    try {
      setErrorMsg(null);
      await stopScanner();

      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Rendija delgada horizontal para aislar con precisión una sola línea de código de barras
          const w = Math.min(viewfinderWidth - 24, 300);
          const h = Math.max(45, Math.min(65, Math.floor(viewfinderHeight * 0.20))); // Solo 50-60px de alto
          return {
            width: w,
            height: h,
          };
        },
        aspectRatio: 1.33,
      };

      await html5QrCode.start(
        { facingMode },
        config,
        (decodedText) => {
          const clean = decodedText.trim().toUpperCase();
          if (clean) {
            playBeep();
            stopScanner();
            onScan(clean);
            onClose();
          }
        },
        () => {
          // Frame callback sin detección
        }
      );

      setScannerActive(true);
    } catch (err: any) {
      console.error("Error al iniciar cámara:", err);
      setErrorMsg(
        err?.message?.includes("Permission") || err?.name === "NotAllowedError"
          ? "⚠️ Permiso de cámara denegado. Permite el acceso a la cámara en el navegador de tu celular para escanear."
          : "⚠️ No se pudo acceder a la cámara. Asegúrate de tener buena luz o digita la serie manualmente abajo."
      );
      setScannerActive(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Pequeño timeout para asegurar que el DOM del modal esté montado
      const timer = setTimeout(() => {
        startScanner();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">{title}</h3>
              <p className="text-[10px] font-medium text-slate-400">
                Alinea la línea roja sobre el código que deseas leer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Visor de Cámara con Rendija Láser Estrecha */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col items-center justify-center relative bg-black min-h-[280px]">
          <div
            id={scannerContainerId}
            className="w-full max-w-[340px] aspect-4/3 rounded-2xl overflow-hidden relative shadow-inner"
          ></div>

          {/* Máscara & Rendija de Precisión Láser */}
          {scannerActive && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
              
              {/* Máscara superior oscura */}
              <div className="w-full flex-1 bg-black/50 backdrop-blur-[1px]"></div>

              {/* Rendija delgada activa */}
              <div className="w-[88%] max-w-[300px] h-[58px] border-2 border-red-500/90 rounded-xl relative overflow-hidden bg-transparent shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center">
                {/* Línea Láser Roja Central (Como pistola lectora física) */}
                <div className="w-full h-[2px] bg-red-500 shadow-[0_0_10px_#ef4444,0_0_4px_#ffffff] animate-pulse"></div>
                
                {/* Esquinas de enfoque */}
                <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-white"></div>
                <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-white"></div>
                <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-white"></div>
                <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-white"></div>
              </div>

              {/* Máscara inferior oscura */}
              <div className="w-full flex-1 bg-black/50 backdrop-blur-[1px] flex items-start justify-center pt-2">
                <span className="text-[10px] font-black text-amber-300 bg-slate-950/90 px-3 py-1 rounded-full border border-amber-500/30 shadow-md">
                  🎯 Centra el código de barras en la línea roja
                </span>
              </div>

            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
              <AlertCircle size={36} className="text-amber-400" />
              <p className="text-xs font-semibold text-slate-300 max-w-xs">{errorMsg}</p>
              <button
                type="button"
                onClick={startScanner}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
              >
                <RefreshCw size={13} /> Reintentar Cámara
              </button>
            </div>
          )}
        </div>

        {/* Controles y Entrada Manual de Respaldo */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          
          {/* Alternar cámara */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Cambiar Cámara ({facingMode === "environment" ? "Trasera" : "Frontal"})</span>
            </button>
          </div>

          {/* Formulario Manual de Respaldo */}
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 block mb-1.5">
              ¿No enfoca o código dañado? Escríbelo aquí:
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Ej: ZTEGC89A0101..."
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualCode.trim()) {
                    playBeep();
                    stopScanner();
                    onScan(manualCode.trim().toUpperCase());
                    onClose();
                  }
                }}
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-md"
              >
                <CheckCircle2 size={14} /> Usar
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
