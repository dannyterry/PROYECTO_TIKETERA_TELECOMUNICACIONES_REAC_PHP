const fs = require('fs');

const content = fs.readFileSync('d:/proyecrh/base_de_nube_28_08_2026.sql', 'utf8');
const match = content.match(/CREATE TABLE `ordenes` \(([\s\S]*?)\) ENGINE/);
if (match) {
  console.log('Estructura ordenes en nube:');
  console.log(match[1]);
}
