// Edge entry for ukrecopelleta.org: serves the Vercel-hosted site under the real domain.
// www -> apex 301; everything else is proxied to the Vercel origin.
// Worker Previews (branch builds) set no CANONICAL_HOST, so they serve on their own preview URL.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = env.CANONICAL_HOST || url.hostname;

    if (env.CANONICAL_HOST && url.hostname !== env.CANONICAL_HOST) {
      url.hostname = env.CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    const upstream = new URL(url.pathname + url.search, `https://${env.ORIGIN}`);
    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Host', host);

    const res = await fetch(upstream, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });

    // Keep redirects on our domain
    const out = new Response(res.body, res);
    const loc = out.headers.get('Location');
    if (loc && loc.includes(env.ORIGIN)) {
      out.headers.set('Location', loc.replace(`https://${env.ORIGIN}`, `https://${host}`));
    }
    return out;
  },
};
