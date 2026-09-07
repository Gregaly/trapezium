import { stateFromUrl } from "@trapezium/svelte"

import { URL_OPTIONS } from "$lib/url"
import type { PageLoad } from "./$types"

/**
 * The view lives in the query string, so the page reads it here — on the
 * server for the first request, and in the browser for every navigation after
 * that. The table is rendered from it either way, which is what makes the first
 * paint already sorted and paged, and a shared link reproduce the whole view.
 */
export const load: PageLoad = ({ url }) => ({ state: stateFromUrl(url.searchParams, URL_OPTIONS) })
