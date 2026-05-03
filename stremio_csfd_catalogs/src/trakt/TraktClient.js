function defaultTestMovie() {
  return {
    title: 'Certoviny',
    year: 2017,
    type: 'movie'
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractYear(value) {
  const match = `${value || ''}`.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

function normalizeMovieCandidate(entry) {
  return {
    type: entry.type,
    score: entry.score,
    title: entry.movie?.title || '',
    originalTitle: entry.movie?.original_title || '',
    year: entry.movie?.year || null,
    ids: entry.movie?.ids || {}
  };
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

function normalizeTitle(value) {
  return `${value || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildQueryVariants(title, aliases = []) {
  const rawTitles = unique([
    title,
    ...aliases
  ].map((value) => `${value || ''}`.trim()).filter(Boolean));

  const variants = [];
  for (const raw of rawTitles) {
    const normalized = normalizeTitle(raw);
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

function scoreMovieCandidate(entry, expectedTitles, expectedYear) {
  const candidate = normalizeMovieCandidate(entry);
  const candidateTitles = unique([
    candidate.title,
    candidate.originalTitle
  ].map((value) => normalizeTitle(value)).filter(Boolean));
  const candidateYear = extractYear(candidate.year);
  let score = 0;

  for (const candidateTitle of candidateTitles) {
    for (const expectedTitle of expectedTitles) {
      score = Math.max(score, scoreName(candidateTitle, expectedTitle));
    }
  }

  if (expectedYear && candidateYear === expectedYear) {
    score += 40;
  }
  else if (expectedYear && candidateYear && Math.abs(Number(candidateYear) - Number(expectedYear)) <= 1) {
    score += 15;
  }

  if (candidate.ids?.imdb) {
    score += 10;
  }

  return {
    ...candidate,
    score
  };
}

function isDeviceExpired(device) {
  if (!device?.expires_at) {
    return false;
  }

  return Date.now() >= new Date(device.expires_at).getTime();
}

function buildHeaders(clientId, accessToken = '') {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/plain, */*',
    'accept-language': 'cs-CZ,cs;q=0.9,en;q=0.8',
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
    // Cloudflare currently blocks Node's default fetch fingerprint for Trakt.
    // Sending a browser-like request shape keeps the OAuth device flow usable.
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    origin: 'https://trakt.tv',
    referer: 'https://trakt.tv/',
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty'
  };

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function normalizeTokenPayload(payload) {
  if (!payload?.access_token) {
    return null;
  }

  const createdAt = Number(payload.created_at || Math.floor(Date.now() / 1000));
  const expiresIn = Number(payload.expires_in || 0);

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || '',
    token_type: payload.token_type || 'Bearer',
    scope: payload.scope || 'public',
    created_at: createdAt,
    expires_in: expiresIn,
    expires_at: createdAt && expiresIn
      ? new Date((createdAt + expiresIn) * 1000).toISOString()
      : null
  };
}

function isTokenExpired(token) {
  if (!token?.expires_at) {
    return false;
  }

  return Date.now() >= new Date(token.expires_at).getTime() - 60_000;
}

export class TraktClient {
  constructor(options, logger, authStore) {
    this.logger = logger;
    this.authStore = authStore;
    this.enabled = options.trakt_enabled === true;
    this.clientId = options.trakt_client_id || '';
    this.clientSecret = options.trakt_client_secret || '';
    this.baseUrl = 'https://api.trakt.tv';
  }

  get configured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async fetchJson(url, { method = 'GET', body = null, accessToken = '' } = {}) {
    const response = await fetch(url, {
      method,
      headers: buildHeaders(this.clientId, accessToken),
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      }
      catch {
        payload = { raw: text };
      }
    }

    if (!response.ok) {
      const error = new Error(`Trakt returned ${response.status} for ${url}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async startDeviceAuth() {
    if (!this.enabled) {
      throw new Error('Trakt integration is disabled.');
    }

    if (!this.configured) {
      throw new Error('Trakt client_id/client_secret is not configured.');
    }

    const payload = await this.fetchJson(`${this.baseUrl}/oauth/device/code`, {
      method: 'POST',
      body: {
        client_id: this.clientId
      }
    });

    const device = {
      device_code: payload.device_code,
      user_code: payload.user_code,
      verification_url: payload.verification_url,
      expires_in: payload.expires_in,
      interval: payload.interval,
      created_at: new Date().toISOString(),
      expires_at: payload.expires_in
        ? new Date(Date.now() + (payload.expires_in * 1000)).toISOString()
        : null
    };

    await this.authStore.saveDevice(device);
    return device;
  }

  async getOrStartDeviceAuth() {
    const state = await this.authStore.read();
    if (state.device?.device_code && !isDeviceExpired(state.device)) {
      return state.device;
    }

    return this.startDeviceAuth();
  }

  async completeDeviceAuth() {
    if (!this.enabled) {
      throw new Error('Trakt integration is disabled.');
    }

    if (!this.configured) {
      throw new Error('Trakt client_id/client_secret is not configured.');
    }

    const state = await this.authStore.read();
    if (!state.device?.device_code) {
      throw new Error('No pending Trakt device authorization found.');
    }

    const payload = await this.fetchJson(`${this.baseUrl}/oauth/device/token`, {
      method: 'POST',
      body: {
        code: state.device.device_code,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }
    });

    const token = normalizeTokenPayload(payload);
    await this.authStore.saveToken(token);
    return token;
  }

  async tryCompleteDeviceAuth() {
    try {
      const token = await this.completeDeviceAuth();
      return {
        ok: true,
        authorized: true,
        pending: false,
        token: {
          scope: token.scope || 'public',
          token_type: token.token_type || 'Bearer',
          expires_at: token.expires_at || null,
          has_refresh_token: Boolean(token.refresh_token)
        }
      };
    }
    catch (error) {
      const code = error?.payload?.error || error?.payload?.raw || error.message;
      if (error.status === 400 && (
        `${code}`.includes('authorization_pending')
        || `${code}`.includes('slow_down')
      )) {
        return {
          ok: true,
          authorized: false,
          pending: true,
          error: `${code}`
        };
      }

      if (error.status === 400 && (
        `${code}`.includes('access_denied')
        || `${code}`.includes('expired_token')
      )) {
        return {
          ok: false,
          authorized: false,
          pending: false,
          error: `${code}`
        };
      }

      throw error;
    }
  }

  async refreshAccessTokenIfNeeded() {
    if (!this.enabled || !this.configured) {
      return null;
    }

    const state = await this.authStore.read();
    const token = state.token;
    if (!token?.access_token) {
      return null;
    }

    if (!isTokenExpired(token)) {
      return token;
    }

    if (!token.refresh_token) {
      return token;
    }

    const payload = await this.fetchJson(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      body: {
        refresh_token: token.refresh_token,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        grant_type: 'refresh_token'
      }
    });

    const refreshedToken = normalizeTokenPayload(payload);
    await this.authStore.saveToken(refreshedToken);
    return refreshedToken;
  }

  async getStatus() {
    const state = await this.authStore.read();
    const token = state.token;

    return {
      enabled: this.enabled,
      configured: this.configured,
      hasClientId: Boolean(this.clientId),
      hasClientSecret: Boolean(this.clientSecret),
      devicePending: Boolean(state.device?.device_code),
      device: state.device,
      authorized: Boolean(token?.access_token),
      token: token
        ? {
            scope: token.scope || 'public',
            token_type: token.token_type || 'Bearer',
            expires_at: token.expires_at || null,
            has_refresh_token: Boolean(token.refresh_token)
          }
        : null
    };
  }

  async searchMovie(title, year = null, accessToken = '') {
    const params = new URLSearchParams({
      query: title,
      extended: 'full'
    });

    if (year) {
      params.set('years', `${year}`);
    }

    return this.fetchJson(`${this.baseUrl}/search/movie?${params.toString()}`, {
      accessToken
    });
  }

  async resolveMovie(title, year = null, aliases = []) {
    if (!this.enabled || !this.configured || !title) {
      return null;
    }

    const token = await this.refreshAccessTokenIfNeeded();
    const accessToken = token?.access_token || '';
    const expectedTitles = unique([
      title,
      ...aliases
    ].map((value) => normalizeTitle(value)).filter(Boolean));
    const expectedYear = extractYear(year);
    const queries = buildQueryVariants(title, aliases);
    const yearVariants = buildYearVariants(year);
    let best = null;

    for (const query of queries) {
      for (const yearVariant of yearVariants) {
        const results = await this.searchMovie(query, yearVariant, accessToken);
        for (const entry of results || []) {
          const candidate = scoreMovieCandidate(entry, expectedTitles, expectedYear);
          if (!best || candidate.score > best.score) {
            best = candidate;
          }
        }

        if (best?.score >= 130) {
          break;
        }
      }

      if (best?.score >= 130) {
        break;
      }
    }

    if (!best || best.score < 70) {
      return null;
    }

    return {
      traktId: best.ids?.trakt || null,
      imdbId: best.ids?.imdb || null,
      tmdbId: best.ids?.tmdb ? `${best.ids.tmdb}` : null,
      title: best.title || '',
      year: best.year || null,
      score: best.score
    };
  }

  async testMovieLookup({ title, year, type = 'movie' } = {}) {
    if (!this.enabled) {
      throw new Error('Trakt integration is disabled.');
    }

    if (!this.configured) {
      throw new Error('Trakt client_id/client_secret is not configured.');
    }

    const target = {
      ...defaultTestMovie(),
      ...(title ? { title } : {}),
      ...(year ? { year: Number(year) || year } : {}),
      ...(type ? { type } : {})
    };

    const token = await this.refreshAccessTokenIfNeeded();
    const results = await this.searchMovie(target.title, target.year, token?.access_token || '');

    const mapped = (results || []).slice(0, 5).map((entry) => normalizeMovieCandidate(entry));

    return {
      ok: true,
      authorized: Boolean(token?.access_token),
      query: target,
      resultCount: mapped.length,
      results: mapped
    };
  }
}
