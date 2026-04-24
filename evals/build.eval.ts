/**
 * Build eval
 *
 * Runs TypeScript type-check and Next.js production build.
 * Both must pass with zero errors.
 */
import { execSync } from "child_process";
import { join } from "path";

const ROOT = join(__dirname, "..");

const checks: { name: string; pass: boolean; output?: string }[] = [];

// 1. TypeScript type-check
try {
  execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
  checks.push({ name: "TypeScript: no type errors", pass: true });
} catch (err: any) {
  checks.push({
    name: "TypeScript: no type errors",
    pass: false,
    output: err.stdout?.toString() || err.message,
  });
}

// 2. Next.js build
try {
  const output = execSync("npx next build", {
    cwd: ROOT,
    stdio: "pipe",
    timeout: 120_000,
  }).toString();
  const passed = output.includes("Generating static pages") || output.includes("Route (app)");
  checks.push({
    name: "Next.js: production build succeeds",
    pass: passed,
    output: passed ? undefined : output.slice(-500),
  });
} catch (err: any) {
  checks.push({
    name: "Next.js: production build succeeds",
    pass: false,
    output: err.stdout?.toString()?.slice(-500) || err.message,
  });
}

// Report
const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error("BUILD EVAL FAILED:");
  for (const f of failed) {
    console.error(`  ✗ ${f.name}`);
    if (f.output) console.error(`    ${f.output.slice(0, 300)}`);
  }
  process.exit(1);
} else {
  console.log("BUILD EVAL PASSED:");
  for (const c of checks) {
    console.log(`  ✓ ${c.name}`);
  }
}
