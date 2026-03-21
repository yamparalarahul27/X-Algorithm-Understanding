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
  ServerCategory,
  ServerSnapshot,
  TerminationSignal,
  TerminateServerResult,
} from "@/lib/localhost-types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const DEFAULT_REFRESH_INTERVAL_MS = 15_000;
const EMPTY_SERVERS: LocalServerProcess[] = [];
const DASHBOARD_PREFERENCES_KEY = "localhost-status.desktop-preferences.v1";
const REFRESH_OPTIONS = [
  { label: "Manual", value: 0, detail: "Refresh only when asked." },
  { label: "5s", value: 5_000, detail: "Fast feedback while you are debugging." },
  { label: "15s", value: 15_000, detail: "Balanced for everyday use." },
  { label: "30s", value: 30_000, detail: "Quieter background monitoring." },
] as const;
const CATEGORY_OPTIONS = [
  { key: "web", label: "Web" },
  { key: "tooling", label: "Tooling" },
  { key: "desktop", label: "Desktop" },
  { key: "system", label: "System" },
] as const satisfies ReadonlyArray<{ key: ServerCategory; label: string }>;
const DEFAULT_CATEGORY_VISIBILITY = {
  web: true,
  tooling: true,
  desktop: true,
  system: true,
} satisfies Record<ServerCategory, boolean>;

type CategoryVisibility = Record<ServerCategory, boolean>;

function isCategoryVisibility(value: unknown): value is CategoryVisibility {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return CATEGORY_OPTIONS.every(({ key }) => typeof candidate[key] === "boolean");
}

function normalizeRefreshInterval(value: unknown) {
  return typeof value === "number" &&
    REFRESH_OPTIONS.some((option) => option.value === value)
    ? value
    : DEFAULT_REFRESH_INTERVAL_MS;
}

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

function GuideCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 text-balance">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600 text-pretty">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
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

