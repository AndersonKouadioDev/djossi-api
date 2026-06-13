/** Enveloppe de pagination commune à toutes les listes. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export function buildPage<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number,
): Page<T> {
  return {
    items,
    total,
    limit,
    offset,
    has_more: offset + items.length < total,
  };
}
