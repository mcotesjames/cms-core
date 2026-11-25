#!/usr/bin/env node
/**
 * Makes an existing account the site's collaborator (the developer's full-access role). Normally
 * not needed: the first sign-up with the site's COLLABORATOR_EMAIL becomes the collaborator
 * automatically. Use this to hand the role to another signed-up account, or on a site set up
 * before COLLABORATOR_EMAIL existed:
 *
 *   npm run user:collaborator -- you@example.com            # local database
 *   npm run user:collaborator -- you@example.com --remote   # the deployed (staging) database
 */
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const email = args.find((a) => !a.startsWith("--"));
if (!email || !/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email)) {
  console.error("Usage: npm run user:collaborator -- <email> [--remote]");
  process.exit(1);
}
const sql = `UPDATE users SET role = 'collaborator', approved_at = coalesce(approved_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE lower(email) = lower('${email}'); SELECT changes() AS updated;`;
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
console.log(`${email} is now the collaborator (${remote ? "deployed" : "local"} database).`);
