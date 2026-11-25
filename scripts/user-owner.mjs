#!/usr/bin/env node
/**
 * Makes an existing account the site's owner (spec Phase 3: the owner is set by script, never
 * by "first sign-up wins"). Sign up in the Studio first, then:
 *
 *   npm run user:owner -- you@example.com            # local database
 *   npm run user:owner -- you@example.com --remote   # the deployed (staging) database
 */
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const email = args.find((a) => !a.startsWith("--"));
if (!email || !/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email)) {
  console.error("Usage: npm run user:owner -- <email> [--remote]");
  process.exit(1);
}
const sql = `UPDATE users SET role = 'owner', approved_at = coalesce(approved_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE lower(email) = lower('${email}'); SELECT changes() AS updated;`;
const out = execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", "--json", "--command", sql],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
const updated = JSON.parse(out).at(-1)?.results?.[0]?.updated ?? 0;
if (!updated) {
  console.error(
    `No account with the email ${email}. Sign up in the Studio first, then run this again.`,
  );
  process.exit(1);
}
console.log(`${email} is now the owner (${remote ? "deployed" : "local"} database).`);
