"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";

export interface JobStatusPollerProps {
  batchId: string;
  jobId: string | null;
  initialStatus: string | null;
  initialProgress: number;
  mode?: "batch" | "job";
  intervalMs?: number;
}

interface PolledJobSnapshot {
  id: string;
  status: string;
  progress: number;
}

interface PolledOverride {
  propSignature: string;
  jobId: string | null;
  status: string | null;
  progress: number;
  awaitingNewJob: boolean;
}

const ACTIVE_STATUSES = new Set(["pending", "running"]);

export function JobStatusPoller({
  batchId,
  jobId,
  initialStatus,
  initialProgress,
  mode = "batch",
  intervalMs = 3000,
}: JobStatusPollerProps) {
  const router = useRouter();
  const propSignature = `${jobId ?? ""}:${initialStatus ?? ""}:${initialProgress}`;
  const [override, setOverride] = useState<PolledOverride | null>(null);
  const refreshedForJobRef = useRef<string | null>(null);

  const activeOverride =
    override && override.propSignature === propSignature ? override : null;

  const liveJobId = activeOverride ? activeOverride.jobId : jobId;
  const status = activeOverride ? activeOverride.status : initialStatus;
  const progress = activeOverride ? activeOverride.progress : initialProgress;
  const awaitingNewJob = activeOverride ? activeOverride.awaitingNewJob : false;

  useEffect(() => {
    if (mode !== "batch") return;
    const onStarted = (event: Event) => {
      const custom = event as CustomEvent<{ batchId?: string }>;
      if (custom.detail?.batchId === batchId) {
        refreshedForJobRef.current = null;
        setOverride({
          propSignature,
          jobId,
          status: "running",
          progress: 10,
          awaitingNewJob: true,
        });
      }
    };
    window.addEventListener("batch-job-started", onStarted);
    return () => window.removeEventListener("batch-job-started", onStarted);
  }, [batchId, jobId, mode, propSignature]);

  const shouldPoll =
    awaitingNewJob || (status !== null && ACTIVE_STATUSES.has(status));

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    const startJobId = jobId;
    let ticksWhileAwaiting = 0;

    const pollOnce = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      controller?.abort();
      controller = new AbortController();

      const endpoint =
        mode === "job" && liveJobId
          ? `/api/v1/jobs/${encodeURIComponent(liveJobId)}`
          : `/api/v1/batches/${encodeURIComponent(batchId)}`;

      try {
        const res = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok || cancelled) return;

        const body = (await res.json()) as {
          ok?: boolean;
          data?: {
            id?: string;
            status?: string;
            progress?: number;
            latestJob?: PolledJobSnapshot | null;
          };
        };

        const snapshot: PolledJobSnapshot | null =
          mode === "job"
            ? body.data?.id && body.data?.status
              ? {
                  id: body.data.id,
                  status: body.data.status,
                  progress: Number(body.data.progress ?? 0),
                }
              : null
            : body.data?.latestJob ?? null;

        if (!snapshot || cancelled) return;

        if (
          awaitingNewJob &&
          snapshot.id === startJobId &&
          !ACTIVE_STATUSES.has(snapshot.status)
        ) {
          ticksWhileAwaiting++;
          if (ticksWhileAwaiting >= 10) {
            setOverride({
              propSignature,
              jobId: snapshot.id,
              status: snapshot.status,
              progress: snapshot.progress,
              awaitingNewJob: false,
            });
          }
          return;
        }

        const isTerminal = !ACTIVE_STATUSES.has(snapshot.status);
        setOverride({
          propSignature,
          jobId: snapshot.id,
          status: snapshot.status,
          progress: snapshot.progress,
          awaitingNewJob: !isTerminal && awaitingNewJob,
        });

        if (isTerminal) {
          const refreshKey = `${snapshot.id}:${snapshot.status}`;
          if (refreshedForJobRef.current !== refreshKey) {
            refreshedForJobRef.current = refreshKey;
            router.refresh();
          }
        }
      } catch {
        // Ignore transient network aborts; next tick retries cleanly
      }
    };

    const timer = window.setInterval(() => {
      void pollOnce();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pollOnce();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void pollOnce();

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    shouldPoll,
    batchId,
    jobId,
    liveJobId,
    mode,
    intervalMs,
    awaitingNewJob,
    propSignature,
    router,
  ]);

  const badgeTone =
    status === "done"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "failed"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-amber-50 text-amber-800 border-amber-200";

  return (
    <div className="inline-flex flex-wrap items-center gap-2" aria-live="polite">
      <span
        data-testid="job-status-badge"
        className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 ${badgeTone}`}
      >
        {status === "done" ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : status === "failed" ? (
          <AlertTriangle className="w-3.5 h-3.5" />
        ) : shouldPoll ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Clock className="w-3.5 h-3.5" />
        )}
        {status ? `${status} (${progress}%)` : "belum berjalan"}
      </span>
      {shouldPoll && (
        <span className="text-[11px] text-amber-700">
          Menyegarkan otomatis…
        </span>
      )}
    </div>
  );
}
