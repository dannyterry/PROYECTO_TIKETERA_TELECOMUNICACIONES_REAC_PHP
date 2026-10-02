const fs = require('fs');
const path = require('path');
const { uploadFileToS3, checkS3ObjectExists } = require('../services/s3Service');

async function migrate() {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('No existe la carpeta uploads.');
    process.exit(0);
  }

  const files = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.') && fs.statSync(path.join(uploadsDir, f)).isFile());
  console.log(`🚀 [S3 Migration] Encontrados ${files.length} archivos en /uploads para migrar a S3...`);

  let count = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const s3Key = `uploads/${file}`;

    try {
      const alreadyExists = await checkS3ObjectExists(s3Key);
      if (alreadyExists) {
        console.log(`⚡ [S3 Migration] (${count + 1}/${files.length}) Ya existe en S3: ${s3Key}`);
      } else {
        console.log(`📤 [S3 Migration] (${count + 1}/${files.length}) Subiendo a S3: ${file}...`);
        await uploadFileToS3(filePath, s3Key);
      }
      count++;
    } catch (e) {
      console.error(`❌ [S3 Migration] Error subiendo ${file}:`, e.message);
      errors++;
    }
  }

  console.log('==================================================');
  console.log(`✅ [S3 Migration] Migración completada. ${count} archivos procesados, ${errors} errores.`);
  console.log('==================================================');
  process.exit(0);
}

migrate();
