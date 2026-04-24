/**
 * Hydration safety eval
 *
 * Checks that all components using wagmi hooks (useConnectors, useAccount,
 * useConnections) have a mounted guard to prevent SSR/client mismatch.
 *
 * Rule: any component that renders connector-dependent UI must wait
 * until `mounted === true` before rendering dynamic content.
 */
import { readFileSync } from "fs";
import { join } from "path";

const COMPONENTS_DIR = join(__dirname, "../src/components");
const APP_DIR = join(__dirname, "../src/app");

const FILES_USING_WAGMI_HOOKS = [
  join(COMPONENTS_DIR, "tempo-connect.tsx"),
  join(COMPONENTS_DIR, "tempo-provider.tsx"),
  join(COMPONENTS_DIR, "funding-checklist.tsx"),
  join(APP_DIR, "page.tsx"),
];

const results: { file: string; pass: boolean; reason?: string }[] = [];

for (const filePath of FILES_USING_WAGMI_HOOKS) {
  const content = readFileSync(filePath, "utf-8");
  const fileName = filePath.split("/").pop()!;

  const usesConnectors = content.includes("useConnectors");
  const usesConnections = content.includes("useConnections");
  const usesAccount = content.includes("useAccount");
  const usesEvmAccount = content.includes("useEvmAccount");
  const usesTempoAccount = content.includes("useTempoAccount");

  const needsMountGuard =
    usesConnectors || usesConnections || usesAccount || usesEvmAccount || usesTempoAccount;

  if (!needsMountGuard) {
    results.push({ file: fileName, pass: true, reason: "No wagmi hooks detected" });
    continue;
  }

  const hasMountedState = content.includes("setMounted(true)") || content.includes("mounted");

  if (hasMountedState) {
    results.push({ file: fileName, pass: true });
  } else {
    results.push({
      file: fileName,
      pass: false,
      reason: `Uses wagmi hooks but missing mounted guard — will cause hydration mismatch`,
    });
  }
}

// Report
const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error("HYDRATION EVAL FAILED:");
  for (const f of failed) {
    console.error(`  ✗ ${f.file}: ${f.reason}`);
  }
  process.exit(1);
} else {
  console.log("HYDRATION EVAL PASSED:");
  for (const r of results) {
    console.log(`  ✓ ${r.file}`);
  }
}
