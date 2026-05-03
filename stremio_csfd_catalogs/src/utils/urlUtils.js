import crypto from 'node:crypto';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ensureAbsoluteUrl(baseUrl, maybeRelative) {
  return new URL(maybeRelative, baseUrl).toString();
}

export function extractCsfdIdFromUrl(value) {
  if (!value) {
    return null;
  }

  const match = value.match(/\/film\/(\d+)-/i) || value.match(/\/film\/(\d+)/i);
  return match ? match[1] : null;
}

export function computeAnubisHash(randomData, nonce) {
  return crypto.createHash('sha256').update(`${randomData}${nonce}`, 'utf8').digest();
}

export function hashMatchesDifficulty(hashBuffer, difficulty) {
  const fullZeroBytes = Math.floor(difficulty / 2);
  for (let index = 0; index < fullZeroBytes; index += 1) {
    if (hashBuffer[index] !== 0) {
      return false;
    }
  }

  if (difficulty % 2 !== 0) {
    return (hashBuffer[fullZeroBytes] >> 4) === 0;
  }

  return true;
}

export function normalizeDelimitedText(value) {
  if (!value) {
    return [];
  }

  return value
    .split(/[\/,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeSearchText(value) {
  if (!value) {
    return '';
  }

  return `${value}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeTypeLabel(value) {
  if (!value) {
    return 'Film';
  }

  const normalized = normalizeSearchText(value);
  if (normalized === 'serial' || normalized === 'serialy' || normalized === 'series') {
    return 'Serial';
  }

  if (normalized === 'tv film' || normalized === 'tvfilm') {
    return 'TV film';
  }

  if (normalized === 'film') {
    return 'Film';
  }

  return value.trim();
}

export function parseMetaId(metaId) {
  if (!metaId) {
    return null;
  }

  const match = `${metaId}`.match(/^csfd:(\d+)$/i);
  return match ? match[1] : null;
}
