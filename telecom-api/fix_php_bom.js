const fs = require('fs');
const path = require('path');

function scanPhpFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanPhpFiles(filePath, fileList);
    } else if (file.endsWith('.php')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const appDir = 'C:\\xampp\\htdocs\\corporacionescepe\\app';
const phpFiles = scanPhpFiles(appDir);
let fixedFiles = [];

for (const file of phpFiles) {
  const buffer = fs.readFileSync(file);
  let content = buffer.toString('utf8');
  let hasBom = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
  let hasLeadingWhitespace = /^\s+<\?php/.test(content);

  if (hasBom || hasLeadingWhitespace) {
    console.log(`Fixing: ${file} (BOM: ${hasBom}, LeadingWS: ${hasLeadingWhitespace})`);
    // Remove BOM and leading whitespace before <?php
    if (hasBom) {
      content = content.replace(/^\uFEFF/, '');
    }
    content = content.replace(/^\s+<\?php/, '<?php');
    fs.writeFileSync(file, content, 'utf8');
    fixedFiles.push(file);
  }
}

console.log(`Total archivos PHP revisados: ${phpFiles.length}`);
console.log(`Total archivos corregidos: ${fixedFiles.length}`);
