import { access, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const buildRoot = path.join(projectRoot, "build");
const sourceIcon = path.join(buildRoot, "icon.png");
const iconsetRoot = path.join(buildRoot, "icon.iconset");
const targetIcon = path.join(buildRoot, "icon.icns");

const iconSizes = [
  { base: 16, retina: 32 },
  { base: 32, retina: 64 },
  { base: 128, retina: 256 },
  { base: 256, retina: 512 },
  { base: 512, retina: 1024 },
];

async function resizeIcon(source, target, size) {
  await execFileAsync("sips", ["-z", String(size), String(size), source, "--out", target]);
}

try {
  await access(sourceIcon);
} catch {
  console.warn("Skipping macOS icon generation because build/icon.png was not found.");
  process.exit(0);
}

await rm(iconsetRoot, { recursive: true, force: true });
await rm(targetIcon, { force: true });
await mkdir(iconsetRoot, { recursive: true });

for (const size of iconSizes) {
  await resizeIcon(
    sourceIcon,
    path.join(iconsetRoot, `icon_${size.base}x${size.base}.png`),
    size.base,
  );
  await resizeIcon(
    sourceIcon,
    path.join(iconsetRoot, `icon_${size.base}x${size.base}@2x.png`),
    size.retina,
  );
}

await execFileAsync("iconutil", ["-c", "icns", iconsetRoot, "-o", targetIcon]);
await rm(iconsetRoot, { recursive: true, force: true });
