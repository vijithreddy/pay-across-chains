/**
 * Race history eval — validates the persistence layer for race results.
 *
 * Checks:
 * 1. RaceResult type exists in types/
 * 2. Storage layer has save and load functions
 * 3. API routes exist for POST and GET
 * 4. Share page exists at /race/[id]
 * 5. SharedRaceView component exists
 * 6. Race form auto-saves and generates share URL
 * 7. No secrets in storage layer (server-only KV env vars)
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];

// 1. RaceResult type
const types = readFileSync(join(SRC, "types/index.ts"), "utf-8");
checks.push({
  name: "types: RaceResult type exists",
  pass: types.includes("RaceResult"),
});
checks.push({
  name: "types: RaceResult has chains array",
  pass: types.includes("chains:") && types.includes("elapsedMs"),
});
checks.push({
  name: "types: RaceResult has winner field",
  pass: types.includes("winner: string"),
});

// 2. Storage layer
const storagePath = join(SRC, "lib/storage.ts");
checks.push({
  name: "storage: file exists",
  pass: existsSync(storagePath),
});
if (existsSync(storagePath)) {
  const storage = readFileSync(storagePath, "utf-8");
  checks.push({
    name: "storage: exports saveRaceResult",
    pass: storage.includes("saveRaceResult"),
  });
  checks.push({
    name: "storage: exports loadRaceResult",
    pass: storage.includes("loadRaceResult"),
  });
  checks.push({
    name: "storage: has in-memory fallback",
    pass: storage.includes("memoryStore") || storage.includes("Map"),
    detail: "Must work without Vercel KV configured",
  });
  checks.push({
    name: "storage: KV env var check before import",
    pass: storage.includes("KV_REST_API_URL"),
    detail: "Dynamic import only when KV is configured",
  });
}

// 3. API routes
checks.push({
  name: "api: POST /api/race route exists",
  pass: existsSync(join(SRC, "app/api/race/route.ts")),
});
checks.push({
  name: "api: GET /api/race/[id] route exists",
  pass: existsSync(join(SRC, "app/api/race/[id]/route.ts")),
});

// 4. Share page
checks.push({
  name: "page: /race/[id] page exists",
  pass: existsSync(join(SRC, "app/race/[id]/page.tsx")),
});

// 5. SharedRaceView component
const viewPath = join(SRC, "components/shared-race-view.tsx");
checks.push({
  name: "component: SharedRaceView exists",
  pass: existsSync(viewPath),
});

// 6. Race form integration
const raceForm = readFileSync(join(SRC, "components/race-form.tsx"), "utf-8");
checks.push({
  name: "race-form: saves result after race completes",
  pass: raceForm.includes("/api/race") || raceForm.includes("saveRaceResult"),
});
checks.push({
  name: "race-form: generates share URL",
  pass: raceForm.includes("shareUrl") || raceForm.includes("share"),
});
checks.push({
  name: "race-form: has Share Results button",
  pass: raceForm.includes("Share") && raceForm.includes("clipboard"),
});

// Report
const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error(`RACE-HISTORY EVAL: ${checks.length - failed.length}/${checks.length} passed\n`);
  for (const f of failed) {
    console.error(`  ✗ ${f.name}`);
    if (f.detail) console.error(`    → ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log(`RACE-HISTORY EVAL: ${checks.length}/${checks.length} passed\n`);
  for (const c of checks) {
    console.log(`  ✓ ${c.name}`);
  }
}
