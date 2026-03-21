# Localhost Status

Localhost Status is a browser-based local app for seeing which processes are listening on TCP ports on your machine, spotting likely dev servers quickly, and terminating a process without leaving the browser.

## What it does

- Lists listening TCP processes using `lsof` and `ps`
- Highlights likely web and app servers first
- Shows ports, exposure, process ids, and command lines
- Lets you terminate a process with a confirmation dialog
- Refreshes automatically so the dashboard stays current

## Requirements

- macOS or Linux with `lsof` and `ps` available
- Node.js 20+

Windows is not supported in the current implementation.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

For a production-style local run:

```bash
npm run build
npm run start
```

## Safety notes

- Terminate sends `SIGTERM` to the selected process.
- The app refuses to terminate its own Next.js process.
- This dashboard is meant to run on your local machine. Do not expose it publicly.
