import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TYPESCRIPT_EXTENSION = /\.[cm]?tsx?$/;

function withTypeScriptExtension(url) {
  if (TYPESCRIPT_EXTENSION.test(url.pathname)) return url;

  const fileUrl = new URL(`${url.href}.ts`);
  return existsSync(fileURLToPath(fileUrl)) ? fileUrl : new URL(`${url.href}/index.ts`);
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = withTypeScriptExtension(
      new URL(`../src/${specifier.slice(2)}`, import.meta.url)
    );
    return { url: url.href, shortCircuit: true };
  }

  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const url = withTypeScriptExtension(new URL(specifier, context.parentURL));
    return { url: url.href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
