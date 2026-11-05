// Pictures are served by your own site (see app/api/img/route.ts), so the address
// of a picture never changes and the browser can keep it for a year.
export function imageUrl(path: string): string {
  return `/api/img?p=${encodeURIComponent(path)}`;
}
