const fs = require('fs');

const indexPath = 'C:\\xampp\\htdocs\\corporacionescepe\\index.php';
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  content = content.replace(/^\uFEFF/, '');
  if (!content.includes('ob_start()')) {
    content = content.replace(/<\?php\s*/, "<?php\nob_start();\n");
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('✅ ob_start() agregado a root index.php');
  } else {
    console.log('ℹ️ ob_start() ya estaba en root index.php');
  }
}
