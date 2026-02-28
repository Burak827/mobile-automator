import { AppRecord, MobileAutomatorRepository } from "./db.js";
import { StoreApiService } from "./storeService.js";

export class SyncJobRunner {
  private queue: number[] = [];
  private running = false;

  constructor(
    private readonly repo: MobileAutomatorRepository,
    private readonly storeApi: StoreApiService
  ) {}

  enqueue(jobId: number): void {
    this.queue.push(jobId);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      while (this.queue.length > 0) {
        const jobId = this.queue.shift();
        if (!jobId) continue;
        await this.runJob(jobId);
      }
    } finally {
      this.running = false;
    }
  }

  private async runJob(jobId: number): Promise<void> {
    const job = this.repo.getSyncJobById(jobId);
    if (!job) return;

    this.repo.markSyncJobRunning(jobId);
    this.repo.appendSyncJobLog(jobId, "info", "Job started.");

    try {
      const app = this.repo.getAppById(job.appId);
      if (!app) {
        throw new Error(`App not found for job ${jobId}`);
      }

      const payload = this.parsePayload(job.payloadJson);
      const summary = await this.executePreflight(
        jobId,
        job.storeScope,
        app,
        payload.includeRemote !== false
      );

      this.repo.markSyncJobSuccess(jobId, summary);
      this.repo.appendSyncJobLog(jobId, "info", "Job completed successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.repo.markSyncJobFailure(jobId, message);
      this.repo.appendSyncJobLog(jobId, "error", message);
    }
  }

  private parsePayload(payloadJson: string): { includeRemote?: boolean } {
    try {
      const parsed = JSON.parse(payloadJson);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch {
      return {};
    }
  }

  private async executePreflight(
    jobId: number,
    scope: "app_store" | "play_store" | "both",
    app: AppRecord,
    includeRemote: boolean
  ): Promise<{
    scope: "app_store" | "play_store" | "both";
    includeRemote: boolean;
    appStore?: unknown;
    playStore?: unknown;
    workload: unknown;
    completedAt: string;
  }> {
    const localeRows = this.repo.listStoreLocales(app.id);

    const summary: {
      scope: "app_store" | "play_store" | "both";
      includeRemote: boolean;
      appStore?: unknown;
      playStore?: unknown;
      workload: unknown;
      completedAt: string;
    } = {
      scope,
      includeRemote,
      workload: {},
      completedAt: new Date().toISOString(),
    };

    if (scope === "app_store" || scope === "both") {
      this.repo.appendSyncJobLog(
        jobId,
        "info",
        "Fetching App Store snapshot for preflight."
      );
      summary.appStore = await this.storeApi.fetchAppStoreSnapshot(app);
    }

    if (scope === "play_store" || scope === "both") {
      this.repo.appendSyncJobLog(
        jobId,
        "info",
        "Fetching Google Play snapshot for preflight."
      );
      summary.playStore = await this.storeApi.fetchPlayStoreSnapshot(app);
    }

    summary.workload = await this.storeApi.computeWorkload({
      app,
      localeRows,
      includeRemote,
    });

    return summary;
  }
}
