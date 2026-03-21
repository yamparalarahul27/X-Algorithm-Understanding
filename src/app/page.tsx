"use client";

import Link from "next/link";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ListenerExposure,
  LocalServerProcess,
  ServerSnapshot,
  TerminateServerResult,
} from "@/lib/localhost-types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const AUTO_REFRESH_MS = 7_000;
const EMPTY_SERVERS: LocalServerProcess[] = [];

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function exposureLabel(exposure: ListenerExposure) {
  if (exposure === "loopback") {
    return "Local only";
  }

  if (exposure === "all-interfaces") {
    return "Network exposed";
  }

  return "Specific host";
}

function categoryLabel(server: LocalServerProcess) {
  if (server.isLikelyWebApp) {
    return "Likely app server";
  }

  if (server.category === "system") {
    return "System listener";
  }

  if (server.category === "desktop") {
    return "Desktop app";
  }

  return "Tooling listener";
}

function categoryClassName(server: LocalServerProcess) {
  if (server.isLikelyWebApp) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (server.category === "system") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (server.category === "desktop") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function listenerClassName(exposure: ListenerExposure) {
  if (exposure === "all-interfaces") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (exposure === "loopback") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatListener(listener: LocalServerProcess["listeners"][number]) {
  if (
    listener.host === "*" ||
    listener.host === "0.0.0.0" ||
    listener.host === "::"
  ) {
    return `localhost:${listener.port}`;
  }

  return `${listener.host}:${listener.port}`;
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950 tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500 text-pretty">{detail}</p>
    </article>
  );
}

function LoadingCard() {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-5 w-40 rounded bg-slate-200" />
      <div className="mt-4 h-4 w-full rounded bg-slate-100" />
      <div className="mt-2 h-4 w-5/6 rounded bg-slate-100" />
      <div className="mt-5 flex flex-wrap gap-2">
        <div className="h-8 w-24 rounded-full bg-slate-100" />
        <div className="h-8 w-32 rounded-full bg-slate-100" />
        <div className="h-8 w-20 rounded-full bg-slate-100" />
      </div>
    </article>
  );
}

