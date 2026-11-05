import proxy from './proxy/index.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/p' || pathname.startsWith('/p/')) {
      return proxy.fetch(request, env);
    }
    if (pathname === '/' || pathname.endsWith('/')) {
      const target = new URL(request.url);
      target.pathname = pathname + 'index.html';
      const index = await env.ASSETS.fetch(new Request(target, request));
      if (index.status !== 404) return index;
    }
    return env.ASSETS.fetch(request);
  }
};
