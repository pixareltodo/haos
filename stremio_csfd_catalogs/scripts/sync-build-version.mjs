import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const buildInfoModule = await import(pathToFileURL(path.join(projectRoot, 'src', 'config', 'buildInfo.js')).href);
const { BUILD_INFO } = buildInfoModule;

async function updateTextFile(filePath, updater) {
  const current = await fs.readFile(filePath, 'utf8');
  const next = updater(current);
  if (next !== current) {
    await fs.writeFile(filePath, next, 'utf8');
  }
}

async function updateJsonFile(filePath, updater) {
  const current = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const next = updater(current);
  await fs.writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

await updateTextFile(path.join(projectRoot, 'config.yaml'), (content) => {
  return content.replace(/^version:\s*"[^"]+"$/m, `version: "${BUILD_INFO.version}"`);
});

await updateJsonFile(path.join(projectRoot, 'package.json'), (content) => ({
  ...content,
  version: BUILD_INFO.version
}));

await updateJsonFile(path.join(projectRoot, 'package-lock.json'), (content) => ({
  ...content,
  version: BUILD_INFO.version,
  packages: {
    ...content.packages,
    '': {
      ...content.packages?.[''],
      version: BUILD_INFO.version
    }
  }
}));

await updateJsonFile(path.join(projectRoot, 'dev.options.json'), (content) => ({
  ...content,
  addon_version: BUILD_INFO.version,
  addon_build_signature: BUILD_INFO.buildSignature
}));
