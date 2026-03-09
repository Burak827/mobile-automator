import express from "express";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "../config.js";
import { MobileAutomatorRepository } from "./db.js";
import { SyncJobRunner } from "./jobRunner.js";
import { StoreApiService } from "./storeService.js";
import { registerAppCrudRoutes } from "./routes/appCrudRoutes.js";
import { registerDiagnosticRoutes } from "./routes/diagnosticRoutes.js";
import { registerIapRoutes } from "./routes/iapRoutes.js";
import { registerLocaleRoutes } from "./routes/localeRoutes.js";
import { registerNamingRoutes } from "./routes/namingRoutes.js";
import { registerScreenshotRoutes } from "./routes/screenshotRoutes.js";
import { registerSyncJobRoutes } from "./routes/syncJobRoutes.js";
import { registerSystemRoutes } from "./routes/systemRoutes.js";
import { registerTranslationRoutes } from "./routes/translationRoutes.js";
import { parseBoolean } from "./serverHelpers.js";

const env = loadEnvConfig();
const WEB_PORT = Number(env.webPort ?? "8787");
const DB_PATH = resolve(process.cwd(), env.webDbPath ?? "./data/mobile-automator.sqlite");
const WEB_ENABLE_UI = parseBoolean(env.webEnableUi, false);

const repo = new MobileAutomatorRepository(DB_PATH);
const storeApi = new StoreApiService();
const jobRunner = new SyncJobRunner(repo, storeApi);

const app = express();
app.use(express.json({ limit: "25mb" }));
const apiRouter = express.Router();

registerSystemRoutes(apiRouter, { repo, storeApi, jobRunner, env });
registerAppCrudRoutes(apiRouter, { repo, storeApi, jobRunner, env });
registerIapRoutes(apiRouter, { repo, storeApi, jobRunner, env });
registerLocaleRoutes(apiRouter, { repo, storeApi, jobRunner, env });
registerNamingRoutes(apiRouter, { repo, storeApi, jobRunner, env });
registerDiagnosticRoutes(apiRouter, { repo, storeApi, jobRunner, env });
registerScreenshotRoutes(apiRouter, { repo, storeApi, jobRunner, env });
registerSyncJobRoutes(apiRouter, { repo, storeApi, jobRunner, env });
registerTranslationRoutes(apiRouter, { repo, storeApi, jobRunner, env });
app.use(apiRouter);

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);
const publicDir = join(currentDir, "public");

if (WEB_ENABLE_UI && existsSync(publicDir)) {
  app.get(["/sstest", "/sstest/"], (_req, res) => {
    res.sendFile(join(publicDir, "sstest.html"));
  });

  app.use(express.static(publicDir));

  app.use((req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(join(publicDir, "index.html"));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(400).json({ error: message });
});

const server = app.listen(WEB_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `mobile-automator web listening on http://localhost:${WEB_PORT} (db: ${DB_PATH})`
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      repo.close();
      process.exit(0);
    });
  });
}
