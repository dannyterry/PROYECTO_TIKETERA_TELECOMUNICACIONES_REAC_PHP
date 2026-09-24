const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', '..', 'mi-proyecto', 'src', 'modules', 'inventory', 'components', 'TechnicianLiquidationTab.tsx');
let content = fs.readFileSync(target, 'utf8');

// 1. Update interface ItemVerificacion
content = content.replace(
  `interface ItemVerificacion {
  id_producto: number;
  producto_nombre: string;
  producto_codigo: string;
  categoria: string;
  es_drop: boolean;
  cantidad_asignada: number;
  cantidad_gastada: number;
  cantidad_esperada: number;`,
  `interface ItemVerificacion {
  id_producto: number;
  producto_nombre: string;
  producto_codigo: string;
  categoria: string;
  es_drop: boolean;
  cantidad_asignada: number;
  cantidad_gastada: number;
  cantidad_devuelta_previa?: number;
  cantidad_esperada: number;`
);

// 2. Update item mapping calculation
content = content.replace(
  `    const items: ItemVerificacion[] = productosTecnico.map((p) => {
      const cantGastada = Number(p.cantidad_gastada || p.total_liquidadas) || 0;
      const cantEsperada = Number(p.stock) || 0;
      const cantAsignada = Number(p.cantidad_asignada || p.total_asignadas) || (cantEsperada + cantGastada);

      return {
        id_producto: p.id_producto,
        producto_nombre: p.producto_nombre,
        producto_codigo: p.producto_codigo || "-",
        categoria: p.categoria || "MATERIALES",
        es_drop: Boolean(p.es_drop),
        cantidad_asignada: cantAsignada,
        cantidad_gastada: cantGastada,
        cantidad_esperada: cantEsperada,`,
  `    const items: ItemVerificacion[] = productosTecnico.map((p) => {
      const cantGastada = Number(p.total_gastado_ordenes || p.cantidad_gastada || p.total_liquidadas) || 0;
      const cantDevueltaPrevia = Number(p.total_devuelto_almacen) || 0;
      const cantEsperada = Number(p.stock) || 0;
      const cantAsignada = Number(p.total_despachado_historial || p.cantidad_asignada || p.total_asignadas) || (cantEsperada + cantGastada + cantDevueltaPrevia);

      return {
        id_producto: p.id_producto,
        producto_nombre: p.producto_nombre,
        producto_codigo: p.producto_codigo || "-",
        categoria: p.categoria || "MATERIALES",
        es_drop: Boolean(p.es_drop),
        cantidad_asignada: cantAsignada,
        cantidad_gastada: cantGastada,
        cantidad_devuelta_previa: cantDevueltaPrevia,
        cantidad_esperada: cantEsperada,`
);

// 3. Update table header
content = content.replace(
  `<th className="py-3 px-3 text-center">Cant. Asignada</th>
                      <th className="py-3 px-3 text-center">Gastado (Órdenes)</th>
                      <th className="py-3 px-3 text-center">En Auto (Saldo)</th>`,
  `<th className="py-3 px-3 text-center">Cant. Asignada</th>
                      <th className="py-3 px-3 text-center">Gastado (Órdenes)</th>
                      <th className="py-3 px-3 text-center">Devuelto (Almacén)</th>
                      <th className="py-3 px-3 text-center">En Auto (Saldo)</th>`
);

// 4. Update table colSpan
content = content.replace(
  `<td colSpan={9} className="py-8 text-center text-slate-400 font-medium">`,
  `<td colSpan={10} className="py-8 text-center text-slate-400 font-medium">`
);

// 5. Update table row data
content = content.replace(
  `{/* Gastado / Liquidado */}
                            <td className="py-3.5 px-3 text-center">
                              {item.cantidad_gastada > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-amber-50 text-amber-800 border border-amber-200">
                                  {item.cantidad_gastada} {item.es_drop ? "m" : ""}
                                </span>
                              ) : (
                                <span className="font-mono text-slate-400 font-semibold">0</span>
                              )}
                            </td>

                            {/* En Auto (Saldo esperado) */}`,
  `{/* Gastado / Liquidado */}
                            <td className="py-3.5 px-3 text-center">
                              {item.cantidad_gastada > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-amber-50 text-amber-800 border border-amber-200">
                                  {item.cantidad_gastada} {item.es_drop ? "m" : ""}
                                </span>
                              ) : (
                                <span className="font-mono text-slate-400 font-semibold">0</span>
                              )}
                            </td>

                            {/* Devuelto Previo a Almacén */}
                            <td className="py-3.5 px-3 text-center">
                              {(item.cantidad_devuelta_previa || 0) > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-orange-50 text-orange-800 border border-orange-300">
                                  {item.cantidad_devuelta_previa} {item.es_drop ? "m" : ""}
                                </span>
                              ) : (
                                <span className="font-mono text-slate-400 font-semibold">0</span>
                              )}
                            </td>

                            {/* En Auto (Saldo esperado) */}`
);

// 6. Update Excel generation to include Devuelto Previamente
content = content.replace(
  `"Gastado en Órdenes": it.cantidad_gastada || 0,
        "Esperado en Vehículo": it.cantidad_esperada,`,
  `"Gastado en Órdenes": it.cantidad_gastada || 0,
        "Devuelto Previamente": it.cantidad_devuelta_previa || 0,
        "Esperado en Vehículo": it.cantidad_esperada,`
);

fs.writeFileSync(target, content, 'utf8');
console.log('✅ TechnicianLiquidationTab.tsx actualizado con éxito');
