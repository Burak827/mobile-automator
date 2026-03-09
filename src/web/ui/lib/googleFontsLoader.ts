const GOOGLE_FONTS_LINK_ID = 'screenshot-google-fonts-link';
const WEIGHT_SET = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

type GoogleFontRequest = {
  family: string;
  weights?: readonly number[];
};

let activeFontsKey = '';

export async function ensureGoogleFontsLoaded(requests: readonly GoogleFontRequest[]): Promise<void> {
  if (typeof document === 'undefined') return;

  const normalizedRequests = normalizeRequests(requests);
  if (normalizedRequests.length === 0) return;

  const nextKey = JSON.stringify(normalizedRequests);
  const link = ensureFontLinkElement();

  if (activeFontsKey !== nextKey) {
    const href = buildGoogleFontsCssUrl(normalizedRequests);
    if (link.href !== href) {
      await loadStylesheet(link, href);
    }
    activeFontsKey = nextKey;
  }

  if (!('fonts' in document)) return;
  await Promise.all(
    normalizedRequests.flatMap((request) =>
      request.weights.map((weight) =>
        document.fonts.load(`${weight} 32px "${request.family}"`).catch(() => undefined)
      )
    )
  );
}

function normalizeRequests(requests: readonly GoogleFontRequest[]): Array<{ family: string; weights: number[] }> {
  const weightsByFamily = new Map<string, Set<number>>();

  for (const request of requests) {
    const family = request.family.trim();
    if (!family) continue;
    const target = weightsByFamily.get(family) ?? new Set<number>();
    const weights = WEIGHT_SET;
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
    params.append('family', `${familyToken}:wght@${request.weights.join(';')}`);
  }
  params.set('display', 'swap');
  return `https://fonts.googleapis.com/css2?${params.toString()}`;
}

function ensureFontLinkElement(): HTMLLinkElement {
  const existing = document.getElementById(GOOGLE_FONTS_LINK_ID);
  if (existing instanceof HTMLLinkElement) return existing;

  const link = document.createElement('link');
  link.id = GOOGLE_FONTS_LINK_ID;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
  return link;
}

function loadStylesheet(link: HTMLLinkElement, href: string): Promise<void> {
  return new Promise((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => resolve();
    link.href = href;
  });
}
