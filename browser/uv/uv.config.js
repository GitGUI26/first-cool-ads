// Ultraviolet configuration for the COOL browser.
//
// The proxy engine intercepts everything under /browser/service/ and asks the
// bare endpoint on this origin for the real page. Keeping the prefix under
// /browser/ means the service worker can only ever touch browser traffic.
self.__uv$config = {
  prefix: '/browser/service/',
  bare: '/bare/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: '/browser/uv/uv.handler.js',
  bundle: '/browser/uv/uv.bundle.js',
  config: '/browser/uv/uv.config.js',
  sw: '/browser/uv/uv.sw.js',
};
