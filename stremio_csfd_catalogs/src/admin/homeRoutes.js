import express from 'express';
import { BUILD_INFO } from '../config/buildInfo.js';

function escapeHtml(value) {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCatalogCards(statuses, catalogs) {
  return catalogs.map((catalog) => {
    const status = statuses?.[catalog.id] || {};
    return `<article class="card">
      <h3>${escapeHtml(catalog.name)}</h3>
      <dl>
        <dt>ID</dt><dd><code>${escapeHtml(catalog.id)}</code></dd>
        <dt>Typ</dt><dd>${escapeHtml(catalog.stremio_type)}</dd>
        <dt>Polozek</dt><dd>${escapeHtml(status.itemCount ?? '-')}</dd>
        <dt>Posledni uspech</dt><dd>${escapeHtml(status.lastSuccessAt || 'nikdy')}</dd>
        <dt>Chyba</dt><dd>${escapeHtml(status.error || 'zadna')}</dd>
      </dl>
      <div class="actions compact">
        <a class="button secondary" href="/catalog/${encodeURIComponent(catalog.stremio_type)}/${encodeURIComponent(catalog.id)}.json" target="_blank" rel="noreferrer">Katalog JSON</a>
        <a class="button secondary" href="/admin/csfd/status/${encodeURIComponent(catalog.id)}" target="_blank" rel="noreferrer">Status JSON</a>
        <a class="button secondary" href="/admin/csfd/matches/${encodeURIComponent(catalog.id)}" target="_blank" rel="noreferrer">Match report</a>
        <a class="button secondary" href="/admin/config/catalogs/${encodeURIComponent(catalog.id)}/edit">Upravit katalog</a>
        <a class="button secondary" href="/admin/trakt/export/${encodeURIComponent(catalog.id)}">Trakt export</a>
      </div>
    </article>`;
  }).join('\n');
}

function renderDashboard({
  options,
  statuses,
  traktStatus
}) {
  const manifestHttpUrl = options.http_enabled
    ? `http://${options.host_ip}:${options.http_port}/manifest.json`
    : '';
  const manifestHttpsUrl = options.https_enabled
    ? `https://${options.host_ip}:${options.https_port}/manifest.json`
    : '';
  const traktLabel = !options.trakt_enabled
    ? 'Trakt vypnuty'
    : traktStatus.authorized
      ? 'Trakt autorizovany'
      : traktStatus.configured
        ? 'Trakt pripraven k autorizaci'
        : 'Trakt nenakonfigurovany';
  const firstCatalog = options.csfd_catalogs?.[0];

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.addon_name)}</title>
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
      width: min(1160px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 20px;
    }
    .hero, .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(60, 30, 10, 0.12);
      padding: 30px;
    }
    h1, h2, h3 {
      margin: 0 0 10px;
    }
    h1 {
      font-size: clamp(36px, 7vw, 60px);
      line-height: 0.95;
    }
    p, li, dd {
      color: var(--muted);
      font-size: 17px;
      line-height: 1.55;
    }
    .lead {
      max-width: 900px;
      margin-bottom: 18px;
    }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .actions.compact {
      margin-top: 14px;
    }
    .button {
      display: inline-block;
      border-radius: 999px;
      padding: 12px 18px;
      background: var(--accent);
      color: white;
      text-decoration: none;
      font: 600 15px/1.2 Arial, sans-serif;
    }
    .button.secondary {
      background: #e5ded3;
      color: var(--ink);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-top: 18px;
    }
    .pill {
      display: inline-block;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--warn-bg);
      color: var(--warn);
      font: 700 14px/1 Arial, sans-serif;
      margin-bottom: 12px;
    }
    code {
      font-family: "Courier New", monospace;
      background: #fff7ed;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 2px 6px;
      word-break: break-all;
    }
    dl {
      display: grid;
      grid-template-columns: 120px 1fr;
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
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="pill">Verze ${escapeHtml(BUILD_INFO.version)} - ${escapeHtml(BUILD_INFO.buildSignature)}</div>
      <h1>${escapeHtml(options.addon_name)}</h1>
      <p class="lead">Tenhle addon stahuje a udrzuje vlastni filmove katalogy z CSFD, doplnuje k nim metadata a vystavuje je jako Stremio manifest, katalogy a detail filmu. Tady na uvodni strance mas vse na jednom miste: instalacni odkaz do Stremia nebo Nuvio, stav katalogu, diagnostiku, Trakt integraci i spravu zdroju.</p>
      <div class="actions">
        ${manifestHttpUrl ? `<a class="button" href="${manifestHttpUrl}" target="_blank" rel="noreferrer">Otevrit manifest HTTP</a>` : ''}
        ${manifestHttpsUrl ? `<a class="button" href="${manifestHttpsUrl}" target="_blank" rel="noreferrer">Otevrit manifest HTTPS</a>` : ''}
        <a class="button secondary" href="/health" target="_blank" rel="noreferrer">Health JSON</a>
        <a class="button secondary" href="/admin/csfd/status" target="_blank" rel="noreferrer">Status JSON</a>
        <a class="button secondary" href="/admin/config/catalogs">Sprava katalogu</a>
        <a class="button secondary" href="/admin/trakt">Trakt</a>
        ${firstCatalog ? `<a class="button secondary" href="/admin/csfd/matches/${encodeURIComponent(firstCatalog.id)}" target="_blank" rel="noreferrer">Match report</a>` : ''}
      </div>
      <div class="meta">
        ${manifestHttpUrl ? `<div><strong>Instalace do Stremia/Nuvio:</strong><br><code>${escapeHtml(manifestHttpUrl)}</code></div>` : ''}
        ${manifestHttpsUrl ? `<div><strong>Alternativni HTTPS:</strong><br><code>${escapeHtml(manifestHttpsUrl)}</code></div>` : ''}
        <div><strong>Trakt:</strong><br>${escapeHtml(traktLabel)}</div>
        <div><strong>TMDB:</strong><br>${options.tmdb_enabled ? 'zapnuto' : 'vypnuto'}</div>
      </div>
    </section>
    <section class="grid">
      <article class="card">
        <h2>Co addon dela</h2>
        <ul>
          <li>vytahuje seznamy z CSFD a prevadi je na samostatne katalogy pro Stremio</li>
          <li>u kazde polozky se snazi doplnit obrazky, popis, detail a pripadne i standardni filmove ID</li>
          <li>udrzuje cache, aby addon bezel rychleji a nesahal zbytecne casto na vzdaleny zdroj</li>
          <li>propojuje katalogy s Trakt exportem po jednotlivych katalozich, ne globalne</li>
          <li>neuklada druhou konfiguraci bokem, vsechno vychazi z jednoho sdileneho addon configu</li>
        </ul>
      </article>
      <article class="card">
        <h2>Jak addon pouzivat</h2>
        <ul>
          <li>do Stremia nebo Nuvio pridavej addon pres odkaz <code>manifest.json</code></li>
          <li>katalogy i jejich zdroje muzes spravovat z webu addon rozhrani nebo z HAOS konfigurace</li>
          <li>po zmene katalogu ve webove sprave udelej restart addonu, aby se nova konfigurace plne propsala do behu</li>
          <li>Trakt autorizace je potreba jen pro zapis do tveho Trakt uctu, ne pro samotne sparovani filmu</li>
        </ul>
      </article>
      <article class="card">
        <h2>Kde co najdes</h2>
        <div class="actions compact">
          <a class="button secondary" href="/admin/trakt/status" target="_blank" rel="noreferrer">Trakt status</a>
          <a class="button secondary" href="/admin/trakt/test?title=Certoviny&year=2017" target="_blank" rel="noreferrer">Trakt test: Certoviny</a>
          <a class="button secondary" href="/admin/config/catalogs">Upravit katalogy</a>
          ${firstCatalog ? `<a class="button secondary" href="/admin/trakt/export/${encodeURIComponent(firstCatalog.id)}">Trakt export: ${escapeHtml(firstCatalog.name)}</a>` : ''}
          ${firstCatalog ? `<a class="button secondary" href="/catalog/${encodeURIComponent(firstCatalog.stremio_type)}/${encodeURIComponent(firstCatalog.id)}.json" target="_blank" rel="noreferrer">Katalog JSON</a>` : ''}
        </div>
      </article>
    </section>
    <section class="grid">
      ${renderCatalogCards(statuses, options.csfd_catalogs || [])}
    </section>
  </main>
</body>
</html>`;
}

export function createHomeRouter(options, catalogManager, traktClient) {
  const router = express.Router();

  async function render(_req, res, next) {
    try {
      const statuses = await catalogManager.getStatus();
      const traktStatus = await traktClient.getStatus();
      res.type('html').send(renderDashboard({ options, statuses, traktStatus }));
    }
    catch (error) {
      next(error);
    }
  }

  router.get('/', render);
  router.get('/admin', render);

  return router;
}
