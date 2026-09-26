const fs = require('node:fs');
for (const file of ['extension.cjs', 'host.cjs']) fs.copyFileSync(`src/${file}`, `dist/${file}`);
