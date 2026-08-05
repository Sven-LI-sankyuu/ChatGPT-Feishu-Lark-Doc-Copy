/**
 * 构建可直接加载到 Chrome 或 Edge 的扩展目录。
 *
 * 流程保持简单：清空旧产物，复制清单、源码、许可证和说明文档，不进行打包或远程依赖注入。
 */

import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist", "unpacked");
const files = ["manifest.json", "src", "LICENSE", "NOTICE.md", "README.md"];

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file), { recursive: true });
}

console.log(`扩展已构建到：${output}`);
