# Localhost Status

Status: `WIP` and under active bug fixing. The current alpha desktop build may still be unstable while startup and packaging issues are being resolved.

Localhost Status is now split into two separate codebases inside one workspace:

- `apps/web`: a hosted landing page that only offers Mac app downloads
- `apps/desktop`: the real macOS app and local dashboard for listing localhost listeners and terminating them

This keeps hosted-web concerns separate from local-machine functionality.

## Workspace commands

From the repo root:

```bash
npm install
```

`npm run build` is the deploy-safe hosted-web build.
Use `npm run build:all` when you want to validate both the landing page and the desktop app web bundle together.

### Landing page

```bash
npm run web:dev
npm run web:build
```

### Mac app

```bash
npm run desktop:dev
npm run desktop:build
```

`desktop:build` creates the packaged macOS app artifacts.

## Desktop app highlights

- The Mac app remembers your view mode, refresh cadence, and listener category filters on your machine.
- It includes a first-run guide that explains what the app can inspect and what it will not terminate.
- Process shutdown uses `SIGTERM` first and only offers force kill if the process refuses to stop.
- The desktop packaging flow now builds a Mac icon set and branded `.dmg` and `.zip` artifacts.

## Hosted landing page

The web app is intentionally only a landing page now.

Set these environment variables for the hosted site:

- `APP_SITE_URL` optional, defaults to `https://localhost.hirahul.xyz`
- `MAC_APP_DOWNLOAD_URL` optional, defaults to the current GitHub release DMG
- `MAC_APP_ZIP_URL` optional, defaults to the current GitHub release ZIP
- `MAC_APP_RELEASE_URL` optional, auto-derived from GitHub download URLs when possible
- `MAC_APP_VERSION` optional

## macOS app notes

- Building and local use do not require publishing through Apple.
- Clean public distribution usually means Apple Developer Program membership for code signing and notarization.
- Before any GitHub push, we will stop and review whether all requirements are done.
