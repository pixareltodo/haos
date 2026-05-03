import { normalizeDelimitedText } from '../../utils/urlUtils.js';

function fallbackCsfdId(csfdId) {
  return `csfd:${csfdId}`;
}

function normalizeMediaUrl(url) {
  if (!url) {
    return null;
  }

  return url.startsWith('//') ? `https:${url}` : url;
}

function pickMetaId(item, detail) {
  return detail?.stremioId || item?.stremioId || fallbackCsfdId(detail?.id || item?.csfdId);
}

function formatCsfdRating(detail) {
  if (typeof detail?.rating !== 'number') {
    return '';
  }

  const rounded = Math.round(detail.rating);
  const ratingCount = typeof detail?.ratingCount === 'number'
    ? ` (${new Intl.NumberFormat('cs-CZ').format(detail.ratingCount)} hodnoceni)`
    : '';

  return `CSFD: ${rounded} %${ratingCount}`;
}

function formatListDescription(item, detail) {
  if (detail?.description) {
    const ratingLine = formatCsfdRating(detail);
    return [ratingLine, detail.description].filter(Boolean).join('\n\n');
  }

  return [
    item.origin ? `Puvod: ${item.origin}` : '',
    item.genre ? `Zanr: ${item.genre}` : '',
    item.typeLabel ? `Typ: ${item.typeLabel}` : ''
  ].filter(Boolean).join('\n');
}

function toNames(people = [], limit = 12) {
  return people
    .map((person) => person?.name)
    .filter(Boolean)
    .slice(0, limit);
}

function buildLinks(detail) {
  const links = [];

  if (detail?.url) {
    links.push({
      name: 'CSFD',
      category: 'Read more',
      url: detail.url
    });
  }

  if (detail?.tmdbId) {
    links.push({
      name: 'TMDB',
      category: 'Read more',
      url: `https://www.themoviedb.org/${detail.tmdbMediaType === 'tv' ? 'tv' : 'movie'}/${detail.tmdbId}`
    });
  }

  for (const vod of detail?.vod || []) {
    if (!vod?.title || !vod?.url) {
      continue;
    }

    links.push({
      name: vod.title,
      category: 'Watch',
      url: vod.url
    });
  }

  return links;
}

function buildTrailers(detail) {
  return (detail?.trailers || [])
    .filter((trailer) => trailer?.source)
    .map((trailer) => ({
      source: trailer.source,
      type: trailer.type || 'Trailer'
    }));
}

function formatRuntime(minutes) {
  const value = Number(minutes || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return `${value}m`;
}

export function toStremioId(csfdId, detail = null, item = null) {
  return pickMetaId(item, detail) || fallbackCsfdId(csfdId);
}

export function mapListItemToMeta(item, catalogType, detail = null) {
  const genres = detail?.genres?.length
    ? detail.genres
    : normalizeDelimitedText(item.genre);

  const releaseInfo = detail?.year || item.year || '';

  return {
    id: toStremioId(item.csfdId, detail, item),
    type: catalogType,
    name: detail?.title || item.title,
    poster: normalizeMediaUrl(detail?.poster || '') || null,
    background: normalizeMediaUrl(detail?.background || detail?.poster || '') || null,
    posterShape: 'poster',
    description: formatListDescription(item, detail),
    genres,
    releaseInfo,
    links: buildLinks(detail)
  };
}

export function mapDetailToMeta(detail, catalogType, requestedMetaId = null) {
  const ratingLine = formatCsfdRating(detail);
  const description = [ratingLine, detail.description || '']
    .filter(Boolean)
    .join('\n\n');
  const metaId = requestedMetaId || toStremioId(detail.id, detail);

  return {
    id: metaId,
    type: catalogType,
    name: detail.title,
    poster: normalizeMediaUrl(detail.poster || '') || null,
    background: normalizeMediaUrl(detail.background || detail.poster || '') || null,
    posterShape: 'poster',
    description,
    genres: detail.genres || [],
    releaseInfo: detail.year || '',
    released: detail.releaseDate || undefined,
    cast: toNames(detail.creators?.actors, 20),
    director: toNames(detail.creators?.directors, 8),
    writer: toNames(detail.creators?.writers, 8),
    country: Array.isArray(detail.origins) ? detail.origins.join(', ') : '',
    runtime: formatRuntime(detail.duration),
    links: buildLinks(detail),
    trailers: buildTrailers(detail)
  };
}
