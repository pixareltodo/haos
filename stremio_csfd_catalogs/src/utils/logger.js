const LEVELS = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR'
};

function formatMeta(meta) {
  if (!meta) {
    return '';
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  }
  catch {
    return '';
  }
}

function log(level, message, meta) {
  const stamp = new Date().toISOString();
  const normalizedLevel = LEVELS[level] || LEVELS.info;
  const line = `[${stamp}] [${normalizedLevel}] ${message}${formatMeta(meta)}`;

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug(message, meta) {
    log('debug', message, meta);
  },
  info(message, meta) {
    log('info', message, meta);
  },
  warn(message, meta) {
    log('warn', message, meta);
  },
  error(message, meta) {
    log('error', message, meta);
  }
};
