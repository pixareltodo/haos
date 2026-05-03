export function buildManifest(options, catalogs) {
  const types = Array.from(new Set(catalogs.map((catalog) => catalog.type)));

  return {
    id: options.addon_id,
    version: options.addon_version || '1.0.6',
    name: options.addon_name,
    description: 'Local Stremio addon for CSFD movie catalogs',
    resources: [
      { name: 'catalog', types },
      { name: 'meta', types, idPrefixes: ['csfd:'] }
    ],
    types,
    catalogs
  };
}
