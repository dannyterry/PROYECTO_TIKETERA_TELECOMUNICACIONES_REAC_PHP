const bcrypt = require("bcryptjs");

const ROUNDS = 10;

function isHashed(value) {
  return typeof value === "string" && /^\$2[aby]\$/.test(value);
}

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), ROUNDS);
}

async function verifyPassword(plain, stored) {
  const given = String(plain ?? "");
  const current = String(stored ?? "");
  if (!given || !current) return false;
  if (isHashed(current)) {
    return bcrypt.compare(given, current);
  }
  return given.trim() === current.trim();
}

module.exports = { isHashed, hashPassword, verifyPassword };
