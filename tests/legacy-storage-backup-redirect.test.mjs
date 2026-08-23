import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));

test("legacy storage backup URLs permanently redirect directly to courses", () => {
  const redirects = vercelConfig.redirects ?? [];

  for (const source of ["/storage-backup", "/storage-backup/"]) {
    assert.deepEqual(
      redirects.find((redirect) => redirect.source === source),
      { source, destination: "/courses", permanent: true },
    );
  }
});
