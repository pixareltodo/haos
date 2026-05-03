import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  }
  catch {
    return false;
  }
}

export async function readJson(filePath, fallback = null) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }
  catch {
    return fallback;
  }
}

export async function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  const tempPath = `${filePath}.tmp`;
  await ensureDir(dir);
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function readText(filePath, fallback = '') {
  try {
    return await fs.readFile(filePath, 'utf8');
  }
  catch {
    return fallback;
  }
}
