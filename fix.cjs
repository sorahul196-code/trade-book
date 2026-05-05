const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixImports(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Automatically appends .js to all local imports
      content = content.replace(/from\s+["'](\.[^"']+)["']/g, (match, p1) => {
        if (p1.endsWith('.js') || p1.endsWith('.ts')) return match;
        return `from "${p1}.js"`;
      });
      
      fs.writeFileSync(fullPath, content);
    }
  }
}

fixImports('./api');
console.log('✅ Successfully added .js extensions to all API imports!');