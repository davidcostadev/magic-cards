/**
 * The shape of a list page's URL search: what the user is filtering by (`q`) and how the list is
 * ordered (`sort`). Both are optional — an absent value means "the default".
 */
export interface ListSearch<TSort extends string = string> {
  q?: string;
  sort?: TSort;
}

/**
 * Parses `?q=&sort=` for a list route.
 *
 * Anything unusable is dropped rather than rejected, so an old bookmark or a hand-edited URL still
 * opens the page on its defaults instead of erroring. Defaults are dropped too — the first entry of
 * `sorts` is the page's default ordering, so selecting it takes the parameter back out of the URL
 * and a freshly-opened page has a clean address.
 */
export function validateListSearch<TSort extends string>(
  search: Record<string, unknown>,
  sorts: readonly TSort[]
): ListSearch<TSort> {
  const out: ListSearch<TSort> = {};

  const q = search.q;
  if (typeof q === 'string' && q.trim().length > 0) out.q = q;

  const sort = search.sort;
  if (
    typeof sort === 'string' &&
    sort !== sorts[0] &&
    (sorts as readonly string[]).includes(sort)
  ) {
    out.sort = sort as TSort;
  }

  return out;
}
