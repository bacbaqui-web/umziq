import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptsDirectory);
const loaderPath = join(scriptsDirectory, "typescriptAliasLoader.mjs");
const verificationScripts = readdirSync(scriptsDirectory)
  .filter((file) => /^verify.+\.ts$/.test(file))
  .sort();

for (const script of verificationScripts) {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--loader",
      loaderPath,
      join(scriptsDirectory, script),
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
    }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Verification suite passed (${verificationScripts.length} scripts)`);
