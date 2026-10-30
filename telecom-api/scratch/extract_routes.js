'use strict';
/**
 * TELECOM-API ROUTE EXTRACTOR
 * Extracts route modules from the monolithic server.js
 */
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const routesDir = path.join(__dirname, '..', 'routes');
const middlewareDir = path.join(__dirname, '..', 'middleware');

const rawContent = fs.readFileSync(serverPath, 'utf8');
const rawLines = rawContent.split('\n');
// Strip \r for processing
const lines = rawLines.map(l => l.replace(/\r$/, ''));

console.log('Total lines:', lines.length);

// Known route start lines (1-based) from analysis
// Format: [startLine, endLine, method, url]
// endLine is startLine of NEXT route - 2 (to include blank line before next)
const ALL_ROUTES = [
  // Keep in server.js (admin/s3/misc):
  // L23-L36   GET /api/s3/foto
  // L40-L58   GET /uploads/:filename
  // L146-L146 GET /
  // L188-L248 GET /api/admin/migrar-uploads-a-s3
  // L399-L412 GET /api/admin/migrar-tareas-cache-a-s3
  // L423-L454 GET /limpiar-carpeta-basura
  
  // routes/auth.js
  { start: 457,  end: 553,  module: 'auth',      keep: false },
  { start: 555,  end: 565,  module: 'auth',      keep: false },
  { start: 568,  end: 588,  module: 'auth',      keep: false },
  { start: 591,  end: 633,  module: 'auth',      keep: false },
  { start: 637,  end: 639,  module: 'auth',      keep: false },
  { start: 809,  end: 890,  module: 'auth',      keep: false },
  { start: 892,  end: 959,  module: 'auth',      keep: false },
  { start: 969,  end: 1017, module: 'auth',      keep: false },
  
  // routes/empleados.js
  { start: 1023, end: 1052, module: 'empleados', keep: false },
  { start: 1056, end: 1142, module: 'empleados', keep: false },
  { start: 1180, end: 1290, module: 'empleados', keep: false },
  { start: 1293, end: 1353, module: 'empleados', keep: false },
  { start: 1356, end: 1368, module: 'empleados', keep: false },
  { start: 1371, end: 1408, module: 'empleados', keep: false },
  { start: 1411, end: 1426, module: 'empleados', keep: false },
  { start: 1429, end: 1434, module: 'empleados', keep: false },
  { start: 1436, end: 1446, module: 'empleados', keep: false },
  { start: 1448, end: 1458, module: 'empleados', keep: false },
  { start: 1460, end: 1466, module: 'empleados', keep: false },
  { start: 1469, end: 1479, module: 'empleados', keep: false },
  { start: 1481, end: 1512, module: 'empleados', keep: false },
  { start: 1717, end: 1737, module: 'empleados', keep: false },
  { start: 1739, end: 1761, module: 'empleados', keep: false },
  { start: 1763, end: 1809, module: 'empleados', keep: false },
  { start: 1811, end: 1817, module: 'empleados', keep: false },
  
  // routes/configuracion.js
  { start: 1514, end: 1528, module: 'configuracion', keep: false },
  { start: 1530, end: 1540, module: 'configuracion', keep: false },
  { start: 1542, end: 1552, module: 'configuracion', keep: false },
  { start: 1554, end: 1560, module: 'configuracion', keep: false },
  { start: 1567, end: 1584, module: 'configuracion', keep: false },
  { start: 1586, end: 1597, module: 'configuracion', keep: false },
  { start: 1599, end: 1617, module: 'configuracion', keep: false },
  { start: 1619, end: 1625, module: 'configuracion', keep: false },
  { start: 1628, end: 1633, module: 'configuracion', keep: false },
  { start: 1635, end: 1646, module: 'configuracion', keep: false },
  { start: 1648, end: 1682, module: 'configuracion', keep: false },
  { start: 1684, end: 1690, module: 'configuracion', keep: false },
  { start: 1693, end: 1698, module: 'configuracion', keep: false },
  { start: 1700, end: 1714, module: 'configuracion', keep: false },
  { start: 1823, end: 1841, module: 'configuracion', keep: false },
  { start: 1844, end: 1856, module: 'configuracion', keep: false },
  { start: 1859, end: 1877, module: 'configuracion', keep: false },
  { start: 1880, end: 1928, module: 'configuracion', keep: false },
  { start: 2753, end: 2816, module: 'configuracion', keep: false },
  { start: 2819, end: 2827, module: 'configuracion', keep: false },
  { start: 2830, end: 2896, module: 'configuracion', keep: false },
  { start: 2899, end: 2969, module: 'configuracion', keep: false },
  { start: 2972, end: 2998, module: 'configuracion', keep: false },
  { start: 3000, end: 3037, module: 'configuracion', keep: false },
  { start: 3039, end: 3047, module: 'configuracion', keep: false },
  { start: 3049, end: 3101, module: 'configuracion', keep: false },
  { start: 4270, end: 4280, module: 'configuracion', keep: false },
  { start: 4282, end: 4371, module: 'configuracion', keep: false },
  { start: 4373, end: 4421, module: 'configuracion', keep: false },
  { start: 17091, end: 17110, module: 'configuracion', keep: false },
  { start: 17112, end: 17130, module: 'configuracion', keep: false },
  { start: 17132, end: 17147, module: 'configuracion', keep: false },
  { start: 17149, end: 17191, module: 'configuracion', keep: false },
  
  // routes/pagos.js
  { start: 1931, end: 2098, module: 'pagos',     keep: false },
  { start: 2100, end: 2265, module: 'pagos',     keep: false },
  { start: 2270, end: 2362, module: 'pagos',     keep: false },
  { start: 2365, end: 2416, module: 'pagos',     keep: false },
  { start: 2419, end: 2489, module: 'pagos',     keep: false },
  { start: 2492, end: 2500, module: 'pagos',     keep: false },
  
  // routes/inventario_transferencias.js (ordenes section)
  { start: 3118, end: 3352, module: 'inventario_transferencias', keep: false },
  { start: 3358, end: 3410, module: 'inventario_transferencias', keep: false },
  { start: 3413, end: 3432, module: 'inventario_transferencias', keep: false },
  { start: 3435, end: 3835, module: 'inventario_transferencias', keep: false },
  { start: 3838, end: 3845, module: 'inventario_transferencias', keep: false },
  { start: 3848, end: 3856, module: 'inventario_transferencias', keep: false },
  { start: 3859, end: 3906, module: 'inventario_transferencias', keep: false },
  { start: 3909, end: 3924, module: 'inventario_transferencias', keep: false },
  { start: 3927, end: 4070, module: 'inventario_transferencias', keep: false },
  { start: 4073, end: 4177, module: 'inventario_transferencias', keep: false },
  { start: 4180, end: 4267, module: 'inventario_transferencias', keep: false },
  { start: 4424, end: 4460, module: 'inventario_transferencias', keep: false },
  { start: 4463, end: 4490, module: 'inventario_transferencias', keep: false },
  { start: 4493, end: 4520, module: 'inventario_transferencias', keep: false },
  { start: 4601, end: 4627, module: 'inventario_transferencias', keep: false },
  { start: 4630, end: 4644, module: 'inventario_transferencias', keep: false },
  { start: 4647, end: 4664, module: 'inventario_transferencias', keep: false },
  { start: 11019, end: 11083, module: 'inventario_transferencias', keep: false },
  { start: 12768, end: 12794, module: 'inventario_transferencias', keep: false },
  { start: 12796, end: 13248, module: 'inventario_transferencias', keep: false },
  { start: 17996, end: 18056, module: 'inventario_transferencias', keep: false },
  { start: 18059, end: 18261, module: 'inventario_transferencias', keep: false },
  { start: 18264, end: 18340, module: 'inventario_transferencias', keep: false },
  { start: 18343, end: 18527, module: 'inventario_transferencias', keep: false },
  { start: 18530, end: 18565, module: 'inventario_transferencias', keep: false },
  { start: 18568, end: 18634, module: 'inventario_transferencias', keep: false },
  
  // routes/movilidad.js
  { start: 4771, end: 4834, module: 'movilidad',  keep: false },
  { start: 4837, end: 4847, module: 'movilidad',  keep: false },
  { start: 4850, end: 4859, module: 'movilidad',  keep: false },
  { start: 4861, end: 4870, module: 'movilidad',  keep: false },
  { start: 4872, end: 4880, module: 'movilidad',  keep: false },
  { start: 4883, end: 4892, module: 'movilidad',  keep: false },
  { start: 4894, end: 4903, module: 'movilidad',  keep: false },
  { start: 4905, end: 4913, module: 'movilidad',  keep: false },
  { start: 4916, end: 4925, module: 'movilidad',  keep: false },
  { start: 4927, end: 4936, module: 'movilidad',  keep: false },
  { start: 4938, end: 4946, module: 'movilidad',  keep: false },
  { start: 4949, end: 4998, module: 'movilidad',  keep: false },
  { start: 5000, end: 5060, module: 'movilidad',  keep: false },
  { start: 5063, end: 5112, module: 'movilidad',  keep: false },
  { start: 5115, end: 5181, module: 'movilidad',  keep: false },
  { start: 5184, end: 5209, module: 'movilidad',  keep: false },
  { start: 5216, end: 5287, module: 'movilidad',  keep: false },
  { start: 5290, end: 5426, module: 'movilidad',  keep: false },
  { start: 5429, end: 5498, module: 'movilidad',  keep: false },
  { start: 5501, end: 5518, module: 'movilidad',  keep: false },
  { start: 5521, end: 5589, module: 'movilidad',  keep: false },
  { start: 5592, end: 5646, module: 'movilidad',  keep: false },
  { start: 5649, end: 5662, module: 'movilidad',  keep: false },
  { start: 5665, end: 5673, module: 'movilidad',  keep: false },
  { start: 5676, end: 5720, module: 'movilidad',  keep: false },
  { start: 5726, end: 6027, module: 'movilidad',  keep: false },
  { start: 6043, end: 6054, module: 'movilidad',  keep: false },
  { start: 6057, end: 6212, module: 'movilidad',  keep: false },
  
  // routes/almacen.js
  { start: 6219, end: 6520, module: 'almacen',    keep: false },
  { start: 6523, end: 6556, module: 'almacen',    keep: false },
  { start: 6559, end: 6825, module: 'almacen',    keep: false },
  { start: 6828, end: 6977, module: 'almacen',    keep: false },
  { start: 6980, end: 6993, module: 'almacen',    keep: false },
  { start: 6995, end: 7009, module: 'almacen',    keep: false },
  { start: 7011, end: 7023, module: 'almacen',    keep: false },
  { start: 7025, end: 7039, module: 'almacen',    keep: false },
  { start: 7042, end: 7174, module: 'almacen',    keep: false },
  { start: 7177, end: 7230, module: 'almacen',    keep: false },
  { start: 7233, end: 7285, module: 'almacen',    keep: false },
  { start: 7288, end: 7328, module: 'almacen',    keep: false },
  { start: 7331, end: 7371, module: 'almacen',    keep: false },
  { start: 7374, end: 7381, module: 'almacen',    keep: false },
  { start: 7383, end: 7403, module: 'almacen',    keep: false },
  { start: 7406, end: 7440, module: 'almacen',    keep: false },
  { start: 7443, end: 7451, module: 'almacen',    keep: false },
  { start: 7454, end: 7749, module: 'almacen',    keep: false },
  { start: 7752, end: 7820, module: 'almacen',    keep: false },
  { start: 7823, end: 7884, module: 'almacen',    keep: false },
  { start: 7887, end: 8023, module: 'almacen',    keep: false },
  { start: 8026, end: 8137, module: 'almacen',    keep: false },
  { start: 8140, end: 8262, module: 'almacen',    keep: false },
  { start: 8265, end: 8289, module: 'almacen',    keep: false },
  { start: 8292, end: 8568, module: 'almacen',    keep: false },
  { start: 8571, end: 8706, module: 'almacen',    keep: false },
  { start: 8709, end: 8866, module: 'almacen',    keep: false },
  { start: 8869, end: 9078, module: 'almacen',    keep: false },
  { start: 9081, end: 9165, module: 'almacen',    keep: false },
  { start: 9168, end: 9278, module: 'almacen',    keep: false },
  { start: 9281, end: 9405, module: 'almacen',    keep: false },
  { start: 9408, end: 9507, module: 'almacen',    keep: false },
  { start: 9510, end: 9666, module: 'almacen',    keep: false },
  { start: 9669, end: 9796, module: 'almacen',    keep: false },
  { start: 9799, end: 9948, module: 'almacen',    keep: false },
  { start: 9951, end: 9980, module: 'almacen',    keep: false },
  { start: 9983, end: 10015, module: 'almacen',   keep: false },
  { start: 10018, end: 10270, module: 'almacen',  keep: false },
  { start: 10273, end: 10381, module: 'almacen',  keep: false },
  { start: 10384, end: 10468, module: 'almacen',  keep: false },
  { start: 10471, end: 10625, module: 'almacen',  keep: false },
  { start: 10628, end: 10654, module: 'almacen',  keep: false },
  { start: 10659, end: 10724, module: 'almacen',  keep: false },
  { start: 10727, end: 10788, module: 'almacen',  keep: false },
  { start: 10791, end: 10818, module: 'almacen',  keep: false },
  { start: 10821, end: 10836, module: 'almacen',  keep: false },
  { start: 10839, end: 10908, module: 'almacen',  keep: false },
  { start: 10911, end: 10930, module: 'almacen',  keep: false },
  { start: 10934, end: 11016, module: 'almacen',  keep: false },
  { start: 11086, end: 11407, module: 'almacen',  keep: false },
  { start: 11410, end: 11418, module: 'almacen',  keep: false },
  { start: 11421, end: 11529, module: 'almacen',  keep: false },
  { start: 11532, end: 11544, module: 'almacen',  keep: false },
  { start: 11547, end: 11711, module: 'almacen',  keep: false },
  { start: 11714, end: 11827, module: 'almacen',  keep: false },
  { start: 11830, end: 12044, module: 'almacen',  keep: false },
  { start: 12047, end: 12256, module: 'almacen',  keep: false },
  { start: 12259, end: 12345, module: 'almacen',  keep: false },
  { start: 12348, end: 12500, module: 'almacen',  keep: false },
  { start: 12503, end: 12514, module: 'almacen',  keep: false },
  { start: 12517, end: 12758, module: 'almacen',  keep: false },
  { start: 13251, end: 13319, module: 'almacen',  keep: false },
  { start: 13322, end: 13357, module: 'almacen',  keep: false },
  { start: 13360, end: 13384, module: 'almacen',  keep: false },
  { start: 13387, end: 13437, module: 'almacen',  keep: false },
  
  // routes/auditoria.js
  { start: 13444, end: 13491, module: 'auditoria', keep: false },
  { start: 13498, end: 13538, module: 'auditoria', keep: false },
  { start: 13541, end: 13564, module: 'auditoria', keep: false },
  { start: 13567, end: 13606, module: 'auditoria', keep: false },
  { start: 13609, end: 13617, module: 'auditoria', keep: false },
  { start: 13620, end: 13653, module: 'auditoria', keep: false },
  { start: 13656, end: 13691, module: 'auditoria', keep: false },
  { start: 13694, end: 13734, module: 'auditoria', keep: false },
  { start: 13737, end: 13833, module: 'auditoria', keep: false },
  { start: 13836, end: 14029, module: 'auditoria', keep: false },
  
  // routes/dashboard.js
  { start: 14035, end: 14324, module: 'dashboard', keep: false },
  { start: 14329, end: 14531, module: 'dashboard', keep: false },
  { start: 14534, end: 14618, module: 'dashboard', keep: false },
  { start: 14621, end: 14962, module: 'dashboard', keep: false },
  { start: 14965, end: 15073, module: 'dashboard', keep: false },
  { start: 15076, end: 15448, module: 'dashboard', keep: false },
  { start: 15453, end: 15649, module: 'dashboard', keep: false },
  { start: 15654, end: 15868, module: 'dashboard', keep: false },
  { start: 15873, end: 16105, module: 'dashboard', keep: false },
  { start: 16111, end: 16195, module: 'dashboard', keep: false },
  { start: 16201, end: 16283, module: 'dashboard', keep: false },
  
  // routes/win_audit.js
  { start: 16296, end: 16376, module: 'win_audit', keep: false },
  { start: 16379, end: 16448, module: 'win_audit', keep: false },
  { start: 16451, end: 16565, module: 'win_audit', keep: false },
  
  // routes/looker.js
  { start: 16577, end: 16629, module: 'looker',   keep: false },
  { start: 16631, end: 16650, module: 'looker',   keep: false },
  { start: 16653, end: 16699, module: 'looker',   keep: false },
  { start: 16700, end: 16720, module: 'looker',   keep: false },
  { start: 16723, end: 16884, module: 'looker',   keep: false },
  { start: 16887, end: 16991, module: 'looker',   keep: false },
  { start: 16993, end: 17086, module: 'looker',   keep: false },
  
  // routes/supervision.js
  { start: 17198, end: 17226, module: 'supervision', keep: false },
  { start: 17229, end: 17253, module: 'supervision', keep: false },
  { start: 17256, end: 17301, module: 'supervision', keep: false },
  { start: 17304, end: 17347, module: 'supervision', keep: false },
  { start: 17350, end: 17360, module: 'supervision', keep: false },
  { start: 17363, end: 17399, module: 'supervision', keep: false },
  { start: 17402, end: 17502, module: 'supervision', keep: false },
  { start: 17505, end: 17512, module: 'supervision', keep: false },
  { start: 17515, end: 17558, module: 'supervision', keep: false },
  { start: 17561, end: 17628, module: 'supervision', keep: false },
  { start: 17631, end: 17638, module: 'supervision', keep: false },
  { start: 17641, end: 17703, module: 'supervision', keep: false },
  { start: 17706, end: 17989, module: 'supervision', keep: false },
];

