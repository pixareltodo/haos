import {
  normalizeDelimitedText,
  normalizeSearchText,
  normalizeTypeLabel
} from '../../utils/urlUtils.js';

function includesAny(sourceValues, allowedValues) {
  if (!allowedValues.length) {
    return true;
  }

  const normalizedSource = sourceValues
    .map((value) => normalizeSearchText(value))
    .filter(Boolean);

  return allowedValues.some((value) => normalizedSource.includes(normalizeSearchText(value)));
}

export function applyPostFilter(items, filterConfig = {}) {
  if (!filterConfig.enabled) {
    return items;
  }

  const allowedOrigins = filterConfig.allowed_origins || [];
  const requiredGenres = filterConfig.required_genres || [];
  const allowedTypes = (filterConfig.allowed_types || []).map(normalizeTypeLabel);

  return items.filter((item) => {
    const origins = normalizeDelimitedText(item.origin);
    const genres = normalizeDelimitedText(item.genre);
    const typeLabel = normalizeTypeLabel(item.typeLabel || 'Film');

    if (!includesAny(origins, allowedOrigins)) {
      return false;
    }

    if (!includesAny(genres, requiredGenres)) {
      return false;
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(typeLabel)) {
      return false;
    }

    return true;
  });
}