export default function LocalhostDashboard() {
  const [snapshot, setSnapshot] = useState<ServerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(
    DEFAULT_REFRESH_INTERVAL_MS,
  );
  const [categoryVisibility, setCategoryVisibility] = useState<CategoryVisibility>(
    DEFAULT_CATEGORY_VISIBILITY,
  );
  const [helpDismissed, setHelpDismissed] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<LocalServerProcess | null>(
    null,
  );
  const [terminating, setTerminating] = useState(false);
  const [terminateResult, setTerminateResult] =
    useState<TerminateServerResult | null>(null);
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
    try {
      const savedPreferences = window.localStorage.getItem(
        DASHBOARD_PREFERENCES_KEY,
      );

      if (savedPreferences) {
        const parsed = JSON.parse(savedPreferences) as {
          showAll?: unknown;
          refreshIntervalMs?: unknown;
          categoryVisibility?: unknown;
          helpDismissed?: unknown;
        };

        if (typeof parsed.showAll === "boolean") {
          setShowAll(parsed.showAll);
        }

        setRefreshIntervalMs(normalizeRefreshInterval(parsed.refreshIntervalMs));

        if (isCategoryVisibility(parsed.categoryVisibility)) {
          setCategoryVisibility(parsed.categoryVisibility);
        }

        if (typeof parsed.helpDismissed === "boolean") {
          setHelpDismissed(parsed.helpDismissed);
        }
      }
    } catch {
      // Ignore malformed local preferences and continue with defaults.
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesReady) {
      return;
    }

    window.localStorage.setItem(
      DASHBOARD_PREFERENCES_KEY,
      JSON.stringify({
        showAll,
        refreshIntervalMs,
        categoryVisibility,
        helpDismissed,
      }),
    );
  }, [
    categoryVisibility,
    helpDismissed,
    preferencesReady,
    refreshIntervalMs,
    showAll,
  ]);

  useEffect(() => {
    void refreshServers("initial");
  }, [refreshServers]);

  useEffect(() => {
    if (refreshIntervalMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshServers("poll");
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshIntervalMs, refreshServers]);

  const servers = snapshot?.servers ?? EMPTY_SERVERS;
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      if (!showAll) {
        if (!server.isLikelyWebApp) {
          return false;
        }
      } else if (!categoryVisibility[server.category]) {
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
  }, [categoryVisibility, normalizedQuery, servers, showAll]);

  const likelyServersCount = servers.filter((server) => server.isLikelyWebApp).length;
  const otherServersCount = servers.length - likelyServersCount;
  const networkExposedCount = servers.filter((server) =>
    server.listeners.some((listener) => listener.exposure === "all-interfaces"),
  ).length;
  const enabledCategoryCount = CATEGORY_OPTIONS.filter(
    ({ key }) => categoryVisibility[key],
  ).length;
  const hasViewOverrides =
    normalizedQuery.length > 0 ||
    showAll ||
    CATEGORY_OPTIONS.some(({ key }) => !categoryVisibility[key]);
  const refreshLabel =
    refreshIntervalMs > 0
      ? `Auto-refresh every ${refreshIntervalMs / 1000} seconds.`
      : "Auto-refresh is paused.";

  function resetView() {
    setQuery("");
    setShowAll(false);
    setCategoryVisibility(DEFAULT_CATEGORY_VISIBILITY);
    setNotice(null);
    setTerminateError(null);
  }

  function toggleCategory(category: ServerCategory) {
    setCategoryVisibility((current) => {
      const enabledCount = CATEGORY_OPTIONS.filter(({ key }) => current[key]).length;

      if (current[category] && enabledCount === 1) {
        return current;
      }

      return {
        ...current,
        [category]: !current[category],
      };
    });
  }

  async function handleTerminate(signal: TerminationSignal) {
    if (!selectedServer) {
      return;
    }

    setTerminating(true);
    setNotice(null);
    setTerminateError(null);
    setTerminateResult(null);

    try {
      const response = await fetch(`/api/servers/${selectedServer.pid}/terminate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signal }),
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
      await refreshServers("manual");

      if (result.terminated) {
        setNotice(result.message);
        setSelectedServer(null);
        return;
      }

      setTerminateResult(result);
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
              macOS desktop app
            </span>
          </div>

          <div className="mt-5 max-w-3xl">
            <h1 className="text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
              See what is listening on localhost and stop it without leaving the
              app.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 text-pretty sm:text-lg">
              This app inspects live TCP listeners on your machine, surfaces likely
              app servers first, remembers how you like to browse them, and lets
              you terminate a process with a confirmation step.
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

        {!helpDismissed ? (
          <section className="mt-6 rounded-3xl border border-sky-100 bg-sky-50 p-6 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold text-sky-700">First-run guide</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950 text-balance">
                  This app manages real listeners on this Mac, not a remote machine.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 text-pretty">
                  Your view mode, category filters, and refresh cadence are saved on
                  this Mac so the app opens the same way next time.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void refreshServers("manual")}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh now"}
                </Button>
                <Button variant="ghost" onClick={() => setHelpDismissed(true)}>
                  Hide tips
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <GuideCard
                title="What you can do"
                items={[
                  "Inspect TCP listeners that are currently running on this Mac.",
                  "Spot likely dev servers quickly and open browser-ready ports.",
                  "See when a process is network exposed instead of loopback only.",
                  "Terminate a process gracefully first, then force kill only if needed.",
                ]}
              />
              <GuideCard
                title="What this app will not do"
                items={[
                  "It will not inspect remote machines or anything hosted in a browser tab.",
                  "It will not terminate the dashboard process itself.",
                  "It may be blocked from killing protected or permission-restricted processes.",
                  "It only shows processes that are actively listening for TCP connections.",
                ]}
              />
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
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
                    placeholder="next, vite, 3002, node"
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
                    <Button
                      variant="ghost"
                      onClick={resetView}
                      disabled={!hasViewOverrides}
                    >
                      Reset view
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Refresh cadence
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {REFRESH_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={
                          refreshIntervalMs === option.value ? "default" : "secondary"
                        }
                        size="sm"
                        aria-pressed={refreshIntervalMs === option.value}
                        onClick={() => setRefreshIntervalMs(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-slate-500 text-pretty">
                    {
                      REFRESH_OPTIONS.find(
                        (option) => option.value === refreshIntervalMs,
                      )?.detail
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Categories in all-listeners view
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_OPTIONS.map((option) => (
                      <Button
                        key={option.key}
                        variant={
                          categoryVisibility[option.key] ? "default" : "secondary"
                        }
                        size="sm"
                        aria-pressed={categoryVisibility[option.key]}
                        onClick={() => toggleCategory(option.key)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-slate-500 text-pretty">
                    {showAll
                      ? `${enabledCategoryCount} of ${CATEGORY_OPTIONS.length} categories are visible.`
                      : "Focused view always shows likely app servers first."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-sm leading-6 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  Saved on this Mac
                </span>
                <span>{refreshLabel}</span>
              </div>

              <p>
                Updated{" "}
                <span className="font-medium tabular-nums text-slate-700">
                  {snapshot ? formatTimestamp(snapshot.generatedAt) : "Not yet"}
                </span>
              </p>
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
          ) : servers.length === 0 ? (
            <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950 text-balance">
                No active TCP listeners were found.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 text-pretty">
                Start a local dev server or another listener on this Mac, then
                refresh the dashboard. Background tasks that are not listening on a
                TCP port will not appear here.
              </p>
              <div className="mt-5">
                <Button
                  variant="secondary"
                  onClick={() => void refreshServers("manual")}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh now"}
                </Button>
              </div>
            </article>
          ) : filteredServers.length > 0 ? (
            filteredServers.map((server) => (
              <ServerCard
                key={server.pid}
                server={server}
                onTerminate={(nextServer) => {
                  setTerminateError(null);
                  setTerminateResult(null);
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
                {showAll
                  ? "The current search or category filters are hiding every result. Reset the view to get back to the full list."
                  : "Focused view only shows likely app servers. Switch to all listeners if you want to inspect background tools, desktop apps, or system listeners."}
              </p>
              <div className="mt-5">
                {showAll ? (
                  <Button onClick={resetView}>Reset view</Button>
                ) : (
                  <Button onClick={() => setShowAll(true)}>Show all listeners</Button>
                )}
              </div>
            </article>
          )}
        </section>
      </div>

      <AlertDialog
        open={Boolean(selectedServer)}
        onOpenChange={(open) => {
          if (!open && !terminating) {
            setSelectedServer(null);
            setTerminateResult(null);
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
              This sends {terminateResult?.signal === "SIGKILL" ? "SIGKILL" : "SIGTERM"} to PID{" "}
              <span className="font-medium tabular-nums text-slate-950">
                {selectedServer?.pid ?? "—"}
              </span>
              . Graceful terminate is tried first, and force kill is available only
              if the process refuses to stop.
            </AlertDialogDescription>
            {selectedServer ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="font-medium text-slate-950">{selectedServer.args}</p>
                <p className="mt-2 tabular-nums">
                  {selectedServer.listeners.map(formatListener).join(" · ")}
                </p>
              </div>
            ) : null}
            {terminateResult && !terminateResult.terminated ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  terminateResult.signal === "SIGKILL"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-amber-200 bg-amber-50 text-amber-800",
                )}
              >
                <p className="font-medium">{terminateResult.message}</p>
                {terminateResult.signal === "SIGTERM" ? (
                  <p className="mt-2 leading-6">
                    Some dev servers ignore graceful shutdown. Force kill stops the
                    process immediately and may interrupt cleanup work or lose
                    unsaved state.
                  </p>
                ) : (
                  <p className="mt-2 leading-6">
                    The process still appears to be running. This usually means macOS
                    denied the request or the process changed state before the refresh
                    completed.
                  </p>
                )}
              </div>
            ) : null}
            {terminateError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {terminateError}
              </div>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={terminating}>
                Cancel
              </Button>
            </AlertDialogCancel>
            {terminateResult && !terminateResult.terminated ? (
              <Button
                variant="danger"
                onClick={() => void handleTerminate("SIGKILL")}
                disabled={terminating}
              >
                {terminating ? "Force killing..." : "Force kill process"}
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={() => void handleTerminate("SIGTERM")}
                disabled={terminating || !selectedServer}
              >
                {terminating ? "Terminating..." : "Terminate process"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
