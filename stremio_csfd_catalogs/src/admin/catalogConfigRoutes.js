import express from 'express';

function escapeHtml(value) {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitListValue(value) {
  return `${value || ''}`
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBool(value) {
  return value === 'on' || value === 'true' || value === true;
}

function parseOptionalNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function renderLayout(title, body) {
  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4efe7;
      --card: #fffdf8;
      --ink: #1f2937;
      --muted: #6b7280;
      --accent: #c2410c;
      --border: #e7dccd;
      --warn: #92400e;
      --warn-bg: #ffedd5;
      --danger: #991b1b;
      --danger-bg: #fee2e2;
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
      width: min(1160px, 100%);
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
    h1, h2, h3 { margin: 0 0 10px; }
    p, li, label, dd { color: var(--muted); font-size: 16px; line-height: 1.55; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
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
    .button.secondary, button.secondary { background: #e5ded3; color: var(--ink); }
    .button.danger, button.danger { background: var(--danger); color: white; }
    .message {
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--warn-bg);
      color: var(--warn);
      font: 600 14px/1.5 Arial, sans-serif;
      margin-bottom: 12px;
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; }
    dl { display: grid; grid-template-columns: 160px 1fr; gap: 8px 12px; margin: 0; }
    dt { font: 700 13px/1.2 Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink); }
    dd { margin: 0; }
    code {
      font-family: "Courier New", monospace;
      background: #fff7ed;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 2px 6px;
      word-break: break-all;
    }
    form { display: grid; gap: 12px; }
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
    textarea { min-height: 96px; resize: vertical; }
    .checkbox {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--ink);
      font: 600 14px/1.4 Arial, sans-serif;
    }
    .checkbox input { width: auto; }
  </style>
</head>
<body>
  <main class="wrap">
    ${body}
  </main>
</body>
</html>`;
}

function renderCatalogListPage({ options, message = '' }) {
  return renderLayout('Sprava katalogu', `
    <section class="card">
      <h1>Sprava katalogu</h1>
      <p>Upravujes stejny konfiguracni soubor, ktery pouziva HAOS addon. Nevznika zadna druha konfigurace bokem. Po ulozeni se konfigurace prepise do sdileneho addon configu a po restartu addonu se plne promitne i do behu.</p>
      ${message ? `<div class="message">${escapeHtml(message)}</div>` : ''}
      <div class="actions">
        <a class="button" href="/admin/config/catalogs/new">Pridat novy katalog</a>
        <a class="button secondary" href="/admin">Zpet na rozcestnik</a>
      </div>
      <p><strong>Zdroj konfigurace:</strong><br><code>${escapeHtml(options._optionsFile || '')}</code></p>
    </section>
    <section class="grid">
      ${(options.csfd_catalogs || []).map((catalog) => `
        <article class="card">
          <h2>${escapeHtml(catalog.name)}</h2>
          <dl>
            <dt>ID</dt><dd><code>${escapeHtml(catalog.id)}</code></dd>
            <dt>Zdroj</dt><dd>${escapeHtml(catalog.source_type)}</dd>
            <dt>Typ</dt><dd>${escapeHtml(catalog.stremio_type)}</dd>
            <dt>Refresh</dt><dd>${escapeHtml(catalog.refresh_interval_hours)} h</dd>
            <dt>Budouci tituly</dt><dd>${catalog.include_future_titles ? 'ano' : 'ne'}</dd>
            <dt>Jen sparovane</dt><dd>${catalog.matched_only_default ? 'vynuceno' : 'ne'}</dd>
            <dt>Filtr</dt><dd>${catalog.post_filter?.enabled ? 'zapnuty' : 'vypnuty'}</dd>
          </dl>
          <div class="actions">
            <a class="button secondary" href="/admin/config/catalogs/${encodeURIComponent(catalog.id)}/edit">Upravit</a>
            <a class="button secondary" href="/admin/trakt/export/${encodeURIComponent(catalog.id)}">Trakt export</a>
          </div>
        </article>
      `).join('')}
    </section>
  `);
}

function textareaValue(values = []) {
  return (values || []).join('\n');
}

function renderCatalogFormPage({ mode, catalog, defaults, message = '' }) {
  const formCatalog = {
    ...catalog,
    post_filter: catalog.post_filter || {
      enabled: parseBool(catalog.filter_enabled),
      allowed_origins: catalog.filter_allowed_origins || [],
      required_genres: catalog.filter_required_genres || [],
      allowed_types: catalog.filter_allowed_types || []
    }
  };
  const title = mode === 'edit' ? `Upravit katalog: ${catalog.name || catalog.id}` : 'Pridat novy katalog';
  return renderLayout(title, `
    <section class="card">
      <h1>${escapeHtml(title)}</h1>
      <p>Formular zapisuje primo do sdilene addon konfigurace. Zachovava se tak stejny konfig pro HAOS i web. Po ulozeni uz jen restartuj addon v HAOS.</p>
      ${message ? `<div class="message">${escapeHtml(message)}</div>` : ''}
      <div class="actions">
        <a class="button secondary" href="/admin/config/catalogs">Zpet na katalogy</a>
        <a class="button secondary" href="/admin">Zpet na rozcestnik</a>
      </div>
    </section>
    <section class="card">
      <form method="post" action="/admin/config/catalogs/save">
        <input type="hidden" name="originalId" value="${escapeHtml(catalog.originalId || catalog.id || '')}" />
        <div class="grid">
          <label>ID katalogu
            <input type="text" name="id" required value="${escapeHtml(formCatalog.id || '')}" />
          </label>
          <label>Nazev
            <input type="text" name="name" required value="${escapeHtml(formCatalog.name || '')}" />
          </label>
          <label>Typ zdroje
            <select name="source_type">
              ${['csfd_html_list', 'json_file', 'csv_file', 'external_script'].map((type) => `<option value="${type}" ${formCatalog.source_type === type ? 'selected' : ''}>${type}</option>`).join('')}
            </select>
          </label>
          <label>Stremio typ
            <select name="stremio_type">
              ${['movie', 'series'].map((type) => `<option value="${type}" ${formCatalog.stremio_type === type ? 'selected' : ''}>${type}</option>`).join('')}
            </select>
          </label>
          <label>Refresh interval (hodiny)
            <input type="number" min="6" max="720" name="refresh_interval_hours" value="${escapeHtml(formCatalog.refresh_interval_hours || defaults.refresh_interval_hours)}" />
          </label>
          <label>Max stran
            <input type="number" min="1" max="100" name="max_pages" value="${escapeHtml(formCatalog.max_pages || defaults.max_pages)}" />
          </label>
          <label>Max polozek
            <input type="number" min="1" max="5000" name="max_items" value="${escapeHtml(formCatalog.max_items || defaults.max_items)}" />
          </label>
          <label>Zdrojove URL
            <input type="text" name="source_url" value="${escapeHtml(formCatalog.source_url || '')}" />
          </label>
          <label>JSON/CSV soubor
            <input type="text" name="source_file" value="${escapeHtml(formCatalog.source_file || '')}" />
          </label>
          <label>Script path
            <input type="text" name="script_path" value="${escapeHtml(formCatalog.script_path || '')}" />
          </label>
          <label>Script output
            <input type="text" name="script_output" value="${escapeHtml(formCatalog.script_output || '')}" />
          </label>
        </div>
        <label class="checkbox"><input type="checkbox" name="enabled" ${formCatalog.enabled !== false ? 'checked' : ''} /> Katalog je zapnuty</label>
        <label class="checkbox"><input type="checkbox" name="include_future_titles" ${formCatalog.include_future_titles !== false ? 'checked' : ''} /> Zahrnout i budouci nebo jeste nevydane tituly</label>
        <label class="checkbox"><input type="checkbox" name="matched_only_default" ${formCatalog.matched_only_default === true ? 'checked' : ''} /> Ve Stremio katalogu zobrazovat jen sparovane filmy</label>
        <label class="checkbox"><input type="checkbox" name="filter_enabled" ${formCatalog.post_filter?.enabled ? 'checked' : ''} /> Zapnout post-filter katalogu</label>
        <div class="grid">
          <label>Povolene puvody
            <textarea name="filter_allowed_origins" placeholder="Cesko&#10;Slovensko">${escapeHtml(textareaValue(formCatalog.post_filter?.allowed_origins || []))}</textarea>
          </label>
          <label>Povinne zanry
            <textarea name="filter_required_genres" placeholder="Pohadka">${escapeHtml(textareaValue(formCatalog.post_filter?.required_genres || []))}</textarea>
          </label>
          <label>Povolene typy
            <textarea name="filter_allowed_types" placeholder="Film&#10;TV film">${escapeHtml(textareaValue(formCatalog.post_filter?.allowed_types || []))}</textarea>
          </label>
        </div>
        <div class="actions">
          <button type="submit">${mode === 'edit' ? 'Ulozit zmeny' : 'Pridat katalog'}</button>
          ${mode === 'edit' ? `
            <button class="danger" formaction="/admin/config/catalogs/${encodeURIComponent(catalog.id || '')}/delete" formmethod="post" type="submit" onclick="return confirm('Opravdu smazat katalog ${escapeHtml(catalog.name || catalog.id || '')}?');">Smazat katalog</button>
          ` : ''}
        </div>
      </form>
    </section>
  `);
}

function buildCatalogFromBody(body, defaults) {
  return {
    id: `${body.id || ''}`.trim(),
    name: `${body.name || ''}`.trim(),
    enabled: parseBool(body.enabled),
    source_type: `${body.source_type || 'csfd_html_list'}`.trim(),
    source_url: `${body.source_url || ''}`.trim(),
    source_file: `${body.source_file || ''}`.trim(),
    script_path: `${body.script_path || ''}`.trim(),
    script_output: `${body.script_output || ''}`.trim(),
    refresh_interval_hours: parseOptionalNumber(body.refresh_interval_hours, defaults.refresh_interval_hours),
    max_pages: parseOptionalNumber(body.max_pages, defaults.max_pages),
    max_items: parseOptionalNumber(body.max_items, defaults.max_items),
    stremio_type: `${body.stremio_type || 'movie'}`.trim() === 'series' ? 'series' : 'movie',
    include_future_titles: parseBool(body.include_future_titles),
    matched_only_default: parseBool(body.matched_only_default),
    filter_enabled: parseBool(body.filter_enabled),
    filter_allowed_origins: splitListValue(body.filter_allowed_origins),
    filter_required_genres: splitListValue(body.filter_required_genres),
    filter_allowed_types: splitListValue(body.filter_allowed_types)
  };
}

export function createCatalogConfigRouter(configStore) {
  const router = express.Router();

  function getDefaults(options) {
    return {
      refresh_interval_hours: Number(options.csfd_list_refresh_interval_hours_default || 24),
      max_pages: 20,
      max_items: 500
    };
  }

  router.get('/', (_req, res) => {
    res.redirect('/admin/config/catalogs');
  });

  router.get('/catalogs', async (req, res, next) => {
    try {
      const options = await configStore.readNormalizedOptions();
      res.type('html').send(renderCatalogListPage({
        options: {
          ...options,
          _optionsFile: configStore.optionsFile
        },
        message: `${req.query.message || ''}`.trim()
      }));
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/catalogs/new', async (_req, res, next) => {
    try {
      const options = await configStore.readNormalizedOptions();
      res.type('html').send(renderCatalogFormPage({
        mode: 'new',
        catalog: {
          enabled: true,
          source_type: 'csfd_html_list',
          stremio_type: 'movie',
          include_future_titles: false,
          post_filter: {
            enabled: false,
            allowed_origins: [],
            required_genres: [],
            allowed_types: []
          }
        },
        defaults: getDefaults(options)
      }));
    }
    catch (error) {
      next(error);
    }
  });

  router.get('/catalogs/:catalogId/edit', async (req, res, next) => {
    try {
      const options = await configStore.readNormalizedOptions();
      const catalog = options.csfd_catalogs.find((entry) => entry.id === req.params.catalogId);
      if (!catalog) {
        res.status(404).type('html').send(renderLayout('Katalog nenalezen', `
        <section class="card">
          <h1>Katalog nenalezen</h1>
          <p>Pod ID <code>${escapeHtml(req.params.catalogId)}</code> neni zadny katalog.</p>
          <div class="actions">
            <a class="button secondary" href="/admin/config/catalogs">Zpet na katalogy</a>
          </div>
        </section>
      `));
        return;
      }

      res.type('html').send(renderCatalogFormPage({
        mode: 'edit',
        catalog: {
          ...catalog,
          originalId: catalog.id
        },
        defaults: getDefaults(options)
      }));
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/catalogs/save', async (req, res, next) => {
    try {
      const originalId = `${req.body.originalId || ''}`.trim();
      const rawOptions = await configStore.readRawOptions();
      const normalizedOptionsBeforeSave = await configStore.readNormalizedOptions();
      const nextCatalog = buildCatalogFromBody(req.body, getDefaults(normalizedOptionsBeforeSave));

      if (!nextCatalog.id) {
        res.status(400).type('html').send(renderCatalogFormPage({
          mode: originalId ? 'edit' : 'new',
          catalog: {
            ...nextCatalog,
            originalId
          },
          defaults: getDefaults(normalizedOptionsBeforeSave),
          message: 'ID katalogu je povinne.'
        }));
        return;
      }

      const catalogs = Array.isArray(rawOptions.csfd_catalogs) ? [...rawOptions.csfd_catalogs] : [];
      const duplicate = catalogs.find((catalog) => catalog.id === nextCatalog.id && catalog.id !== originalId);
      if (duplicate) {
        res.status(400).type('html').send(renderCatalogFormPage({
          mode: originalId ? 'edit' : 'new',
          catalog: {
            ...nextCatalog,
            originalId
          },
          defaults: getDefaults(normalizedOptionsBeforeSave),
          message: `Katalog s ID ${nextCatalog.id} uz existuje.`
        }));
        return;
      }

      const existingIndex = catalogs.findIndex((catalog) => catalog.id === originalId);
      const nextCatalogs = catalogs.filter((catalog) => catalog.id !== originalId);
      if (existingIndex >= 0) {
        nextCatalogs.splice(existingIndex, 0, nextCatalog);
      }
      else {
        nextCatalogs.push(nextCatalog);
      }

      await configStore.writeRawOptions({
        ...rawOptions,
        csfd_catalogs: nextCatalogs
      });
      res.redirect('/admin/config/catalogs?message=Konfigurace+ulozena.+Pro+promitnuti+do+beziciho+addonu+udelej+restart+addonu+v+HAOS.');
    }
    catch (error) {
      next(error);
    }
  });

  router.post('/catalogs/:catalogId/delete', async (req, res, next) => {
    try {
      const rawOptions = await configStore.readRawOptions();
      const catalogs = Array.isArray(rawOptions.csfd_catalogs) ? [...rawOptions.csfd_catalogs] : [];
      const nextCatalogs = catalogs.filter((catalog) => catalog.id !== req.params.catalogId);
      await configStore.writeRawOptions({
        ...rawOptions,
        csfd_catalogs: nextCatalogs
      });
      res.redirect('/admin/config/catalogs?message=Katalog+smazan.+Pro+promitnuti+do+beziciho+addonu+udelej+restart+addonu+v+HAOS.');
    }
    catch (error) {
      next(error);
    }
  });

  return router;
}
