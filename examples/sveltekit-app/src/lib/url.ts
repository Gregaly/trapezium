import type { UrlOptions } from "@trapezium/svelte"

/**
 * How the table's state travels in the URL.
 *
 * The table shows fifteen rows a page, so fifteen is its resting size: a URL
 * with no size means fifteen, and a size of fifteen writes nothing. The same
 * object goes to every read and every write so the two agree.
 */
export const URL_OPTIONS: UrlOptions = { defaults: { pageSize: 15 } }
