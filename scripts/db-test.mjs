// `pnpm db:test` — MIR-05. Rebuilds the local Supabase database from every migration and runs the
// pgTAP tests in supabase/tests/ against it. The same command is CI's `database` job in verify.yml.
//
// Local only, by construction (ADR-024 decision point 3): every step passes `--local`, and the three
// flags that would point the CLI at a hosted project are refused before anything is spawned.
//
// The stack is left running afterwards; the next `start` reuses it.

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REFUSED_FLAGS = ["--linked", "--db-url", "--project-ref"];

/** Returns the first refused flag found in argv (exact match or `<flag>=…`), or null. */
export function refusedFlag(argv) {
  for (const arg of argv) {
    for (const flag of REFUSED_FLAGS) {
      if (arg === flag || arg.startsWith(flag + "=")) return flag;
    }
  }
  return null;
}

/** The three CLI invocations, in order. Pure; no I/O. */
export function steps() {
  return [
    {
      name: "start",
      args: ["start", "-x", "studio,imgproxy,logflare,vector,edge-runtime,realtime,storage-api,mailpit"],
    },
    { name: "reset", args: ["db", "reset", "--local"] },
    { name: "test", args: ["test", "db", "--local", "supabase/tests"] },
  ];
}

export function main(argv) {
  const flag = refusedFlag(argv);
  if (flag) {
    console.error("db:test refuses " + flag + ": this command only targets the local stack (ADR-024).");
    return 2;
  }
  for (const step of steps()) {
    const result = spawnSync("pnpm", ["exec", "supabase", ...step.args], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    const status = result.status ?? 1;
    if (status !== 0) {
      console.error(`db:test: ${step.name} failed (exit ${status})`);
      return status;
    }
  }
  return 0;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
