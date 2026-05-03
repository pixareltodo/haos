import express from 'express';

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
  </style>
</head>
<body>
  <main class="card">
    <h1>Autorizace Trakt</h1>
    <p>Otevri Trakt, pripadne se prihlas, potvrd pristup a tahle stranka si dokonceni sama pohlida.</p>
    <div class="code" id="code">${safeUserCode}</div>
    <div class="actions">
      <a class="button" href="${safeVerificationUrl}" target="_blank" rel="noreferrer">Otevrit Trakt aktivaci</a>
      <button type="button" class="secondary" id="copy-code">Kopirovat kod</button>
      <button type="button" class="secondary" id="refresh-code">Novy kod</button>
    </div>
    <div class="status" id="status">Cekam na potvrzeni v Traktu...</div>
    <div class="hint">Kdyz potvrdis pristup na Traktu, tahle stranka se automaticky prepne do hotoveho stavu.</div>
  </main>
  <script>
    const statusEl = document.getElementById('status');
    const codeEl = document.getElementById('code');
    document.getElementById('copy-code').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(codeEl.textContent.trim());
        statusEl.textContent = 'Kod zkopirovan do schranky.';
      } catch {
        statusEl.textContent = 'Kopirovani selhalo, oznac kod rucne.';
      }
    });
    document.getElementById('refresh-code').addEventListener('click', () => {
      window.location.href = '/admin/trakt/authorize?refresh=1';
    });

    async function poll() {
      try {
        const response = await fetch('/admin/trakt/authorize/poll', { credentials: 'same-origin' });
        const payload = await response.json();

        if (payload.authorized) {
          statusEl.textContent = 'Trakt je autorizovany. Muzes tuhle stranku zavrit.';
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

    setTimeout(poll, ${pollIntervalMs});
  </script>
</body>
</html>`;
}

export function createTraktAdminRouter(traktClient) {
  const router = express.Router();

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
