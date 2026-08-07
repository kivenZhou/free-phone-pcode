import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const apiDir = path.join(root, "src/app/api");
const apiBackup = path.join(root, "src/app/_api_pages_backup");

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function restoreApiRoutes() {
  if (!fs.existsSync(apiBackup)) return;
  if (fs.existsSync(apiDir)) {
    fs.rmSync(apiDir, { recursive: true, force: true });
  }
  fs.renameSync(apiBackup, apiDir);
}

try {
  run("npx", ["tsx", "scripts/sync-for-pages.ts"]);

  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, apiBackup);
  }

  run(
    "npx",
    ["next", "build", "--webpack"],
    {
      GITHUB_PAGES: "true",
      NEXT_PUBLIC_STATIC_EXPORT: "1",
      NEXT_PUBLIC_BASE_PATH: "/free-phone-pcode",
    },
  );
} finally {
  restoreApiRoutes();
}
