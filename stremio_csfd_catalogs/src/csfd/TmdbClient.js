import { normalizeSearchText } from '../utils/urlUtils.js';

function extractYear(value) {
  const match = `${value || ''}`.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

function scoreName(candidateTitle, expectedTitle) {
  if (!candidateTitle || !expectedTitle) {
    return 0;
  }

  if (candidateTitle === expectedTitle) {
    return 100;
  }

  if (candidateTitle.startsWith(expectedTitle) || expectedTitle.startsWith(candidateTitle)) {
    return 70;
  }

  if (candidateTitle.includes(expectedTitle) || expectedTitle.includes(candidateTitle)) {
    return 45;
  }

  return 0;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildQueryVariants(title, aliases = []) {
  const rawTitles = unique([
    title,
    ...aliases
  ].map((value) => `${value || ''}`.trim()).filter(Boolean));

  const variants = [];
  for (const raw of rawTitles) {
    const normalized = normalizeSearchText(raw);
    const deArticled = normalized
      .replace(/\b(a|an|the)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    variants.push(raw, normalized, deArticled);
  }

  return unique(variants);
}

function buildYearVariants(year) {
  const expectedYear = extractYear(year);
  if (!expectedYear) {
    return [null];
  }

  const yearNumber = Number(expectedYear);
  return unique([
    expectedYear,
    `${yearNumber + 1}`,
    `${yearNumber - 1}`,
    null
  ]);
}

function scoreTmdbResult(candidate, expectedTitles, expectedYear) {
  const candidateTitles = [
    candidate.title,
    candidate.name,
    candidate.original_title,
    candidate.original_name
  ]
    .map((value) => normalizeSearchText(value))
    .filter(Boolean);
  const year = extractYear(
    candidate.release_date
    || candidate.first_air_date
    || ''
  );

  let score = 0;
  for (const candidateTitle of candidateTitles) {
    for (const expectedTitle of expectedTitles) {
      score = Math.max(score, scoreName(candidateTitle, expectedTitle));
    }
  }

  if (expectedYear && year === expectedYear) {
    score += 40;
  }
  else if (expectedYear && year && Math.abs(Number(year) - Number(expectedYear)) <= 1) {
    score += 15;
  }

  return score;
}

function imageUrl(path, size = 'original') {
  if (!path) {
    return '';
  }

  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function toTrailerObjects(videos = []) {
  return videos
    .filter((video) => video?.site === 'YouTube' && video?.key)
    .sort((left, right) => {
      const leftOfficial = left.official ? 1 : 0;
      const rightOfficial = right.official ? 1 : 0;
      if (leftOfficial !== rightOfficial) {
        return rightOfficial - leftOfficial;
      }

      const leftType = left.type === 'Trailer' ? 1 : 0;
      const rightType = right.type === 'Trailer' ? 1 : 0;
      return rightType - leftType;
    })
    .slice(0, 5)
    .map((video) => ({
      source: video.key,
      type: video.type === 'Clip' ? 'Clip' : 'Trailer',
      name: video.name || video.type || 'Trailer'
    }));
}

export class TmdbClient {
  constructor(options, logger) {
    this.logger = logger;
    this.enabled = options.tmdb_enabled !== false && Boolean(options.tmdb_api_read_access_token);
    this.token = options.tmdb_api_read_access_token || '';
    this.language = options.tmdb_language || 'cs-CZ';
    this.fallbackLanguage = options.tmdb_fallback_language || 'en-US';
  }

  async fetchJson(url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`TMDB returned ${response.status} for ${url}`);
    }

    return response.json();
  }

  async searchByText(title, year, catalogType = 'movie', aliases = []) {
    if (!this.enabled || !title) {
      return null;
    }

    const expectedTitles = unique([
      title,
      ...aliases
    ].map((value) => normalizeSearchText(value)).filter(Boolean));
    const expectedYear = extractYear(year);
    const mediaType = catalogType === 'series' ? 'tv' : 'movie';
    let best = null;
    const queries = buildQueryVariants(title, aliases);
    const yearVariants = buildYearVariants(year);
    const languages = unique([
      this.language,
      this.fallbackLanguage && this.fallbackLanguage !== this.language ? this.fallbackLanguage : null
    ]);
    const visitedRequests = new Set();

    for (const queryText of queries) {
      for (const yearVariant of yearVariants) {
        for (const language of languages) {
          const yearParam = yearVariant
            ? mediaType === 'movie'
              ? `&year=${yearVariant}`
              : `&first_air_date_year=${yearVariant}`
            : '';
          const requestKey = `${language}|${yearVariant || 'none'}|${queryText}`;
          if (visitedRequests.has(requestKey)) {
            continue;
          }

          visitedRequests.add(requestKey);
          const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?query=${encodeURIComponent(queryText)}&language=${encodeURIComponent(language)}&include_adult=false${yearParam}`;
          const payload = await this.fetchJson(searchUrl);

          for (const candidate of payload.results || []) {
            const score = scoreTmdbResult(candidate, expectedTitles, expectedYear);
            if (!best || score > best.score) {
              best = { score, candidate };
            }
          }

          if (best?.score >= 125) {
            break;
          }
        }

        if (best?.score >= 125) {
          break;
        }
      }

      if (best?.score >= 125) {
        break;
      }
    }

    if (!best || best.score < 60) {
      return null;
    }

    return this.fetchDetails(best.candidate.id, catalogType);
  }

  async findByImdbId(imdbId, catalogType = 'movie') {
    if (!this.enabled || !imdbId) {
      return null;
    }

    const payload = await this.fetchJson(
      `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&language=${encodeURIComponent(this.language)}`
    );

    const results = catalogType === 'series'
      ? payload.tv_results || []
      : payload.movie_results || [];

    if (!results.length) {
      return null;
    }

    return this.fetchDetails(results[0].id, catalogType);
  }

  async fetchDetails(tmdbId, catalogType = 'movie') {
    if (!this.enabled || !tmdbId) {
      return null;
    }

    const mediaType = catalogType === 'series' ? 'tv' : 'movie';
    const details = await this.fetchJson(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?language=${encodeURIComponent(this.language)}&append_to_response=videos,external_ids`
    );

    let imdbId = details.imdb_id || details.external_ids?.imdb_id || null;
    if (!imdbId && this.fallbackLanguage && this.fallbackLanguage !== this.language) {
      const fallbackDetails = await this.fetchJson(
        `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?language=${encodeURIComponent(this.fallbackLanguage)}&append_to_response=videos,external_ids`
      );
      imdbId = imdbId || fallbackDetails.imdb_id || fallbackDetails.external_ids?.imdb_id || null;
      details.videos = details.videos?.results?.length ? details.videos : fallbackDetails.videos;
      details.poster_path = details.poster_path || fallbackDetails.poster_path;
      details.backdrop_path = details.backdrop_path || fallbackDetails.backdrop_path;
      details.overview = details.overview || fallbackDetails.overview || '';
    }

    return {
      tmdbId: `${details.id}`,
      tmdbMediaType: mediaType,
      imdbId,
      title: details.title || details.name || '',
      originalTitle: details.original_title || details.original_name || '',
      overview: details.overview || '',
      poster: imageUrl(details.poster_path),
      background: imageUrl(details.backdrop_path),
      releaseDate: details.release_date || details.first_air_date || '',
      trailers: toTrailerObjects(details.videos?.results || [])
    };
  }
}
