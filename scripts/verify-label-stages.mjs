import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const npm = process.env.npm_execpath;
if (npm === undefined || !existsSync(npm)) {
  throw new Error("Run through npm run test:label-stages");
}
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const baseline = git("rev-parse", process.argv[2] ?? "8f3aeb0");
const temporary = mkdtempSync(join(tmpdir(), "svg-label-stages-"));
const worktree = join(temporary, "worktree");
const preparation = [
  "src/application", "src/infrastructure",
  "src/domain/primitives/Circle.ts", "src/domain/primitives/Ellipse.ts", "src/domain/primitives/Line.ts",
  "src/composition/defaults",
  "src/cli/RegisteredTreeFormatter.ts", "src/composition/CheckpointRepository.ts",
  "src/composition/createEditor.ts", "src/composition/startCli.ts",
  "src/extensions/DocumentSnapshot.ts", "src/extensions/ShapeViews.ts",
  "src/extensions/TreeDecorator.ts", "src/extensions/index.ts",
  "tests/composition/CheckpointRepository.test.ts", "tests/extensions/DocumentSnapshot.test.ts",
];
const configuration = [
  "src/plugins/modified-star", "tests/plugins/ModifiedStar.test.ts",
  "tests/plugins/ModifiedStarIntegration.test.ts", "tests/composition/ModifiedStarConfigAssembly.test.ts",
  "doc/Phase2/plugins.labels.config.json", "doc/transcript/labels.txt",
  "doc/transcript/labels.expected.json", "doc/transcript/labels.expected.svg",
  "plugins.config.json", "tests/fixtures/plugins.box-only.config.json",
];
const codeAssembly = [
  "src/composition/codePlugins.ts", "plugins.config.json", "doc/transcript/box.expected.json",
  "tests/composition/ModifiedStarAssembly.test.ts", "tests/composition/CommandAssembly.test.ts",
  "tests/composition/BoxAssembly.test.ts", "tests/composition/BoxConfigAssembly.test.ts",
  "tests/integration/SessionReplay.ts", "tests/cli/StructureCommands.test.ts",
  "tests/fixtures/plugins.none.config.json", "scripts/verify-label-stages.mjs",
];
const results = [];
let attached = false;

function copy(paths) {
  for (const path of paths) {
    cpSync(join(root, path), join(worktree, path), { recursive: true });
  }
}

// Historical worktrees still have the old flat import paths. Bridge them only
// inside that temporary checkout so staged verification can use the current layout.
function bridgeHistoricalImports(directory) {
  const sourceRoot = join(root, directory);
  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const source = join(folder, entry.name);
      if (entry.isDirectory()) {
        visit(source);
      } else if (entry.name.endsWith(".ts") && folder !== sourceRoot) {
        const previous = join(worktree, directory, entry.name);
        if (existsSync(previous)) {
          const current = join(worktree, relative(root, source));
          const module = relative(dirname(previous), current).replaceAll("\\", "/").replace(/\.ts$/u, ".js");
          writeFileSync(previous, 'export * from "./' + module + '";\n');
        }
      }
    }
  }
  visit(sourceRoot);
}

function command(args) {
  return execFileSync(process.execPath, [npm, ...args], {
    cwd: worktree, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  }).replace(/\r\n/gu, "\n");
}

function verify(name, copied, includeLabels) {
  process.stderr.write("Verifying " + name + "...\n");
  const checks = {};
  command(["run", "metrics"]);
  const output = command(["test"]);
  const tests = Number(/^# tests (\d+)$/mu.exec(output)?.[1]);
  if (!Number.isInteger(tests) || !/^# fail 0$/mu.test(output)) {
    throw new Error("Missing passing test summary: " + name);
  }
  checks["npm test"] = tests;
  for (const script of ["typecheck", ...(includeLabels ? ["test:labels"] : []), "check:boundaries", "metrics:check"]) {
    const result = command(["run", script]);
    checks["npm run " + script] = script === "test:labels" ? Number(/^# tests (\d+)$/mu.exec(result)?.[1]) : "passed";
  }
  const inventory = JSON.parse(readFileSync(join(worktree, "docs/metrics/framework/inventory.json"), "utf8"));
  const sourceDigest = createHash("sha256").update(JSON.stringify(inventory.after.files.map(file => [file.path, file.sha256]))).digest("hex");
  results.push({ name, copied, sourceFiles: inventory.after.files.length, sourceDigest, checks });
  process.stderr.write(name + ": " + tests + " tests passed\n");
}

try {
  git("worktree", "add", "--quiet", "--detach", worktree, baseline);
  attached = true;
  // A real dependency copy avoids junctions that could escape cleanup boundaries on Windows.
  cpSync(join(root, "node_modules"), join(worktree, "node_modules"), { recursive: true });
  copy(preparation);
  bridgeHistoricalImports("src/application");
  bridgeHistoricalImports("src/infrastructure");
  verify("preparation", preparation, false);

  copy(configuration);
  // Keep the historical box comparison on its pre-label plugin set until code assembly changes.
  for (const name of ["BoxAssembly.test.ts", "BoxConfigAssembly.test.ts"]) {
    const path = join(worktree, "tests/composition", name);
    const source = readFileSync(path, "utf8").replace('join(repository, "plugins.config.json")',
      'join(repository, "tests/fixtures/plugins.box-only.config.json")');
    writeFileSync(path, source);
  }
  const packagePath = join(worktree, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  packageJson.scripts["test:labels"] = "npm run build && node --test dist/tests/plugins/ModifiedStar.test.js dist/tests/plugins/ModifiedStarIntegration.test.js dist/tests/composition/ModifiedStarConfigAssembly.test.js";
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n");
  verify("configuration-only", [...configuration, "tests/composition/BoxAssembly.test.ts (box-only config)", "tests/composition/BoxConfigAssembly.test.ts (box-only config)", "package.json (configuration-only test:labels)"], true);

  copy(codeAssembly);
  cpSync(join(root, "package.json"), packagePath);
  verify("code-and-config", [...codeAssembly, "package.json"], true);
  process.stdout.write(JSON.stringify({ baseline,
    scope: "Uncommitted source and test combinations in a temporary detached worktree; not Git commit evidence or documentation validation",
    stages: results }, null, 2) + "\n");
} finally {
  const expected = resolve(temporary, "worktree");
  if (resolve(worktree) !== expected || !resolve(temporary).startsWith(resolve(tmpdir()) + "/") && !resolve(temporary).startsWith(resolve(tmpdir()) + "\\")) {
    throw new Error("Unexpected cleanup path");
  }
  try {
    if (attached) {
      git("worktree", "remove", "--force", worktree);
    }
  } finally {
    try {
      rmSync(temporary, { recursive: true, force: true });
    } finally {
      if (attached) {
        git("worktree", "prune");
      }
    }
  }
}
