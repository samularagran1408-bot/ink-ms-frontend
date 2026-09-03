/** Normaliza texto para búsquedas: minúsculas, sin tildes, espacios colapsados. */
export function foldSearch(value: string | number | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True si todos los tokens de `query` aparecen en alguno de los campos.
 * Vacío o solo espacios → coincide con todo.
 */
export function matchesQuery(
  query: string | null | undefined,
  ...parts: Array<string | number | null | undefined>
): boolean {
  const q = foldSearch(query);
  if (!q) {
    return true;
  }
  const haystack = foldSearch(parts.filter((part) => part != null && part !== '').join(' '));
  return q.split(' ').every((token) => haystack.includes(token));
}
