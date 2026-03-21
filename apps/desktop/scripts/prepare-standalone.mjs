import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = path.join(projectRoot, ".next", "standalone");
const standaloneAppRoot = path.join(standaloneRoot, "apps", "desktop");
const standaloneStaticRoot = path.join(standaloneAppRoot, ".next", "static");
const sourceStaticRoot = path.join(projectRoot, ".next", "static");
const sourcePublicRoot = path.join(projectRoot, "public");
const targetPublicRoot = path.join(standaloneAppRoot, "public");

await mkdir(path.dirname(standaloneStaticRoot), { recursive: true });
await rm(standaloneStaticRoot, { recursive: true, force: true });
await rm(targetPublicRoot, { recursive: true, force: true });
await cp(sourceStaticRoot, standaloneStaticRoot, { recursive: true });

try {
  await access(sourcePublicRoot);
  await cp(sourcePublicRoot, targetPublicRoot, { recursive: true });
} catch {
  // Desktop app currently ships without public assets.
}
