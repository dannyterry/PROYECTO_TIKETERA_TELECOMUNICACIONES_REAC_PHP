import React, { useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { getImageUrl } from "../services/mobilityService";

export interface PhotoItem {
  url: string;
  title: string;
  subtitle?: string;
}

interface Props {
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
}

export const PhotoViewerModal: React.FC<Props> = ({ photos, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!photos || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  const fullUrl = getImageUrl(currentPhoto.url);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setZoom(1);
    setRotation(0);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setZoom(1);
    setRotation(0);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.3, 3.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.3, 0.6));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 md:p-6 animate-fade-in select-none">
      {/* Contenedor Principal */}
      <div className="relative w-full max-w-5xl h-[92vh] flex flex-col bg-slate-900/90 rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                {currentPhoto.title}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {currentIndex + 1} / {photos.length}
                </span>
              </h3>
              {currentPhoto.subtitle && (
                <p className="text-xs text-slate-400 truncate max-w-md">{currentPhoto.subtitle}</p>
              )}
            </div>
          </div>

          {/* Botones de Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomIn}
              title="Acercar (+)"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={handleZoomOut}
              title="Alejar (-)"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={handleRotate}
              title="Rotar 90°"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <RotateCw size={18} />
            </button>
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              download
              title="Descargar Foto"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <Download size={18} />
            </a>
            <button
              onClick={onClose}
              className="p-2 ml-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ÁREA DE FOTO CON ZOOM Y PAN */}
        <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden bg-radial from-slate-900 to-black">
          {fullUrl ? (
            <img
              src={fullUrl}
              alt={currentPhoto.title}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: "transform 0.2s ease-out",
              }}
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl pointer-events-none"
            />
          ) : (
            <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
              <ImageIcon size={48} className="opacity-30" />
              <span>Foto no disponible</span>
            </div>
          )}

          {/* Flechas de Navegación */}
          {photos.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-black/60 hover:bg-black/90 border border-white/10 text-white flex items-center justify-center backdrop-blur-md shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-black/60 hover:bg-black/90 border border-white/10 text-white flex items-center justify-center backdrop-blur-md shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>

        {/* FOOTER MINIATURAS */}
        <div className="px-6 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-center gap-3 overflow-x-auto shrink-0">
          {photos.map((p, idx) => {
            const thumbUrl = getImageUrl(p.url);
            const isSelected = idx === currentIndex;
            return (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoom(1);
                  setRotation(0);
                }}
                className={`relative w-16 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? "border-cyan-400 scale-105 shadow-lg shadow-cyan-500/20"
                    : "border-slate-700 opacity-50 hover:opacity-100"
                }`}
              >
                {thumbUrl ? (
                  <img src={thumbUrl} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400">
                    N/D
                  </div>
                )}
                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center font-bold truncate px-1">
                  {p.title.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
