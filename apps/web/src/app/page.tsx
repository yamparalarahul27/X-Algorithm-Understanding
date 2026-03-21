import { headers } from "next/headers";
import Link from "next/link";

const DEFAULT_SITE_URL = "https://localhost.hirahul.xyz";
const DEFAULT_REPO_URL = "https://github.com/yamparalarahul27/localhost-status";
const DEFAULT_RELEASE_URL =
  "https://github.com/yamparalarahul27/localhost-status/releases/tag/v0.1.0-alpha";
const DEFAULT_DMG_URL =
  "https://github.com/yamparalarahul27/localhost-status/releases/download/v0.1.0-alpha/Localhost.Status-0.1.0-arm64-mac.dmg";
const DEFAULT_ZIP_URL =
  "https://github.com/yamparalarahul27/localhost-status/releases/download/v0.1.0-alpha/Localhost.Status-0.1.0-arm64-mac.zip";

function detectPlatform(userAgent: string) {
  const signature = userAgent.toLowerCase();

  if (/(iphone|ipad|ipod)/.test(signature)) {
    return "ios";
  }

  if (/(macintosh|mac os x)/.test(signature)) {
    return "mac";
  }

  if (/windows/.test(signature)) {
    return "windows";
  }

  if (/android/.test(signature)) {
    return "android";
  }

  if (/linux/.test(signature)) {
    return "linux";
  }

  return "unknown";
}

function deriveReleaseUrl(downloadHref: string | null) {
  if (!downloadHref) {
    return null;
  }

  try {
    const url = new URL(downloadHref);

    if (url.hostname !== "github.com") {
      return null;
    }

    const match = url.pathname.match(
      /^\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/[^/]+$/,
    );

    if (!match) {
      return null;
    }

    const [, owner, repo, tag] = match;
    return `https://github.com/${owner}/${repo}/releases/tag/${tag}`;
  } catch {
    return null;
  }
}

function DownloadButton({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        secondary
          ? "inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400"
          : "inline-flex h-11 items-center justify-center rounded-xl bg-sky-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
      }
    >
      {children}
    </Link>
  );
}

function InfoCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 text-balance">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600 text-pretty">{body}</p>
    </article>
  );
}

export default async function Home() {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "";
  const platform = detectPlatform(userAgent);
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_SITE_URL ??
    process.env.APP_SITE_URL ??
    DEFAULT_SITE_URL;
  const downloadUrl = process.env.MAC_APP_DOWNLOAD_URL ?? DEFAULT_DMG_URL;
  const zipUrl = process.env.MAC_APP_ZIP_URL ?? DEFAULT_ZIP_URL;
  const releaseUrl =
    process.env.MAC_APP_RELEASE_URL ??
    deriveReleaseUrl(downloadUrl) ??
    deriveReleaseUrl(zipUrl) ??
    DEFAULT_RELEASE_URL;
  const versionLabel = process.env.MAC_APP_VERSION ?? "Alpha 0.1v";
  const repoUrl = DEFAULT_REPO_URL;
  const prefersDmg = platform === "mac";
  const primaryDownloadUrl = prefersDmg ? downloadUrl : zipUrl ?? downloadUrl;
  const secondaryDownloadUrl = prefersDmg ? zipUrl : downloadUrl;
  const primaryDownloadLabel = prefersDmg
    ? "Recommended for Mac: DMG"
    : "Download for macOS";
  const secondaryDownloadLabel = prefersDmg
    ? "Alternative: ZIP"
    : "Also available as DMG";
  const compatibilityNote =
    platform === "windows" || platform === "android" || platform === "linux"
      ? "This app currently runs on macOS only. The ZIP is also a macOS build, not a Windows app."
      : platform === "ios"
        ? "Downloads are intended for a Mac. The app itself runs on macOS only."
        : "DMG is recommended on Mac. ZIP is available if you prefer to unpack the app manually.";

  return (
    <main
      className="min-h-dvh bg-slate-50 text-slate-950"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      }}
    >
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
              macOS desktop app
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
              {versionLabel}
            </span>
            <Link
              href="https://www.hirahul.xyz"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950"
            >
              Yamparala Rahul
            </Link>
          </div>

          <div className="mt-6 max-w-3xl">
            <h1 className="text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
              A calm little Mac app for seeing what is running on localhost and stopping it fast.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 text-pretty sm:text-lg">
              Localhost Status is a macOS utility by Yamparala Rahul, Design
              Engineer. The website is only the download and overview page. The
              real localhost inspection and terminate actions live in the app
              running on your machine.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {primaryDownloadUrl ? (
              <DownloadButton href={primaryDownloadUrl}>
                {primaryDownloadLabel}
              </DownloadButton>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Download link will go live once the public build URL is added.
              </div>
            )}
            {secondaryDownloadUrl ? (
              <DownloadButton href={secondaryDownloadUrl} secondary>
                {secondaryDownloadLabel}
              </DownloadButton>
            ) : null}
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500 text-pretty">
            {compatibilityNote}
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Public links</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950"
              >
                Site URL
              </Link>
              {releaseUrl ? (
                <Link
                  href={releaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950"
                >
                  Public release
                </Link>
              ) : null}
              <Link
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950"
              >
                GitHub repo
              </Link>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Hosted at{" "}
              <span className="font-mono text-[13px] text-slate-800">
                {siteUrl}
              </span>
              {releaseUrl ? (
                <>
                  {" "}with the app release published at{" "}
                  <span className="font-mono text-[13px] text-slate-800">
                    {releaseUrl}
                  </span>
                  .
                </>
              ) : (
                "."
              )}
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <InfoCard
              title="Why a desktop app?"
              body="A hosted website cannot read or terminate processes on your Mac. The app has to run locally to manage localhost listeners."
            />
            <InfoCard
              title="What it does"
              body="The app lists listening TCP processes, highlights likely development servers, opens detected browser URLs, and uses graceful terminate before offering force kill."
            />
            <InfoCard
              title="Built by Rahul"
              body="Designed and built by Yamparala Rahul, a Design Engineer focused on tools that feel simple, useful, and local-first."
            />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-950 text-balance">
              Install in three steps
            </h2>
            <ol className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
              <li>Download the recommended macOS build, usually the `.dmg`.</li>
              <li>Move `Localhost Status.app` into `Applications`.</li>
              <li>Open the app and allow it through macOS security prompts if needed.</li>
            </ol>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-950 text-balance">
              What to expect
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 text-pretty">
              This is currently an unsigned alpha build, so macOS may show a
              Gatekeeper warning on first open until Apple signing is added in a
              later release.
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-600 text-pretty">
              For local development, use `npm run desktop:dev` from the workspace
              root.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
