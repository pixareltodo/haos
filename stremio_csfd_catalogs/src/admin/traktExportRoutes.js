import express from 'express';

function escapeHtml(value) {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function deduplicateExportItems(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = item.ids.imdb
      ? `imdb:${item.ids.imdb}`
      : item.ids.tmdb
        ? `tmdb:${item.ids.tmdb}`
        : '';

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function buildExportPayloadItems(report) {
  const exportable = [];
  const skipped = [];

  for (const item of report.items || []) {
    const ids = {};
    if (item.imdbId) {
      ids.imdb = item.imdbId;
    }

    if (item.tmdbId && Number.isFinite(Number(item.tmdbId))) {
      ids.tmdb = Number(item.tmdbId);
    }

    if (Object.keys(ids).length === 0) {
      skipped.push({
        csfdId: item.csfdId,
        title: item.title,
        year: item.year,
        reason: 'missing-standard-id'
      });
      continue;
    }

    exportable.push({
      title: item.title,
      year: item.year,
      ids
    });
  }

  return {
    exportable: deduplicateExportItems(exportable),
    skipped
  };
}

function buildListDescription(catalog, preview) {
  return [
    `Export katalogu ${catalog.name} z addonu CSFD katalogy.`,
    `Exportovatelnych polozek: ${preview.exportable.length}.`,
    `Preskocenych polozek bez standardniho ID: ${preview.skipped.length}.`
  ].join(' ');
}

function renderPreviewList(items, emptyText) {
  if (!items.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }

  return `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.title)}</strong>${item.year ? ` (${escapeHtml(item.year)})` : ''}</li>`).join('')}</ul>`;
}

function renderExportPage({ catalog, report, preview, traktStatus, traktLists, message = '' }) {
  const exportDefaultName = catalog.name;
  const exportDefaultDescription = buildListDescription(catalog, preview);
  const authorized = traktStatus.authorized === true;
  const appendDisabled = !authorized || !traktLists.length;
  const createDisabled = !authorized || !preview.exportable.length;

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Trakt export - ${escapeHtml(catalog.name)}</title>
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
      width: min(1080px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(60, 30, 10, 0.12);
      padding: 30px;
    }
    h1, h2, h3 {
      margin: 0 0 10px;
    }
    p, li, label, dd {
      color: var(--muted);
      font-size: 16px;
      line-height: 1.55;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 18px;
    }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .button, button {
      display: inline-block;
      border: none;
      border-radius: 999px;
      padding: 12px 18px;
      background: var(--accent);
      color: white;
      text-decoration: none;
      font: 600 15px/1.2 Arial, sans-serif;
      cursor: pointer;
    }
    .button.secondary, button.secondary {
      background: #e5ded3;
      color: var(--ink);
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .pill {
      display: inline-block;
      padding: 8px 12px;
      border-radius: 999px;
      background: ${authorized ? 'var(--good-bg)' : 'var(--warn-bg)'};
      color: ${authorized ? 'var(--good)' : 'var(--warn)'};
      font: 700 14px/1 Arial, sans-serif;
      margin-bottom: 12px;
    }
    .message {
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--warn-bg);
      color: var(--warn);
      font: 600 14px/1.5 Arial, sans-serif;
      margin-bottom: 12px;
    }
    dl {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 8px 12px;
      margin: 0;
    }
    dt {
      font: 700 13px/1.2 Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ink);
    }
    dd {
      margin: 0;
    }
    form {
      display: grid;
      gap: 12px;
    }
    input, textarea, select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px 14px;
      background: #fffaf2;
      color: var(--ink);
      font: 500 15px/1.4 Arial, sans-serif;
    }
    textarea {
      min-height: 92px;
      resize: vertical;
    }
    code {
      font-family: "Courier New", monospace;
      background: #fff7ed;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 2px 6px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <div class="pill">${authorized ? 'Trakt autorizovany' : 'Trakt zatim neni autorizovany'}</div>
      <h1>Trakt export: ${escapeHtml(catalog.name)}</h1>
      <p>Export je vzdy navazany na konkretni katalog. Zadna druha konfigurace bokem nevznika, vsechno se bere z aktualniho katalogu, jeho cache a match reportu.</p>
      ${message ? `<div class="message">${escapeHtml(message)}</div>` : ''}
      <div class="actions">
        <a class="button secondary" href="/admin">Zpet na rozcestnik</a>
        <a class="button secondary" href="/admin/csfd/matches/${encodeURIComponent(catalog.id)}" target="_blank" rel="noreferrer">Match report JSON</a>
        <a class="button secondary" href="/admin/trakt">Trakt rozcestnik</a>
        <a class="button secondary" href="/admin/trakt/authorize">Autorizovat Trakt</a>
      </div>
    </section>
    <section class="grid">
      <article class="card">
        <h2>Nahled exportu</h2>
        <dl>
          <dt>Katalog</dt><dd><code>${escapeHtml(catalog.id)}</code></dd>
          <dt>Polozek celkem</dt><dd>${escapeHtml(report.total)}</dd>
          <dt>Sparovano</dt><dd>${escapeHtml(report.resolvedCount)}</dd>
          <dt>Exportovatelnych</dt><dd>${escapeHtml(preview.exportable.length)}</dd>
          <dt>Preskocenych</dt><dd>${escapeHtml(preview.skipped.length)}</dd>
        </dl>
      </article>
      <article class="card">
        <h2>Kdy je autorizace potreba</h2>
        <p>Pro samotne matchovani filmu autorizace Traktu nutna neni. Pro zapis do tveho Trakt uctu uz ano, proto jsou export akce aktivni az po autorizaci.</p>
      </article>
    </section>
    <section class="grid">
      <article class="card">
        <h2>Vytvorit novy Trakt list</h2>
        <form method="post" action="/admin/trakt/export/${encodeURIComponent(catalog.id)}/create">
          <label>Nazev listu
            <input type="text" name="name" value="${escapeHtml(exportDefaultName)}" required />
          </label>
          <label>Popis
            <textarea name="description">${escapeHtml(exportDefaultDescription)}</textarea>
          </label>
          <label>Viditelnost
            <select name="privacy">
              <option value="private">private</option>
              <option value="friends">friends</option>
              <option value="public">public</option>
            </select>
          </label>
          <button type="submit" ${createDisabled ? 'disabled' : ''}>Vytvorit list a nahrat polozky</button>
        </form>
      </article>
      <article class="card">
        <h2>Pridat do existujiciho listu</h2>
        <form method="post" action="/admin/trakt/export/${encodeURIComponent(catalog.id)}/append">
          <label>Existujici list
            <select name="listId" ${appendDisabled ? 'disabled' : ''}>
              ${traktLists.map((list) => `<option value="${escapeHtml(list.id)}">${escapeHtml(list.name)} (${escapeHtml(list.itemCount)})</option>`).join('')}
            </select>
          </label>
          <button type="submit" ${appendDisabled ? 'disabled' : ''}>Pridat exportovatelne polozky</button>
        </form>
      </article>
    </section>
    <section class="grid">
      <article class="card">
        <h3>Prvni exportovatelne polozky</h3>
        ${renderPreviewList(preview.exportable.slice(0, 15), 'Zatim neni co exportovat.')}
      </article>
      <article class="card">
        <h3>Prvni preskocene polozky</h3>
        ${renderPreviewList(preview.skipped.slice(0, 15), 'Zadne preskocene polozky.')}
      </article>
    </section>
  </main>
</body>
</html>`;
}

