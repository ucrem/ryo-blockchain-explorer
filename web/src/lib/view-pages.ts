export type ViewQuery = { [key: string]: string | string[] | undefined };
export function viewPages(
  query: ViewQuery,
  names: string[],
): Record<string, number> | null {
  if (Object.keys(query).some((key) => !names.includes(key))) return null;
  const result: Record<string, number> = {};
  for (const name of names) {
    const value = query[name];
    if (
      value !== undefined &&
      (typeof value !== "string" || !/^[1-9][0-9]{0,5}$/.test(value))
    )
      return null;
    result[name] = value === undefined ? 1 : Number(value);
  }
  return result;
}
export function slicePage<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  if (page > pages) return null;
  return {
    items: items.slice((page - 1) * size, page * size),
    pages,
    page,
    total: items.length,
  };
}
