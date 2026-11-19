// Service worker for the COOL browser's Ultraviolet proxy.
//
// It only ever sees requests under /browser/service/, because that is the scope
// the page registers it with. uv.sw.js pulls in the Ultraviolet bundle and
// config itself, so this file stays a thin wrapper.
importScripts('/browser/uv/uv.sw.js');

const sw = new UVServiceWorker();

self.addEventListener('fetch', event => event.respondWith(sw.fetch(event)));