// Build a set of line numbers (1-based) that belong to route modules
const lineToModule = new Map();
for (const r of ALL_ROUTES) {
  for (let i = r.start; i <= r.end; i++) {
    lineToModule.set(i, r.module);
  }
}

// Group routes by module
const moduleRoutes = {};
for (const r of ALL_ROUTES) {
  if (!moduleRoutes[r.module]) moduleRoutes[r.module] = [];
  moduleRoutes[r.module].push(r);
}

// Collect lines for each module
const moduleLines = {};
for (const [mod, routes] of Object.entries(moduleRoutes)) {
  const linesForMod = [];
  for (const r of routes) {
    // Add a blank line separator before each route
    linesForMod.push('');
    for (let i = r.start - 1; i <= r.end - 1; i++) {
      linesForMod.push(lines[i]);
    }
  }
  moduleLines[mod] = linesForMod;
}

// Helper: get first route line to determine url prefix
function getUrlPrefix(mod, routesList) {
  for (const r of routesList) {
    const line = lines[r.start - 1];
    const m = line.match(/['"`\[](\/[^'"`\]]*)/);
    if (m) return m[1];
  }
  return '/' + mod;
}

// Module-specific headers with correct requires
const moduleHeaders = {
  auth: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const https = require('https');
const { hashPassword, verifyPassword, isHashed } = require('../lib/password');
const { signToken, requireAuth } = require('../middleware/requireAuth');

// Note: /login, /logout, /time-diagnostic, /tecnicos are public (no requireAuth)
// /api/auth/me requires auth — kept as-is (requireAuth applied in server.js before this)
// sunat, sbs routes are also public
`,

  empleados: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const { hashPassword } = require('../lib/password');
const { upload, syncUploadedFilesToS3 } = require('../middleware/upload');

// Cache en memoria para empleados (10 segundos para proteger MySQL ante múltiples peticiones)
let cacheEmpleados = { data: null, timestamp: 0 };
`,

  configuracion: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const nodemailer = require('nodemailer');
`,

  pagos: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
`,

  inventario_transferencias: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const { upload, syncUploadedFilesToS3 } = require('../middleware/upload');
const { sincronizarTareasOrdenSeguro, getTareasDeBD, sincronizarTareasOrdenesActivas, guardarDetalleTareaEnBD, getMetrajeDeclaradoFenix } = require('../services/taskSyncService');
const { getMotivosCatalogo, resolverTipoTrabajoConCatalogo, resolverTipoTrabajoOficial, normalizeText } = require('../services/tipoTrabajoHelper');
const { uploadFileToS3, uploadBufferToS3, getS3SignedUrl } = require('../services/s3Service');
`,

  movilidad: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const { upload, syncUploadedFilesToS3 } = require('../middleware/upload');
`,

  almacen: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const { upload, syncUploadedFilesToS3 } = require('../middleware/upload');
const { getS3SignedUrl } = require('../services/s3Service');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
`,

  auditoria: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
`,

  dashboard: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
`,

  win_audit: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
`,

  looker: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const { fenixScraper } = require('../services/fenixScraper');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
`,

  supervision: `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
`,
};

// URL prefix map for router path rewriting
const urlPrefixMap = {
  almacen: '/api/almacen',
  movilidad: '/api/movilidad',
  supervision: '/api/supervision',
  dashboard: '/api/dashboard',
  looker: '/api/looker',
  win_audit: '/api/win-audit',
  auditoria: '/api/auditoria',
  configuracion: null,  // multiple prefixes — no stripping
  empleados: null,
  auth: null,
  pagos: null,
  inventario_transferencias: null,
};

// For modules with a clear prefix, we can strip it from routes
// For others, we keep the full path
function rewriteRouteLine(line, mod) {
  const prefix = urlPrefixMap[mod];
  if (!prefix) return line.replace(/^app\./, 'router.');
  
  // Replace app.METHOD('/api/prefix/... with router.METHOD('/...
  // Also handle array routes like app.get(['/api/prefix/a', '/api/prefix/b'])
  let result = line.replace(/^app\./, 'router.');
  
  // Strip the prefix from string literals
  const escapedPrefix = prefix.replace(/\//g, '\\/').replace(/-/g, '\\-');
  result = result.replace(new RegExp(`'${escapedPrefix}(/[^']*)?'`, 'g'), (m, rest) => `'${rest || '/'}'`);
  result = result.replace(new RegExp(`"${escapedPrefix}(/[^"]*)?"`,'g'), (m, rest) => `"${rest || '/'}"`);
  result = result.replace(new RegExp(`\`${escapedPrefix}(/[^\`]*)?\``,'g'), (m, rest) => `\`${rest || '/'}\``);
  
  return result;
}

