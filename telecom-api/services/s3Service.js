const fs = require("fs");
const path = require("path");

// Cargar variables de entorno desde .env si existen localmente
try {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, "utf-8").split("\n");
    envLines.forEach((line) => {
      const parts = line.split("=");
      if (parts.length >= 2 && !line.trim().startsWith("#")) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
} catch (e) {}

let S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, getSignedUrl;
let s3Client = null;

const S3_REGION = process.env.AWS_REGION || "us-east-1";
const S3_BUCKET = process.env.AWS_BUCKET_NAME || "cespesdes-fotos-2026";
const S3_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const S3_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";

try {
  const s3Module = require("@aws-sdk/client-s3");
  S3Client = s3Module.S3Client;
  PutObjectCommand = s3Module.PutObjectCommand;
  GetObjectCommand = s3Module.GetObjectCommand;
  DeleteObjectCommand = s3Module.DeleteObjectCommand;
  HeadObjectCommand = s3Module.HeadObjectCommand;
  getSignedUrl = require("@aws-sdk/s3-request-presigner").getSignedUrl;

  if (S3_ACCESS_KEY && S3_SECRET_KEY) {
    s3Client = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
    });
    console.log("☁️ [AWS S3] Conector S3 inicializado correctamente.");
  } else {
    console.warn("⚠️ [AWS S3] Credenciales AWS_ACCESS_KEY_ID o AWS_SECRET_ACCESS_KEY no configuradas en entorno.");
  }
} catch (errSdk) {
  console.warn("⚠️ [AWS S3] SDK @aws-sdk/client-s3 no instalado aún en node_modules. Ejecuta 'Run NPM Install' en cPanel.");
}

/**
 * Detectar Content-Type según la extensión del archivo
 */
function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * 1. Subir Buffer a S3
 */
async function uploadBufferToS3(buffer, s3Key, contentType = "image/jpeg") {
  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    });
    await s3Client.send(command);
    console.log(`☁️ [AWS S3] Archivo subido exitosamente: s3://${S3_BUCKET}/${s3Key}`);
    return {
      success: true,
      bucket: S3_BUCKET,
      key: s3Key,
      s3Url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`,
    };
  } catch (error) {
    console.error(`❌ [AWS S3] Error al subir buffer (${s3Key}):`, error.message);
    throw error;
  }
}

/**
 * 2. Subir Archivo local a S3
 */
async function uploadFileToS3(localFilePath, s3Key, contentType = null) {
  try {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Archivo local no encontrado: ${localFilePath}`);
    }
    const fileStream = fs.createReadStream(localFilePath);
    const mime = contentType || getMimeType(s3Key || localFilePath);

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileStream,
      ContentType: mime,
    });

    await s3Client.send(command);
    console.log(`☁️ [AWS S3] Archivo local sincronizado con S3: s3://${S3_BUCKET}/${s3Key}`);
    return {
      success: true,
      bucket: S3_BUCKET,
      key: s3Key,
      s3Url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`,
    };
  } catch (error) {
    console.error(`❌ [AWS S3] Error al subir archivo local (${s3Key}):`, error.message);
    throw error;
  }
}

/**
 * 3. Generar URL firmada temporal de descarga/visualización
 */
async function getS3SignedUrl(s3Key, expiresInSeconds = 86400) {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return url;
  } catch (error) {
    console.error(`❌ [AWS S3] Error generando URL firmada (${s3Key}):`, error.message);
    return null;
  }
}

/**
 * 4. Obtener Stream de objeto en S3 (para servirlo por Express sin guardar en disco)
 */
async function getS3ObjectStream(s3Key) {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    });
    const response = await s3Client.send(command);
    return {
      stream: response.Body,
      contentType: response.ContentType || getMimeType(s3Key),
      contentLength: response.ContentLength,
    };
  } catch (error) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error(`❌ [AWS S3] Error al obtener stream (${s3Key}):`, error.message);
    return null;
  }
}

/**
 * 5. Verificar si existe un objeto en S3
 */
async function checkS3ObjectExists(s3Key) {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
      })
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 6. Eliminar objeto en S3
 */
async function deleteS3Object(s3Key) {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
      })
    );
    console.log(`🗑️ [AWS S3] Objeto eliminado: ${s3Key}`);
    return true;
  } catch (error) {
    console.error(`❌ [AWS S3] Error al eliminar (${s3Key}):`, error.message);
    return false;
  }
}

module.exports = {
  s3Client,
  S3_BUCKET,
  S3_REGION,
  uploadBufferToS3,
  uploadFileToS3,
  getS3SignedUrl,
  getS3ObjectStream,
  checkS3ObjectExists,
  deleteS3Object,
  getMimeType,
};
