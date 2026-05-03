function mergeOptions(preferred = [], defaults = []) {
  return [...new Set([
    ...preferred.filter(Boolean),
    ...defaults.filter(Boolean)
  ])];
}

function buildCatalogExtras(catalog) {
  const genreOptions = mergeOptions(
    catalog?.post_filter?.required_genres || [],
    ['Pohadka', 'Rodinny', 'Fantasy', 'Dobrodruzny', 'Komedie', 'Animovany', 'Muzikal']
  );
  const countryOptions = mergeOptions(
    catalog?.post_filter?.allowed_origins || [],
    ['Cesko', 'Slovensko', 'Ceskoslovensko', 'Nemecko', 'Polsko']
  );
  const typeOptions = mergeOptions(
    catalog?.post_filter?.allowed_types || [],
    ['Film', 'TV film', 'Serial', 'Miniserie']
  );

  return [
    { name: 'search', isRequired: false },
    { name: 'skip', isRequired: false },
    { name: 'genre', isRequired: false, options: genreOptions, optionsLimit: 1 },
    { name: 'country', isRequired: false, options: countryOptions, optionsLimit: 1 },
    { name: 'type', isRequired: false, options: typeOptions, optionsLimit: 1 },
    {
      name: 'year',
      isRequired: false,
      options: ['2020s', '2010s', '2000s', '1990s', '1980s', 'older'],
      optionsLimit: 1
    },
    {
      name: 'future',
      isRequired: false,
      options: ['exclude', 'include', 'only'],
      optionsLimit: 1
    },
    {
      name: 'matched',
      isRequired: false,
      options: ['all', 'only', 'unmatched'],
      optionsLimit: 1
    },
    {
      name: 'sort',
      isRequired: false,
      options: ['default', 'year_desc', 'year_asc', 'name_asc', 'name_desc'],
      optionsLimit: 1
    }
  ];
}

export function buildManifest(options, catalogs) {
  const types = Array.from(new Set(catalogs.map((catalog) => catalog.type)));

  return {
    id: options.addon_id,
    version: options.addon_version || '1.0.9',
    name: options.addon_name,
    description: 'Local Stremio addon for CSFD movie catalogs',
    resources: [
      { name: 'catalog', types },
      { name: 'meta', types, idPrefixes: ['csfd:'] }
    ],
    types,
    catalogs: catalogs.map((catalog) => ({
      type: catalog.type,
      id: catalog.id,
      name: catalog.name,
      extra: buildCatalogExtras(catalog)
    }))
  };
}