// For auth module: special cases with arrays
function rewriteAuthLine(line) {
  return line.replace(/^app\./, 'router.');
}

// Write each module file
for (const [mod, routes] of Object.entries(moduleRoutes)) {
  const header = moduleHeaders[mod] || `'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
`;

  const sortedRoutes = routes.slice().sort((a, b) => a.start - b.start);
  
  let body = '';
  for (const r of sortedRoutes) {
    body += '\n';
    for (let i = r.start - 1; i <= r.end - 1; i++) {
      let line = lines[i];
      // Rewrite app.METHOD -> router.METHOD
      if (/^\s*app\.(get|post|put|delete|patch|all)\s*\(/.test(line)) {
        if (mod === 'auth') {
          line = line.replace(/^app\./, 'router.');
        } else {
          line = rewriteRouteLine(line, mod);
        }
      }
      body += line + '\n';
    }
  }

  const fileContent = header + body + '\nmodule.exports = router;\n';
  const filePath = path.join(routesDir, mod + '.js');
  fs.writeFileSync(filePath, fileContent, 'utf8');
  console.log(`✅ Written routes/${mod}.js (${sortedRoutes.length} routes, ${fileContent.split('\n').length} lines)`);
}

// Now compute which lines to KEEP in server.js
// Lines to keep: everything NOT in any route module
const extractedLineNums = new Set();
for (const r of ALL_ROUTES) {
  for (let i = r.start; i <= r.end; i++) {
    extractedLineNums.add(i);
  }
}

// Also identify helper functions between routes that need to go into shared modules
// For now, let's rebuild server.js by removing the extracted route lines
// and adding app.use() mounts

// Find the line number of app.listen (last 5 lines of file)
const listenLine = lines.findIndex(l => l.includes('app.listen(')) + 1;
console.log('app.listen found at line:', listenLine);

// Build new server.js: keep all non-route lines, then add mounts before app.listen
const newServerLines = [];
let i = 0;
while (i < lines.length) {
  const lineNum = i + 1; // 1-based
  if (extractedLineNums.has(lineNum)) {
    i++;
    // Skip consecutive extracted lines
  } else {
    newServerLines.push(rawLines[i]); // keep original \r\n
    i++;
  }
}

// Find where to insert the app.use mounts (before app.listen)
const listenIdx = newServerLines.findIndex(l => l.replace(/\r/, '').includes('app.listen('));
console.log('app.listen in new server at line:', listenIdx + 1);

// The router mounts to insert
const mounts = [
  '',
  '// ===== ROUTERS MODULARES =====',
  "app.use('/', require('./routes/auth'));",
  "app.use('/api/almacen', require('./routes/almacen'));",
  "app.use('/api/movilidad', require('./routes/movilidad'));",
  "app.use('/api/supervision', require('./routes/supervision'));",
  "app.use('/api/dashboard', require('./routes/dashboard'));",
  "app.use('/api/looker', require('./routes/looker'));",
  "app.use('/api/win-audit', require('./routes/win_audit'));",
  "app.use('/api/auditoria', require('./routes/auditoria'));",
  "app.use('/api/chat', require('./routes/auditoria'));",
  "app.use('/', require('./routes/configuracion'));",
  "app.use('/', require('./routes/empleados'));",
  "app.use('/', require('./routes/pagos'));",
  "app.use('/', require('./routes/inventario_transferencias'));",
  '',
].map(l => l + '\r');

newServerLines.splice(listenIdx, 0, ...mounts);

const newServerContent = newServerLines.join('\n');
fs.writeFileSync(serverPath + '.backup', rawContent, 'utf8');
fs.writeFileSync(serverPath, newServerContent, 'utf8');
console.log('✅ server.js rewritten with router mounts');
console.log('✅ Original backed up as server.js.backup');

// Count remaining app.routes in new server
const remainingRoutes = newServerLines.filter(l => /^\s*app\.(get|post|put|delete|patch|all)\s*\(/.test(l.replace(/\r/, '')));
console.log('Remaining routes in server.js:', remainingRoutes.length);
remainingRoutes.forEach(l => console.log(' ', l.replace(/\r/, '').trim().substring(0, 80)));
