import express from 'express';

function escapeHtml(value) {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTraktHomePage(status) {
  const badgeText = status.authorized
    ? 'Autorizovano'
    : status.enabled && status.configured
      ? 'Pripraveno k autorizaci'
      : 'Neni nakonfigurovano';
  const badgeClass = status.authorized
    ? 'ok'
    : status.enabled && status.configured
      ? 'warn'
      : 'bad';
  const expiryText = status.token?.expires_at
    ? new Date(status.token.expires_at).toLocaleString('cs-CZ')
    : 'neuvedeno';

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Trakt propojeni</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4efe7;
      --card: #fffdf8;
      --ink: #1f2937;
      --muted: #6b7280;
      --accent: #c2410c;
      --accent-2: #9a3412;
      --border: #e7dccd;
      --good: #166534;
      --good-bg: #dcfce7;
      --warn: #92400e;
      --warn-bg: #ffedd5;
      --bad: #991b1b;
      --bad-bg: #fee2e2;
    }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background: radial-gradient(circle at top, #fff7ed 0%, var(--bg) 55%, #efe4d4 100%);
      color: var(--ink);
      min-height: 100vh;
      padding: 24px;
    }
    .wrap {
      width: min(920px, 100%);
      margin: 0 auto;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(60, 30, 10, 0.12);
      padding: 32px;
      margin-bottom: 20px;
    }
    h1, h2 {
      margin: 0 0 10px;
    }
    p, li {
      color: var(--muted);
      font-size: 17px;
      line-height: 1.5;
    }
    .badge {
      display: inline-block;
      padding: 8px 12px;
      border-radius: 999px;
      font: 700 14px/1 Arial, sans-serif;
      margin-bottom: 18px;
    }
    .badge.ok { color: var(--good); background: var(--good-bg); }
    .badge.warn { color: var(--warn); background: var(--warn-bg); }
    .badge.bad { color: var(--bad); background: var(--bad-bg); }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin: 18px 0 10px;
    }
    a.button {
      display: inline-block;
      border-radius: 999px;
      padding: 12px 18px;
      background: var(--accent);
      color: white;
      text-decoration: none;
      font: 600 15px/1.2 Arial, sans-serif;
    }
    a.button.secondary {
      background: #e5ded3;
      color: var(--ink);
    }
    dl {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 10px 16px;
      margin: 18px 0 0;
    }
    dt {
      font: 700 14px/1.2 Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    dd {
      margin: 0;
      font: 500 16px/1.45 Arial, sans-serif;
      color: var(--ink);
      word-break: break-word;
    }
    code {
      font-family: "Courier New", monospace;
      background: #fff7ed;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 2px 6px;
    }
    ul {
      padding-left: 20px;
      margin: 12px 0 0;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>Trakt propojeni</h1>
      <div class="badge ${badgeClass}">${escapeHtml(badgeText)}</div>
      <p>Tady mas jedno klikaci misto pro Trakt. Nemusis lovit endpointy rucne.</p>
      <div class="actions">
        <a class="button" href="/admin/trakt/authorize">Autorizovat Trakt</a>
        <a class="button secondary" href="/admin/trakt/status" target="_blank" rel="noreferrer">Otevrit stav JSON</a>
        <a class="button secondary" href="/admin/trakt/test?title=Certoviny&year=2017" target="_blank" rel="noreferrer">Otestovat Certoviny</a>
      </div>
      <dl>
        <dt>Povoleno</dt><dd>${status.enabled ? 'ano' : 'ne'}</dd>
        <dt>Nakonfigurovano</dt><dd>${status.configured ? 'ano' : 'ne'}</dd>
        <dt>Autorizovano</dt><dd>${status.authorized ? 'ano' : 'ne'}</dd>
        <dt>Vyprsi token</dt><dd>${escapeHtml(expiryText)}</dd>
        <dt>Authorize URL</dt><dd><code>/admin/trakt/authorize</code></dd>
      </dl>
    </section>
    <section class="card">
      <h2>Jak poznas, ze se Trakt pouzil</h2>
      <ul>
        <li>otevri <code>/admin/csfd/matches/csfd_cz_sk_pohadky</code></li>
        <li>hledej <code>"resolutionSource":"trakt"</code> u konkretnich filmu</li>
        <li>v souhrnu uvidis i pocty podle zdroje parovani</li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

function renderAuthorizePage(device) {
  const pollIntervalMs = Math.max(Number(device?.interval || 5) * 1000, 3000);
  const safeUserCode = `${device?.user_code || ''}`;
  const safeVerificationUrl = `${device?.verification_url || 'https://trakt.tv/activate'}`;

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Trakt autorizace</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4efe7;
      --card: #fffdf8;
      --ink: #1f2937;
      --muted: #6b7280;
      --accent: #c2410c;
      --accent-2: #9a3412;
      --border: #e7dccd;
    }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background: radial-gradient(circle at top, #fff7ed 0%, var(--bg) 55%, #efe4d4 100%);
      color: var(--ink);
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(680px, 100%);
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(60, 30, 10, 0.12);
      padding: 32px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(30px, 6vw, 48px);
      line-height: 0.98;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.5;
    }
    .stack {
      display: grid;
      gap: 12px;
    }
    .code {
      margin: 28px 0 18px;
      padding: 18px 22px;
      border-radius: 18px;
      border: 1px dashed var(--accent);
      background: #fff7ed;
      color: var(--accent-2);
      font: 700 clamp(28px, 7vw, 44px)/1.1 "Courier New", monospace;
      letter-spacing: 0.14em;
      text-align: center;
      user-select: all;
    }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin: 18px 0 24px;
    }
    button, a.button {
      appearance: none;
      border: none;
      border-radius: 999px;
      padding: 12px 18px;
      background: var(--accent);
      color: white;
      text-decoration: none;
      font: 600 15px/1.2 Arial, sans-serif;
      cursor: pointer;
    }
    button.secondary {
      background: #e5ded3;
      color: var(--ink);
    }
    .status {
      padding: 16px 18px;
      border-radius: 16px;
      background: #f8f4ee;
      border: 1px solid var(--border);
      color: var(--ink);
      font: 600 16px/1.4 Arial, sans-serif;
    }
    .hint {
      margin-top: 18px;
      font-size: 15px;
      color: var(--muted);
    }
    .inline-links {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 12px;
      font: 600 14px/1.2 Arial, sans-serif;
    }
    .inline-links a {
      color: var(--accent-2);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Autorizace Trakt</h1>
    <div class="stack">
      <p>Otevri Trakt, pripadne se prihlas, potvrd pristup a tahle stranka si dokonceni sama pohlida.</p>
      <p>Kdyz Trakt neumozni predvyplnit kod primo v URL, mas ho tady zvlast, aby sel jednim klikem zkopirovat.</p>
    </div>
    <div class="code" id="code">${safeUserCode}</div>
    <div class="actions">
      <a class="button" href="${safeVerificationUrl}" target="_blank" rel="noreferrer">Otevrit Trakt aktivaci</a>
      <button type="button" class="secondary" id="copy-code">Kopirovat kod</button>
      <button type="button" class="secondary" id="refresh-code">Novy kod</button>
    </div>
    <div class="status" id="status">Cekam na potvrzeni v Traktu...</div>
    <div class="hint">Kdyz potvrdis pristup na Traktu, tahle stranka se automaticky prepne do hotoveho stavu.</div>
    <div class="inline-links">
      <a href="/admin/trakt">Zpet na Trakt rozcestnik</a>
      <a href="/admin/trakt/status" target="_blank" rel="noreferrer">Otevrit stav JSON</a>
    </div>
  </main>
  <script>
    const statusEl = document.getElementById('status');
    const codeEl = document.getElementById('code');
    const copyButton = document.getElementById('copy-code');
    const refreshButton = document.getElementById('refresh-code');

    async function copyCode() {
      const value = codeEl.textContent.trim();
      if (!value) {
        statusEl.textContent = 'Kod zatim neni k dispozici.';
        return;
      }

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(value);
          statusEl.textContent = 'Kod zkopirovan do schranky.';
          return;
        } catch {}
      }

      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.top = '-1000px';
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, input.value.length);

      try {
        const copied = document.execCommand('copy');
        statusEl.textContent = copied
          ? 'Kod zkopirovan do schranky.'
          : 'Kopirovani selhalo, oznac kod rucne.';
      } catch {
        statusEl.textContent = 'Kopirovani selhalo, oznac kod rucne.';
      } finally {
        document.body.removeChild(input);
      }
    }

    copyButton.addEventListener('click', copyCode);
    refreshButton.addEventListener('click', () => {
      window.location.href = '/admin/trakt/authorize?refresh=1';
    });

    async function poll() {
      try {
        const response = await fetch('/admin/trakt/authorize/poll', { credentials: 'same-origin' });
        if (!response.ok) {
          statusEl.textContent = 'Addon vratil chybu pri overeni autorizace.';
          return;
        }
        const payload = await response.json();

        if (payload.authorized) {
          statusEl.textContent = 'Trakt je autorizovany. Muzes tuhle stranku zavrit nebo jit zpet na rozcestnik.';
          return;
        }

        if (payload.pending) {
          statusEl.textContent = 'Cekam na potvrzeni v Traktu...';
        } else if (payload.error) {
          statusEl.textContent = 'Autorizace selhala: ' + payload.error;
          return;
        }
      } catch {
        statusEl.textContent = 'Spojeni s addonem se nepodarilo overit, zkus obnovit stranku.';
        return;
      }

      setTimeout(poll, ${pollIntervalMs});
    }

    poll();
  </script>
</body>
</html>`;
}

export function createTraktAdminRouter(traktClient) {
  const router = express.Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.type('html').send(renderTraktHomePage(await traktClient.getStatus()));
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/status', async (_req, res, next) => {
    try {
      res.json(await traktClient.getStatus());
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/device/start', async (_req, res, next) => {
    try {
      res.json(await traktClient.startDeviceAuth());
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/device/complete', async (_req, res, next) => {
    try {
      res.json(await traktClient.completeDeviceAuth());
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/authorize', async (req, res, next) => {
    try {
      const device = `${req.query.refresh || ''}`.trim()
        ? await traktClient.startDeviceAuth()
        : await traktClient.getOrStartDeviceAuth();
      res.type('html').send(renderAuthorizePage(device));
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/authorize/poll', async (_req, res, next) => {
    try {
      res.json(await traktClient.tryCompleteDeviceAuth());
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/test', async (req, res, next) => {
    try {
      res.json(await traktClient.testMovieLookup({
        title: `${req.query.title || ''}`.trim() || undefined,
        year: `${req.query.year || ''}`.trim() || undefined,
        type: `${req.query.type || ''}`.trim() || 'movie'
      }));
    }
    catch (error) {
      next(error);
    }
  });

  return router;
}
