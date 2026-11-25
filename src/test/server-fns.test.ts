import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Access is denied by default (spec section 2 → Data layer): every server function lives in
 * src/data/ and starts with one of the access middlewares from src/data/access.ts.
 */
const ROOT = join(__dirname, "..");
const ACCESS = /^\s*\.middleware\(\[\s*as(Visitor|Editor|Admin|Owner)\b/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "test" ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) && name !== "routeTree.gen.ts" ? [path] : [];
  });
}

/** Every `createServerFn(…)` call with the code that follows it, minus comments. */
function serverFns() {
  return files(ROOT).flatMap((path) => {
    const code = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const found: { file: string; after: string }[] = [];
    for (const m of code.matchAll(/createServerFn\(/g)) {
      if (/import\s*\{[^}]*$/.test(code.slice(0, m.index))) continue; // the import itself
      const rest = code.slice(m.index!);
      const close = rest.indexOf(")");
      found.push({ file: relative(ROOT, path), after: rest.slice(close + 1) });
    }
    return found;
  });
}

describe("server functions", () => {
  const fns = serverFns();

  it("exist (the scan works)", () => {
    expect(fns.length).toBeGreaterThan(0);
  });

  it("are all defined in src/data/", () => {
    expect(fns.filter((f) => !f.file.startsWith("data/")).map((f) => f.file)).toEqual([]);
  });

  it("all start with an access middleware", () => {
    const bypassing = fns.filter((f) => !ACCESS.test(f.after)).map((f) => f.file);
    expect(bypassing).toEqual([]);
  });
});
