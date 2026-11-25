import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/data/password.server";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^pbkdf2-sha256\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword({ hash, password: "correct horse battery" })).toBe(true);
    expect(await verifyPassword({ hash, password: "correct horse batterz" })).toBe(false);
  });

  it("salts every hash, so the same password never hashes the same way twice", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same password"),
      hashPassword("same password"),
    ]);
    expect(a).not.toBe(b);
  });

  it("treats look-alike Unicode forms of a password as the same password", async () => {
    const hash = await hashPassword("café au lait!");
    expect(await verifyPassword({ hash, password: "café au lait!" })).toBe(true);
  });

  it("rejects malformed or foreign hashes instead of throwing", async () => {
    for (const hash of ["", "bcrypt$10$abc", "pbkdf2-sha256$x$a$b", "pbkdf2-sha256$1000"])
      expect(await verifyPassword({ hash, password: "anything at all" })).toBe(false);
  });
});
