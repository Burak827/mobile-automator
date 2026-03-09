import type { RouteRegistrar } from '../serverHelpers.js';
import {
  mustGetApp,
  parseBoolean,
  parseId,
  parseJsonOrUndefined,
  parseStoreScope,
} from '../serverHelpers.js';

export const registerSyncJobRoutes: RouteRegistrar = (router, ctx) => {
  router.post('/api/apps/:id/sync-jobs', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const body = (req.body ?? {}) as Record<string, unknown>;
      const storeScope = parseStoreScope(body.storeScope);
      const includeRemote = parseBoolean(body.includeRemote, true);

      const job = ctx.repo.createSyncJob({
        appId,
        storeScope,
        payload: {
          includeRemote,
        },
      });

      ctx.jobRunner.enqueue(job.id);

      res.status(202).json({
        job,
        message: 'Preflight sync job queued.',
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/apps/:id/sync-jobs', (req, res, next) => {
    try {
      const appId = parseId(req.params.id);
      mustGetApp(ctx.repo, appId);

      const jobs = ctx.repo.listSyncJobsForApp(appId).map((job) => ({
        ...job,
        payload: parseJsonOrUndefined(job.payloadJson),
        summary: parseJsonOrUndefined(job.summaryJson),
      }));

      res.json({ appId, jobs });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/sync-jobs/:jobId', (req, res, next) => {
    try {
      const jobId = parseId(req.params.jobId);
      const job = ctx.repo.getSyncJobById(jobId);
      if (!job) {
        throw new Error(`Sync job not found: ${jobId}`);
      }

      const logs = ctx.repo.listSyncJobLogs(jobId);
      res.json({
        job: {
          ...job,
          payload: parseJsonOrUndefined(job.payloadJson),
          summary: parseJsonOrUndefined(job.summaryJson),
        },
        logs,
      });
    } catch (error) {
      next(error);
    }
  });
};
