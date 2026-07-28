import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionFile = path.join(__dirname, '../../.version');

// Format: [yyyy].[mm].[dd].[rev]
export function getVersion() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const dateVersion = `${year}.${month}.${day}`;

  // Read or initialize revision counter
  let revision = 0;
  if (fs.existsSync(versionFile)) {
    const content = fs.readFileSync(versionFile, 'utf-8').trim();
    const match = content.match(/^(\d+\.\d+\.\d+)\.(\d+)$/);
    if (match && match[1] === dateVersion) {
      revision = parseInt(match[2], 10) + 1;
    }
  }

  const version = `${dateVersion}.${revision}`;
  return version;
}

export function updateVersion() {
  const version = getVersion();
  fs.writeFileSync(versionFile, version, 'utf-8');
  return version;
}

export function readVersion() {
  if (fs.existsSync(versionFile)) {
    return fs.readFileSync(versionFile, 'utf-8').trim();
  }
  return updateVersion();
}
