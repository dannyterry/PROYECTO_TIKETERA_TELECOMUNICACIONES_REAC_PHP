const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "telecom-local-dev-only-change-in-prod";

if (!process.env.JWT_SECRET) {
  console.warn("[AUTH] JWT_SECRET no está en el entorno. Usando secreto de desarrollo. Defínelo en producción.");
}

function signToken(user) {
  return jwt.sign(
    {
      id_usuario: user.id_usuario,
      id_rol: user.id_rol,
      usuario: user.usuario,
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

function isPublicPath(req) {
  const path = String(req.path || "").split("?")[0];
  const orig = String(req.originalUrl || req.url || "").split("?")[0];
  if (req.method === "OPTIONS") return true;
  if (path === "/" || path === "" || orig === "/" || orig === "") return true;
  if (path === "/login" || path === "/api/login" || orig === "/login" || orig === "/api/login") return true;
  if (path === "/logout" || path === "/api/logout" || orig === "/logout" || orig === "/api/logout") return true;
  if (path === "/time-diagnostic" || orig === "/time-diagnostic") return true;
  if (path.startsWith("/uploads") || orig.startsWith("/uploads")) return true;
  if (path.startsWith("/api/looker/") || path.startsWith("/looker/") || orig.startsWith("/api/looker/") || orig.startsWith("/looker/")) return true;
  if (path.startsWith("/api/win-audit/") || path.startsWith("/win-audit/") || orig.startsWith("/api/win-audit/") || orig.startsWith("/win-audit/")) return true;
  if (path.startsWith("/api/dashboard/") || path.startsWith("/dashboard/") || orig.startsWith("/api/dashboard/") || orig.startsWith("/dashboard/")) return true;
  if (
    path === "/tecnicos" || path === "/api/tecnicos" || path.startsWith("/api/tecnicos") || path.startsWith("/tecnicos") ||
    orig === "/tecnicos" || orig === "/api/tecnicos" || orig.startsWith("/api/tecnicos") || orig.startsWith("/tecnicos")
  ) return true;
  return false;
}

function requireAuth(req, res, next) {
  if (isPublicPath(req)) return next();

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ success: false, mensaje: "No autorizado. Inicie sesión." });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ success: false, mensaje: "Sesión inválida o expirada." });
  }
}

module.exports = { signToken, requireAuth, JWT_SECRET };
