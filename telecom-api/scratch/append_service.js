const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', '..', 'mi-proyecto', 'src', 'modules', 'inventory', 'services', 'inventoryService.ts');
let content = fs.readFileSync(target, 'utf8');

if (!content.includes('getKardexMovimientos')) {
  const codeToAdd = `

// --- 📊 KARDEX & MOVIMIENTOS GENERALES ---
export const getKardexMovimientos = async (params?: {
  fechaDesde?: string;
  fechaHasta?: string;
  tipo?: string;
  subtipo?: string;
  idProducto?: number;
  idCategoria?: number;
  idTrabajador?: number;
  search?: string;
}) => {
  const res = await api.get("/almacen/kardex-movimientos", { params });
  return res.data;
};
`;
  content = content.trimEnd() + codeToAdd;
  fs.writeFileSync(target, content, 'utf8');
  console.log('✅ getKardexMovimientos añadido correctamente a inventoryService.ts');
}
