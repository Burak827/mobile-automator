export type BrowserCanvasImageLoader = (source: string | Uint8Array) => Promise<HTMLImageElement>;

export function createBrowserCanvasImageLoader(): BrowserCanvasImageLoader {
  const cache = new Map<string, Promise<HTMLImageElement>>();

  return async (source: string | Uint8Array) => {
    if (typeof source !== 'string') {
      throw new Error('Browser canvas loader yalnızca string kaynakları destekler.');
    }

    const key = source;
    const cached = cache.get(key);
    if (cached) return cached;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Canvas için görsel yüklenemedi.'));
      image.src = source;
    });

    cache.set(key, promise);
    return promise;
  };
}
