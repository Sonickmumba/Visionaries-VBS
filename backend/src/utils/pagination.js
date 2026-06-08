export function getPagination(query = {}, { defaultLimit = 50, maxLimit = 250 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const requestedLimit = Number.parseInt(query.limit || String(defaultLimit), 10) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, requestedLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginationMeta({ page, limit, total }) {
  const count = Number(total || 0);
  return {
    page,
    limit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
}
