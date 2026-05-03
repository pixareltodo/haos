function defaultTestMovie() {
  return {
    title: 'Certoviny',
    year: 2017,
    type: 'movie'
  };
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

    const mapped = (results || []).slice(0, 5).map((entry) => ({
      type: entry.type,
      score: entry.score,
      title: entry.movie?.title || '',
      year: entry.movie?.year || null,
      ids: entry.movie?.ids || {}
    }));

    return {
      ok: true,
      authorized: Boolean(token?.access_token),
      query: target,
      resultCount: mapped.length,
      results: mapped
    };
  }
}
