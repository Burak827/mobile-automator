import { getAvailableAIProviders, getDefaultAIProvider } from '../../aiProvider.js';
import type { RouteRegistrar } from '../serverHelpers.js';
import { parseBoolean } from '../serverHelpers.js';
import { LOCALE_CATALOG } from '../localeCatalog.js';
import { STORE_RULES } from '../storeRules.js';

export const registerSystemRoutes: RouteRegistrar = (router, ctx) => {
  router.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'mobile-automator-web',
      uiEnabled: parseBoolean(ctx.env.webEnableUi, false),
      now: new Date().toISOString(),
    });
  });

  router.get('/api/meta', (_req, res) => {
    res.json({
      storeRules: STORE_RULES,
      localeCatalog: LOCALE_CATALOG,
      ai: {
        availableProviders: getAvailableAIProviders(ctx.env),
        defaultProvider: getDefaultAIProvider(ctx.env),
      },
      guidance: {
        publishVsSave:
          'Media requirements like screenshots are strict for publish/review stages; draft saves can be less strict depending on store flow.',
        references: [...STORE_RULES.app_store.sources, ...STORE_RULES.play_store.sources],
      },
    });
  });
};