function ServerCard({
  server,
  onTerminate,
}: {
  server: LocalServerProcess;
  onTerminate: (server: LocalServerProcess) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-950 text-balance">
              {server.displayName}
            </h2>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                categoryClassName(server),
              )}
            >
              {categoryLabel(server)}
            </span>
            {server.isCurrentApp ? (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                This dashboard
              </span>
            ) : null}
          </div>

          <p className="mt-3 truncate text-sm leading-6 text-slate-600">
            {server.args}
          </p>

          <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <div>
              <dt className="font-medium text-slate-500">PID</dt>
              <dd className="mt-1 tabular-nums text-slate-950">{server.pid}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Parent PID</dt>
              <dd className="mt-1 tabular-nums text-slate-950">
                {server.ppid ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Owner</dt>
              <dd className="mt-1 text-slate-950">{server.user}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            {server.listeners.map((listener) => (
              <span
                key={listener.id}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums",
                  listenerClassName(listener.exposure),
                )}
              >
                {formatListener(listener)} · {exposureLabel(listener.exposure)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          {server.browserUrl ? (
            <Link
              href={server.browserUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400"
            >
              Open in browser
            </Link>
          ) : null}
          <Button
            variant="danger"
            onClick={() => onTerminate(server)}
            disabled={!server.canTerminate}
          >
            Terminate
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<ServerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<LocalServerProcess | null>(
    null,
  );
  const [terminating, setTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const refreshServers = useCallback(
    async (mode: "initial" | "manual" | "poll") => {
      if (mode === "initial") {
        setLoading(true);
      }

      if (mode === "manual") {
        setRefreshing(true);
      }

      try {
        const response = await fetch("/api/servers", { cache: "no-store" });
        const body = (await response.json()) as ServerSnapshot | { error?: string };

        if (!response.ok) {
          throw new Error(
            body && "error" in body
              ? body.error || "Unable to load servers."
              : "Unable to load servers.",
          );
        }

        startTransition(() => {
          setSnapshot(body as ServerSnapshot);
          setError(null);
        });
      } catch (refreshError) {
        const message =
          refreshError instanceof Error
            ? refreshError.message
            : "Unable to load servers.";
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void refreshServers("initial");

    const intervalId = window.setInterval(() => {
      void refreshServers("poll");
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshServers]);

  const servers = snapshot?.servers ?? EMPTY_SERVERS;
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      if (!showAll && !server.isLikelyWebApp) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const listenerText = server.listeners
        .map((listener) => `${listener.host} ${listener.port}`)
        .join(" ");
      const haystack =
        `${server.displayName} ${server.command} ${server.args} ${server.pid} ${listenerText}`.toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, servers, showAll]);

  const likelyServersCount = servers.filter((server) => server.isLikelyWebApp).length;
  const otherServersCount = servers.length - likelyServersCount;
  const networkExposedCount = servers.filter((server) =>
    server.listeners.some((listener) => listener.exposure === "all-interfaces"),
  ).length;

  async function handleTerminate() {
    if (!selectedServer) {
      return;
    }

    setTerminating(true);
    setTerminateError(null);

    try {
      const response = await fetch(`/api/servers/${selectedServer.pid}/terminate`, {
        method: "POST",
      });
      const body = (await response.json()) as
        | TerminateServerResult
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          body && "error" in body
            ? body.error || "Unable to terminate the process."
            : "Unable to terminate the process.",
        );
      }

      const result = body as TerminateServerResult;
      setNotice(result.message);
      setSelectedServer(null);
      await refreshServers("manual");
    } catch (terminationError) {
      const message =
        terminationError instanceof Error
          ? terminationError.message
          : "Unable to terminate the process.";
      setTerminateError(message);
    } finally {
      setTerminating(false);
    }
  }

  return (
    <main
      className="min-h-dvh bg-slate-50 text-slate-950"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      }}
    >
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
              Localhost process dashboard
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
              Browser-first local app
            </span>
          </div>

          <div className="mt-5 max-w-3xl">
            <h1 className="text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
              See what is listening on localhost and stop it without leaving the
              browser.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 text-pretty sm:text-lg">
              This app inspects live TCP listeners on your machine, surfaces likely
              app servers first, and lets you terminate a process with a confirmation
              step. It is built for local use on macOS or Linux.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Likely app servers"
              value={likelyServersCount}
              detail="Web and dev servers are surfaced first so your active projects are easy to spot."
            />
            <SummaryCard
              label="Other listeners"
              value={otherServersCount}
              detail="Desktop apps, helpers, and tooling listeners can be revealed when you need the full view."
            />
            <SummaryCard
              label="Network exposed"
              value={networkExposedCount}
              detail="These processes are listening on all interfaces, not just loopback."
            />
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="space-y-2">
                <label
                  htmlFor="server-search"
                  className="text-sm font-medium text-slate-700"
                >
                  Search by process, pid, or port
                </label>
                <input
                  id="server-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="next, vite, 3001, node"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none ring-2 ring-transparent transition focus:border-sky-500 focus:ring-sky-100"
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">View</span>
                <div className="flex gap-2">
                  <Button
                    variant={showAll ? "secondary" : "default"}
                    onClick={() => setShowAll(false)}
                  >
                    Focused
                  </Button>
                  <Button
                    variant={showAll ? "default" : "secondary"}
                    onClick={() => setShowAll(true)}
                  >
                    All listeners
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Actions</span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => void refreshServers("manual")}
                    disabled={refreshing}
                  >
                    {refreshing ? "Refreshing..." : "Refresh now"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-sm leading-6 text-slate-500">
              <p>
                Updated{" "}
                <span className="font-medium tabular-nums text-slate-700">
                  {snapshot ? formatTimestamp(snapshot.generatedAt) : "Not yet"}
                </span>
              </p>
              <p>Auto-refresh every {AUTO_REFRESH_MS / 1000} seconds.</p>
            </div>
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="mt-6 space-y-4">
          {loading ? (
            <>
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </>
          ) : filteredServers.length > 0 ? (
            filteredServers.map((server) => (
              <ServerCard
                key={server.pid}
                server={server}
                onTerminate={(nextServer) => {
                  setTerminateError(null);
                  setNotice(null);
                  setSelectedServer(nextServer);
                }}
              />
            ))
          ) : (
            <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950 text-balance">
                No matching listeners in the current view.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 text-pretty">
                Try a broader search, switch to all listeners, or start a local
                server and refresh the dashboard.
              </p>
              {!showAll ? (
                <div className="mt-5">
                  <Button onClick={() => setShowAll(true)}>Show all listeners</Button>
                </div>
              ) : null}
            </article>
          )}
        </section>
      </div>

      <AlertDialog
        open={Boolean(selectedServer)}
        onOpenChange={(open) => {
          if (!open && !terminating) {
            setSelectedServer(null);
            setTerminateError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Terminate {selectedServer?.displayName ?? "this process"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This sends SIGTERM to PID{" "}
              <span className="font-medium tabular-nums text-slate-950">
                {selectedServer?.pid ?? "—"}
              </span>
              . The owning app may close immediately if it does not handle graceful
              shutdown.
            </AlertDialogDescription>
            {selectedServer ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="font-medium text-slate-950">{selectedServer.args}</p>
                <p className="mt-2 tabular-nums">
                  {selectedServer.listeners.map(formatListener).join(" · ")}
                </p>
              </div>
            ) : null}
            {terminateError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {terminateError}
              </div>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={terminating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTerminate} disabled={terminating}>
              {terminating ? "Terminating..." : "Terminate process"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
