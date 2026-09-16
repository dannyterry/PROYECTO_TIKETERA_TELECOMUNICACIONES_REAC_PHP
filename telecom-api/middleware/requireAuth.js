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
  if (req.method === "OPTIONS") return true;
  if (path === "/" || path === "") return true;
  if (path === "/login" || path === "/api/login") return true;
  if (path === "/logout" || path === "/api/logout") return true;
  if (path === "/time-diagnostic") return true;
  if (path.startsWith("/uploads")) return true;
  if (path.startsWith("/api/looker/") || path.startsWith("/looker/")) return true;
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
