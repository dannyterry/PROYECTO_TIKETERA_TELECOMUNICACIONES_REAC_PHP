import React, { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { MapPin, Navigation, HardHat, User, Truck, Crosshair } from "lucide-react";

export interface MapPointSupervisor {
  id: string | number;
  supervisor: string;
  tecnico?: string;
  ticket?: string;
  cliente?: string;
  direccion?: string;
  estado_actual: string;
  latSupervisor?: number;
  lngSupervisor?: number;
  latOrden?: number;
  lngOrden?: number;
  distanciaMetros?: number | null;
}

interface SupervisionMonitoringMapProps {
  items: MapPointSupervisor[];
  selectedItem: MapPointSupervisor | null;
  onSelectItem: (item: MapPointSupervisor) => void;
}

// Controller to auto-center map
const MapAutoFitController: React.FC<{
  items: MapPointSupervisor[];
  selectedItem: MapPointSupervisor | null;
}> = ({ items, selectedItem }) => {
  const map = useMap();

  useEffect(() => {
    if (selectedItem?.latSupervisor && selectedItem?.lngSupervisor) {
      if (selectedItem.latOrden && selectedItem.lngOrden) {
        // Fit both supervisor & technician
        const bounds: LatLngBoundsExpression = [
          [selectedItem.latSupervisor, selectedItem.lngSupervisor],
          [selectedItem.latOrden, selectedItem.lngOrden],
        ];
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      } else {
        map.setView([selectedItem.latSupervisor, selectedItem.lngSupervisor], 16);
      }
      return;
    }

    // Collect all valid points
    const points: [number, number][] = [];
    items.forEach((it) => {
      if (it.latSupervisor && it.lngSupervisor) points.push([it.latSupervisor, it.lngSupervisor]);
      if (it.latOrden && it.lngOrden) points.push([it.latOrden, it.lngOrden]);
    });

    if (points.length === 1) {
      map.setView(points[0], 14);
    } else if (points.length > 1) {
      map.fitBounds(points as LatLngBoundsExpression, { padding: [40, 40] });
    } else {
      // Default to Lima, Peru
      map.setView([-12.046374, -77.042793], 12);
    }
  }, [items, selectedItem, map]);

  return null;
};

export const SupervisionMonitoringMap: React.FC<SupervisionMonitoringMapProps> = ({
  items,
  selectedItem,
  onSelectItem,
}) => {
  // Default Lima coordinates
  const defaultCenter: LatLngExpression = [-12.046374, -77.042793];

  return (
    <div className="relative w-full h-[420px] rounded-3xl overflow-hidden border border-slate-200 shadow-md bg-slate-900 z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapAutoFitController items={items} selectedItem={selectedItem} />

        {items.map((item) => {
          const isSelected = selectedItem?.id === item.id;
          const hasSupGps = item.latSupervisor !== undefined && item.lngSupervisor !== undefined;
          const hasOrdGps = item.latOrden !== undefined && item.lngOrden !== undefined;

          return (
            <React.Fragment key={`map-frag-${item.id}`}>
              {/* Connecting line between Supervisor and Technician's Order */}
              {hasSupGps && hasOrdGps && (
                <Polyline
                  positions={[
                    [item.latSupervisor!, item.lngSupervisor!],
                    [item.latOrden!, item.lngOrden!],
                  ]}
                  pathOptions={{
                    color: isSelected ? "#2563eb" : "#0284c7",
                    weight: isSelected ? 4 : 2.5,
                    dashArray: "6, 8",
                    opacity: 0.85,
                  }}
                />
              )}

              {/* Marker 1: Supervisor */}
              {hasSupGps && (
                <CircleMarker
                  center={[item.latSupervisor!, item.lngSupervisor!]}
                  radius={isSelected ? 11 : 8}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2.5,
                    fillColor:
                      item.estado_actual === "EN_CAMINO"
                        ? "#f59e0b"
                        : item.estado_actual === "EN_SUPERVISION"
                        ? "#10b981"
                        : "#3b82f6",
                    fillOpacity: 0.95,
                  }}
                  eventHandlers={{
                    click: () => onSelectItem(item),
                  }}
                >
                  <Popup>
                    <div className="p-1 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-black text-slate-900 border-b pb-1">
                        <Navigation className="w-3.5 h-3.5 text-blue-600" />
                        <span>SUPERVISOR: {item.supervisor}</span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        <strong>Estado:</strong> {item.estado_actual}
                      </div>
                      {item.tecnico && (
                        <div className="text-[11px] text-slate-600">
                          <strong>Técnico:</strong> {item.tecnico}
                        </div>
                      )}
                      {item.distanciaMetros !== null && item.distanciaMetros !== undefined && (
                        <div className="text-[11px] font-bold text-blue-700 bg-blue-50 p-1 rounded-md">
                          📍 A {item.distanciaMetros} m del técnico/orden
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              )}

              {/* Marker 2: Technician / Order */}
              {hasOrdGps && (
                <CircleMarker
                  center={[item.latOrden!, item.lngOrden!]}
                  radius={isSelected ? 10 : 7}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#e11d48", // Rose Red for Order/Tech
                    fillOpacity: 0.9,
                  }}
                  eventHandlers={{
                    click: () => onSelectItem(item),
                  }}
                >
                  <Popup>
                    <div className="p-1 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-black text-rose-700 border-b pb-1">
                        <HardHat className="w-3.5 h-3.5" />
                        <span>PUNTO DE ORDEN / TÉCNICO</span>
                      </div>
                      {item.ticket && (
                        <div className="text-[11px] text-slate-700">
                          <strong>OT / Ticket:</strong> {item.ticket}
                        </div>
                      )}
                      {item.cliente && (
                        <div className="text-[11px] text-slate-700">
                          <strong>Cliente:</strong> {item.cliente}
                        </div>
                      )}
                      {item.direccion && (
                        <div className="text-[11px] text-slate-500">{item.direccion}</div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Floating Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/90 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 text-white text-[11px] space-y-1.5 shadow-xl pointer-events-auto">
        <div className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider mb-1">
          Simbología de Monitoreo
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white" />
          <span>Supervisor (En Supervisión)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 border border-white" />
          <span>Supervisor (En Camino)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 border border-white" />
          <span>Punto Orden / Técnico (Fénix)</span>
        </div>
        <div className="flex items-center gap-2 text-sky-300">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-sky-400" />
          <span>Cruce Supervisor ➔ Técnico</span>
        </div>
      </div>
    </div>
  );
};
