/**
 * 将构建目录打包成可用于 GitHub Release 与 Chrome Web Store 的版本化 ZIP。
 *
 * ZIP 根目录直接包含 manifest.json。脚本先移除 dist 中本项目的旧版本包，再递归读取
 * dist/unpacked，并使用 package.json 的版本号生成唯一文件名。
 */

import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const unpacked = resolve(dist, "unpacked");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const archiveName = `chatgpt-feishu-lark-doc-copy-v${packageJson.version}.zip`;

for (const entry of await readdir(dist)) {
  if (entry.startsWith("chatgpt-feishu-lark-doc-copy-v") && entry.endsWith(".zip")) {
    await unlink(resolve(dist, entry));
  }
}

const files = {};
await collectFiles(unpacked, files);
const archive = zipSync(files, { level: 9 });
await writeFile(resolve(dist, archiveName), archive);

console.log(`发布包已生成：${resolve(dist, archiveName)}`);

async function collectFiles(directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, output);
      continue;
    }

    const archivePath = relative(unpacked, absolutePath).split(sep).join("/");
    output[archivePath] = new Uint8Array(await readFile(absolutePath));
  }
}
