import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerPath = path.join(root, "wrangler.jsonc");

function runWrangler(args) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== 0) {
    console.error(output);
    throw new Error(`wrangler ${args.join(" ")} failed`);
  }
  return output;
}

function extractNamespaceId(output) {
  const match =
    output.match(/id = "([^"]+)"/) ||
    output.match(/"id":\s*"([^"]+)"/) ||
    output.match(/namespace_id[=:\s"]+([a-f0-9]{32})/i);
  if (!match) {
    throw new Error("无法从 wrangler 输出解析 KV namespace id，请手动写入 wrangler.jsonc");
  }
  return match[1];
}

function patchWranglerJsonc(prodId, previewId) {
  let text = fs.readFileSync(wranglerPath, "utf8");
  const block = previewId
    ? `{
      "binding": "DATA_KV",
      "id": "${prodId}",
      "preview_id": "${previewId}"
    }`
    : `{
      "binding": "DATA_KV",
      "id": "${prodId}"
    }`;

  if (text.includes('"kv_namespaces"')) {
    text = text.replace(/"kv_namespaces"\s*:\s*\[[\s\S]*?\]/, `"kv_namespaces": [\n    ${block}\n  ]`);
  } else {
    throw new Error("wrangler.jsonc 里找不到 kv_namespaces 配置");
  }

  fs.writeFileSync(wranglerPath, text, "utf8");
}

console.log("创建 Cloudflare KV 命名空间 DATA_KV …");
const prodOut = runWrangler(["kv", "namespace", "create", "DATA_KV"]);
const prodId = extractNamespaceId(prodOut);
console.log("生产环境 KV id:", prodId);

let previewId = "";
try {
  const previewOut = runWrangler(["kv", "namespace", "create", "DATA_KV", "--preview"]);
  previewId = extractNamespaceId(previewOut);
  console.log("预览环境 KV id:", previewId);
} catch {
  console.warn("预览 KV 创建跳过（不影响生产部署）");
}

patchWranglerJsonc(prodId, previewId);
console.log("\n已写入 wrangler.jsonc。接下来执行：");
console.log("  npm run deploy:cf");
