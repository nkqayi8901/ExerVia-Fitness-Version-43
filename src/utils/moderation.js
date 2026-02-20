export const normalizeBlockedIds = (value) => {
  const list = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      list
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
    )
  );
};

export const toggleBlockedId = (list, id) => {
  const blocked = normalizeBlockedIds(list);
  const target = Number(id);
  if (!Number.isFinite(target) || target <= 0) return blocked;
  if (blocked.includes(target)) {
    return blocked.filter((item) => item !== target);
  }
  return [...blocked, target];
};

export const parseBlockedIds = (rawValue) => {
  if (!rawValue) return [];
  try {
    return normalizeBlockedIds(JSON.parse(rawValue));
  } catch {
    return [];
  }
};
