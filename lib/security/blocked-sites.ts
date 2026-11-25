/**
 * Sites banned from using anything of ours (images, audios, APIs, links).
 * metodoatomico.lat: copy of the ATOM landing that hotlinks our files.
 * Add more domains here; subdomains are blocked too.
 */
export const BLOCKED_DOMAINS = ["metodoatomico.lat", "metodoatomico.com"];

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isBlockedHost(host: string | null): boolean {
  if (!host) return false;
  return BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** True when the request comes from (or is embedded in) a banned site. */
export function isFromBlockedSite(headers: Headers): boolean {
  return isBlockedHost(hostOf(headers.get("origin"))) || isBlockedHost(hostOf(headers.get("referer")));
}
