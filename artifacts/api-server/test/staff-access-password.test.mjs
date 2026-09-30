import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultStaffPasswordFromEmail } from "../src/lib/staff-access-password.ts";

test("uses only the professional email local part as the default password", () => {
  assert.equal(defaultStaffPasswordFromEmail("ana.silva@spa.com.br"), "ana.silva");
  assert.equal(defaultStaffPasswordFromEmail("Marina+bronze@example.com"), "Marina+bronze");
});

test("rejects missing or malformed professional email addresses", () => {
  for (const email of [null, undefined, "", "sem-dominio", "@example.com", "ana@", "ana@@example.com"]) {
    assert.equal(defaultStaffPasswordFromEmail(email), null);
  }
});