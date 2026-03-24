const GOOGLE_FONTS_STYLE_ID = 'screenshot-google-fonts-style';
const WEIGHT_SET = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

type GoogleFontRequest = {
  family: string;
  weights?: readonly number[];
};

let activeFontsKey = '';
let pendingFontsKey = '';
let pendingFontsPromise: Promise<void> | null = null;
let fontStylesheetQueue: Promise<void> = Promise.resolve();
const fontCssCache = new Map<string, Promise<string>>();

export async function ensureGoogleFontsLoaded(requests: readonly GoogleFontRequest[]): Promise<void> {
  if (typeof document === 'undefined') return;

  const normalizedRequests = normalizeRequests(requests);
  if (normalizedRequests.length === 0) return;

  const nextKey = JSON.stringify(normalizedRequests);
  if (activeFontsKey === nextKey && pendingFontsPromise === null) {
    await waitForFontFaces(normalizedRequests);
    return;
  }

  if (pendingFontsKey === nextKey && pendingFontsPromise) {
    await pendingFontsPromise;
    return;
  }

  const loadTask = async () => {
    if (activeFontsKey !== nextKey) {
      const style = ensureFontStyleElement();
      const css = await buildGoogleFontsCss(normalizedRequests);
      if (style.textContent !== css) {
        style.textContent = css;
      }
      activeFontsKey = nextKey;
    }
    await waitForFontFaces(normalizedRequests);
  };

  const scheduled = fontStylesheetQueue.then(loadTask, loadTask);
  let trackedPromise: Promise<void>;
  trackedPromise = scheduled.finally(() => {
    if (pendingFontsPromise === trackedPromise) {
      pendingFontsKey = '';
      pendingFontsPromise = null;
    }
  });
  pendingFontsKey = nextKey;
  pendingFontsPromise = trackedPromise;
  fontStylesheetQueue = trackedPromise.catch(() => undefined);
  await trackedPromise;
}

function normalizeRequests(requests: readonly GoogleFontRequest[]): Array<{ family: string; weights: number[] }> {
  const weightsByFamily = new Map<string, Set<number>>();

  for (const request of requests) {
    const family = request.family.trim();
    if (!family) continue;
    const target = weightsByFamily.get(family) ?? new Set<number>();
    const weights = request.weights?.length ? request.weights : WEIGHT_SET;
    for (const weight of weights) {
      const numeric = Math.round(Number(weight));
      if (numeric >= 100 && numeric <= 900) {
        target.add(numeric);
      }
    }
    if (target.size === 0) {
      for (const weight of WEIGHT_SET) target.add(weight);
    }
    weightsByFamily.set(family, target);
  }

  return Array.from(weightsByFamily.entries())
    .map(([family, weightSet]) => ({
      family,
      weights: Array.from(weightSet).sort((left, right) => left - right),
    }))
    .sort((left, right) => left.family.localeCompare(right.family));
}

function buildGoogleFontsCssUrl(requests: Array<{ family: string; weights: number[] }>): string {
  const params = new URLSearchParams();
  for (const request of requests) {
    const familyToken = request.family.trim().split(/\s+/).join('+');
    if (request.weights.length > 0) {
      params.append('family', `${familyToken}:wght@${request.weights.join(';')}`);
    } else {
      params.append('family', familyToken);
    }
  }
  params.set('display', 'swap');
  return `https://fonts.googleapis.com/css2?${params.toString()}`;
}

function ensureFontStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(GOOGLE_FONTS_STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;

  const style = document.createElement('style');
  style.id = GOOGLE_FONTS_STYLE_ID;
  document.head.appendChild(style);
  return style;
}

async function buildGoogleFontsCss(
  requests: Array<{ family: string; weights: number[] }>
): Promise<string> {
  const cssBlocks = await Promise.all(
    requests.map(async (request) => {
      const weightedCss = await fetchGoogleFontsCss(buildGoogleFontsCssUrl([request]));
      if (weightedCss) return weightedCss;

      return fetchGoogleFontsCss(
        buildGoogleFontsCssUrl([
          {
            family: request.family,
            weights: [],
          },
        ])
      );
    })
  );

  return cssBlocks.filter((block) => block.trim().length > 0).join('\n');
}

async function fetchGoogleFontsCss(url: string): Promise<string> {
  const cached = fontCssCache.get(url);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) return '';
      const text = await response.text();
      if (!/@font-face\s*\{/.test(text)) return '';
      return text;
    } catch {
      return '';
    }
  })();

  fontCssCache.set(url, request);
  return request;
}

async function waitForFontFaces(
  requests: Array<{ family: string; weights: number[] }>
): Promise<void> {
  if (!('fonts' in document)) return;
  await Promise.all(
    requests.flatMap((request) =>
      Array.from(new Set([400, ...request.weights])).map((weight) =>
        document.fonts.load(`${weight} 32px "${request.family}"`).catch(() => undefined)
      )
    )
  );
}
