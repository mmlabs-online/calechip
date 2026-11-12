// MIR-19-e AC-7 — nginx's SPA fallback never tries a directory (01-plan.md § 4.3).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CONF = readFileSync(fileURLToPath(new URL("../docker/nginx.conf", import.meta.url)), "utf8");

function block(opener: string): string {
  const start = CONF.indexOf(opener);
  expect(start, `${opener} is present`).toBeGreaterThanOrEqual(0);
  const end = CONF.indexOf("}", start);
  return CONF.slice(start, end);
}

describe("MIR-19-e AC-7: nginx fallback", () => {
  it("AC-7: location / has try_files $uri /index.html as its only directive", () => {
    const body = block("location / {");
    const directives = body
      .slice(body.indexOf("{") + 1)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));
    expect(directives).toEqual(["try_files $uri /index.html;"]);
  });

  it("AC-7: `$uri/` appears nowhere in the file", () => {
    expect(CONF).not.toContain("$uri/");
  });

  it("AC-7: the other locations are present unchanged", () => {
    expect(block("location /assets/")).toContain("try_files $uri =404;");
    for (const opener of [
      "location = /healthz",
      "location = /version.json",
      "location = /index.html",
      "location = /system.html",
    ]) {
      expect(CONF, opener).toContain(opener);
    }
    expect(CONF).toContain("include /tmp/nginx/system-panel.conf;");
  });
});
