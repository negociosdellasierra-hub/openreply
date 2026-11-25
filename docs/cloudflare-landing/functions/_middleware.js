// Cloudflare Pages Function para la landing de ATOM (proyectoatom.lat y *.proyectoatom.pages.dev).
// Copia la carpeta `functions/` a la raíz del proyecto de la landing y vuelve a desplegar.
// Bloquea cualquier pedido (imágenes, videos, /pagar, páginas) que venga de un sitio copia.
const BLOQUEADOS = ["metodoatomico.lat", "metodoatomico.com"];

function host(valor) {
  try { return new URL(valor).hostname.toLowerCase(); } catch { return ""; }
}
function bloqueado(h) {
  return !!h && BLOQUEADOS.some((d) => h === d || h.endsWith("." + d));
}

export async function onRequest({ request, next }) {
  const ref = host(request.headers.get("referer") || "");
  const origen = host(request.headers.get("origin") || "");
  if (bloqueado(ref) || bloqueado(origen)) {
    return new Response("Forbidden", { status: 403 });
  }
  const res = await next();
  // Nadie puede meter la landing dentro de su web (iframe).
  const out = new Response(res.body, res);
  out.headers.set("X-Frame-Options", "SAMEORIGIN");
  out.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  return out;
}
