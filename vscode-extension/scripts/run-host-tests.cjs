const { execFileSync, spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join, resolve, sep } = require("node:path");

function executable() {
  if (process.env.VSCODE_EXECUTABLE) {
    return process.env.VSCODE_EXECUTABLE;
  }
  if (process.platform === "win32") {
    const command = execFileSync("where.exe", ["code.cmd"], { encoding: "utf8" }).trim().split(/\r?\n/)[0];
    const candidate = join(dirname(dirname(command)), "Code.exe");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("Set VSCODE_EXECUTABLE to the installed VS Code executable.");
}

const root = resolve(__dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "svg-extension-host-"));
const profile = join(temporary, "profile");
const extensions = join(temporary, "extensions");
const reportDirectory = join(root, "docs");
mkdirSync(reportDirectory, { recursive: true });
const env = { ...process.env, SVG_APP_TEST_REPORT: join(reportDirectory, "host-tests.json") };
delete env.ELECTRON_RUN_AS_NODE;
try {
  const result = spawnSync(executable(), [
    join(root, "examples"),
    "--user-data-dir=" + profile,
    "--extensions-dir=" + extensions,
    "--disable-extensions", "--skip-welcome", "--skip-release-notes",
    "--extensionDevelopmentPath=" + root,
    "--extensionTestsPath=" + join(root, "dist", "tests", "host", "index.js"),
  ], { env, stdio: "inherit", windowsHide: true, timeout: 90000 });
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
} finally {
  const resolved = resolve(temporary);
  if (!resolved.startsWith(resolve(tmpdir()) + sep)) {
    throw new Error("Temporary profile escaped its expected directory");
  }
  rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
