import { normalizeSearchText } from '../utils/urlUtils.js';

function extractYear(value) {
  const match = `${value || ''}`.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

function buildQueries(title, aliases = []) {
  const sourceTitles = [...new Set([title, ...aliases].filter(Boolean))];
  const queries = [];

  for (const sourceTitle of sourceTitles) {
    const normalized = normalizeSearchText(sourceTitle);
    if (!normalized) {
      continue;
    }

    queries.push(
      normalized,
      normalized.replace(/\b(a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim()
    );
  }

  return [...new Set(queries.filter(Boolean))];
}

function scoreCandidate(candidate, expectedTitles, expectedYear) {
  const candidateTitle = normalizeSearchText(candidate.name);
  const candidateYear = extractYear(candidate.releaseInfo);
  let score = 0;

  for (const expectedTitle of expectedTitles) {
    if (candidateTitle === expectedTitle) {
      score = Math.max(score, 100);
    }
    else if (candidateTitle.startsWith(expectedTitle) || expectedTitle.startsWith(candidateTitle)) {
      score = Math.max(score, 70);
    }
    else if (candidateTitle.includes(expectedTitle) || expectedTitle.includes(candidateTitle)) {
      score = Math.max(score, 45);
    }
  }

  if (expectedYear && candidateYear === expectedYear) {
    score += 40;
  }
  else if (expectedYear && candidateYear && Math.abs(Number(candidateYear) - Number(expectedYear)) <= 1) {
    score += 15;
  }

  return score;
}

export class CinemetaMatcher {
  constructor({ logger }) {
    this.logger = logger;
  }

  async resolve(item, detail, catalogType = 'movie') {
    const aliases = Array.isArray(detail?.titlesOther)
      ? detail.titlesOther.map((entry) => entry?.title).filter(Boolean)
      : [];
    const expectedTitles = [...new Set([
      detail?.title || item?.title,
      ...aliases
    ].map((value) => normalizeSearchText(value)).filter(Boolean))];
    const expectedYear = extractYear(detail?.year || item?.year);
    const searchType = catalogType === 'series' ? 'series' : 'movie';
    const queries = buildQueries(detail?.title || item?.title, aliases);

    if (!expectedTitles.length || queries.length === 0) {
      return null;
    }

    let best = null;
    for (const query of queries) {
      const response = await fetch(`https://v3-cinemeta.strem.io/catalog/${searchType}/top/search=${encodeURIComponent(query)}.json`);
      if (!response.ok) {
        this.logger.warn('Cinemeta search failed', {
          query,
          status: response.status,
          catalogType: searchType
        });
        continue;
      }

      const payload = await response.json();
      for (const candidate of payload.metas || []) {
        const score = scoreCandidate(candidate, expectedTitles, expectedYear);
        if (!best || score > best.score) {
          best = { score, candidate };
        }
      }

      if (best?.score >= 140) {
        break;
      }
    }

    if (!best || best.score < 80) {
      return null;
    }

    const resolvedId = best.candidate.imdb_id || best.candidate.id;
    if (!resolvedId) {
      return null;
    }

    return {
      stremioId: resolvedId,
      imdbId: best.candidate.imdb_id || (best.candidate.id?.startsWith('tt') ? best.candidate.id : null),
      matchedName: best.candidate.name || '',
      matchedYear: extractYear(best.candidate.releaseInfo),
      matchedAt: new Date().toISOString(),
      poster: best.candidate.poster || '',
      background: best.candidate.background || ''
    };
  }
}
