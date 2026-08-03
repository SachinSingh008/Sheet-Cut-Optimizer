import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDir = path.resolve(__dirname, '../dist/client');
const shellPath = path.join(clientDir, '_shell.html');
const indexPath = path.join(clientDir, 'index.html');

if (fs.existsSync(shellPath)) {
  fs.copyFileSync(shellPath, indexPath);
  console.log('✓ Successfully created dist/client/index.html from _shell.html');
} else {
  console.warn('⚠️ _shell.html not found in dist/client');
}
