import fs from 'fs';
import path from 'path';
import {glob} from 'glob';

async function cleanupFile(filePath: string) {
    if (filePath.includes('node_modules')) return;
    let content = fs.readFileSync(filePath, 'utf8');

    let changed = false;

    // Fix react-dom/client.js
    if (content.includes("'react-dom/client'")) {
        content = content.replace(/'react-dom\/client\.js'/g, "'react-dom/client'");
        changed = true;
    }

    // Fix @rc-component/picker/es/generate.js -> @rc-component/picker/generate
    if (content.includes("'@rc-component/picker/generate'")) {
        content = content.replace(/'@rc-component\/picker\/es\/generate\.js'/g, "'@rc-component/picker/generate'");
        changed = true;
    }
    if (content.includes("'@rc-component/picker/generate'")) {
        content = content.replace(/'@rc-component\/picker\/es\/generate'/g, "'@rc-component/picker/generate'");
        changed = true;
    }

    if (changed) {
        console.log(`Cleaned up ${filePath}`);
        fs.writeFileSync(filePath, content);
    }
}

async function main() {
  const files = glob.sync('{packages,app,tool,bin}/**/*.{ts,tsx}', { posix: true });
  for (const file of files) {
    await cleanupFile(file);
  }
}

main().catch(console.error);
