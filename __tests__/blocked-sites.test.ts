import { describe, expect, it } from "vitest";
import { isFromBlockedSite } from "@/lib/security/blocked-sites";

const h = (init: Record<string, string>) => new Headers(init);

describe("blocked sites", () => {
  it("blocks the copycat by referer or origin, including www", () => {
    expect(isFromBlockedSite(h({ referer: "https://www.metodoatomico.lat/" }))).toBe(true);
    expect(isFromBlockedSite(h({ origin: "https://metodoatomico.lat" }))).toBe(true);
  });
  it("lets our own and normal traffic through", () => {
    expect(isFromBlockedSite(h({ referer: "https://proyectoatom.lat/" }))).toBe(false);
    expect(isFromBlockedSite(h({ referer: "https://notmetodoatomico.lat.example.com/" }))).toBe(false);
    expect(isFromBlockedSite(h({}))).toBe(false);
  });
});