function renderExportResultPage({ title, message, details = [], backHref }) {
  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background: #f4efe7;
      color: #1f2937;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(760px, 100%);
      background: #fffdf8;
      border: 1px solid #e7dccd;
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(60, 30, 10, 0.12);
      padding: 30px;
    }
    h1 { margin: 0 0 10px; }
    p, li, dd {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.55;
    }
    dl {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 8px 12px;
      margin: 18px 0;
    }
    dt {
      font: 700 13px/1.2 Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    dd { margin: 0; }
    a.button {
      display: inline-block;
      border-radius: 999px;
      padding: 12px 18px;
      background: #c2410c;
      color: white;
      text-decoration: none;
      font: 600 15px/1.2 Arial, sans-serif;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <dl>
      ${details.map((detail) => `<dt>${escapeHtml(detail.label)}</dt><dd>${escapeHtml(detail.value)}</dd>`).join('')}
    </dl>
    <a class="button" href="${escapeHtml(backHref)}">Zpet na export</a>
  </main>
</body>
</html>`;
}

function normalizeTraktList(entry) {
  return {
    id: entry.ids?.slug || `${entry.ids?.trakt || ''}` || entry.slug || `${entry.name || ''}`.trim(),
    traktId: entry.ids?.trakt || null,
    slug: entry.ids?.slug || entry.slug || '',
    name: entry.name || '',
    privacy: entry.privacy || 'private',
    itemCount: entry.item_count || 0
  };
}

async function getAuthorizedAccessToken(traktClient) {
  return traktClient.getAuthorizedAccessToken();
}

async function getUserLists(traktClient) {
  const accessToken = await getAuthorizedAccessToken(traktClient);
  return traktClient.fetchJson(`${traktClient.baseUrl}/users/me/lists`, {
    accessToken
  });
}

async function createPersonalList(traktClient, {
  name,
  description = '',
  privacy = 'private'
} = {}) {
  const accessToken = await getAuthorizedAccessToken(traktClient);
  return traktClient.fetchJson(`${traktClient.baseUrl}/users/me/lists`, {
    method: 'POST',
    accessToken,
    body: {
      name,
      description,
      privacy,
      display_numbers: false,
      allow_comments: false,
      sort_by: 'rank',
      sort_how: 'asc'
    }
  });
}

async function addItemsToList(traktClient, listId, payload) {
  const accessToken = await getAuthorizedAccessToken(traktClient);
  return traktClient.fetchJson(`${traktClient.baseUrl}/users/me/lists/${encodeURIComponent(listId)}/items`, {
    method: 'POST',
    accessToken,
    body: payload
  });
}

function ensureCatalog(catalogManager, catalogId) {
  const catalog = catalogManager.getCatalogById(catalogId);
  if (!catalog) {
    return null;
  }

  return catalog;
}

async function loadExportContext(catalogManager, traktClient, catalogId) {
  const catalog = ensureCatalog(catalogManager, catalogId);
  if (!catalog) {
    return null;
  }

  const report = await catalogManager.getMatchReport(catalogId);
  const preview = buildExportPayloadItems(report);
  const traktStatus = await traktClient.getStatus();
  const traktLists = traktStatus.authorized
    ? (await getUserLists(traktClient)).map(normalizeTraktList)
    : [];

  return {
    catalog,
    report,
    preview,
    traktStatus,
    traktLists
  };
}

function buildTraktMoviePayload(items) {
  return {
    movies: items.map((item) => ({
      ids: item.ids
    }))
  };
}

async function pushItemsToList(traktClient, listId, items) {
  let added = 0;
  for (const currentChunk of chunk(items, 100)) {
    const payload = buildTraktMoviePayload(currentChunk);
    const result = await addItemsToList(traktClient, listId, payload);
    added += Number(result?.added?.movies || currentChunk.length || 0);
  }
  return added;
}

export function createTraktExportRouter(catalogManager, traktClient) {
  const router = express.Router();

  router.get('/:catalogId', async (req, res, next) => {
    try {
      const context = await loadExportContext(catalogManager, traktClient, req.params.catalogId);
      if (!context) {
        res.status(404).json({ error: 'Catalog not found' });
        return;
      }

      res.type('html').send(renderExportPage({
        ...context,
        message: `${req.query.message || ''}`.trim()
      }));
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/:catalogId/create', async (req, res, next) => {
    try {
      const context = await loadExportContext(catalogManager, traktClient, req.params.catalogId);
      if (!context) {
        res.status(404).json({ error: 'Catalog not found' });
        return;
      }

      if (!context.traktStatus.authorized) {
        res.status(400).type('html').send(renderExportResultPage({
          title: 'Trakt neni autorizovany',
          message: 'Pro vytvoreni noveho Trakt listu je potreba nejdriv autorizovat Trakt ucet.',
          backHref: `/admin/trakt/export/${encodeURIComponent(req.params.catalogId)}`
        }));
        return;
      }

      const newList = await createPersonalList(traktClient, {
        name: `${req.body.name || ''}`.trim() || context.catalog.name,
        description: `${req.body.description || ''}`.trim(),
        privacy: `${req.body.privacy || 'private'}`.trim() || 'private'
      });

      const added = await pushItemsToList(traktClient, newList.slug || `${newList.traktId}`, context.preview.exportable);
      res.type('html').send(renderExportResultPage({
        title: 'Trakt list vytvoren',
        message: 'Export katalogu do noveho Trakt listu probehl.',
        backHref: `/admin/trakt/export/${encodeURIComponent(req.params.catalogId)}`,
        details: [
          { label: 'Katalog', value: context.catalog.name },
          { label: 'Trakt list', value: newList.name || context.catalog.name },
          { label: 'Viditelnost', value: newList.privacy || `${req.body.privacy || 'private'}` },
          { label: 'Pridano polozek', value: `${added}` },
          { label: 'Preskoceno', value: `${context.preview.skipped.length}` }
        ]
      }));
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/:catalogId/append', async (req, res, next) => {
    try {
      const context = await loadExportContext(catalogManager, traktClient, req.params.catalogId);
      if (!context) {
        res.status(404).json({ error: 'Catalog not found' });
        return;
      }

      if (!context.traktStatus.authorized) {
        res.status(400).type('html').send(renderExportResultPage({
          title: 'Trakt neni autorizovany',
          message: 'Pro pridani do existujiciho Trakt listu je potreba nejdriv autorizovat Trakt ucet.',
          backHref: `/admin/trakt/export/${encodeURIComponent(req.params.catalogId)}`
        }));
        return;
      }

      const listId = `${req.body.listId || ''}`.trim();
      const targetList = context.traktLists.find((list) => list.id === listId);
      if (!targetList) {
        res.status(400).type('html').send(renderExportResultPage({
          title: 'Trakt list nenalezen',
          message: 'Vybrany Trakt list se nepodarilo dohledat mezi tvymi osobnimi listy.',
          backHref: `/admin/trakt/export/${encodeURIComponent(req.params.catalogId)}`
        }));
        return;
      }

      const added = await pushItemsToList(traktClient, listId, context.preview.exportable);
      res.type('html').send(renderExportResultPage({
        title: 'Trakt list aktualizovan',
        message: 'Exportovatelne polozky byly pridany do vybraneho existujiciho Trakt listu.',
        backHref: `/admin/trakt/export/${encodeURIComponent(req.params.catalogId)}`,
        details: [
          { label: 'Katalog', value: context.catalog.name },
          { label: 'Trakt list', value: targetList.name },
          { label: 'Pridano polozek', value: `${added}` },
          { label: 'Preskoceno', value: `${context.preview.skipped.length}` }
        ]
      }));
    }
    catch (error) {
      next(error);
    }
  });

  return router;
}
