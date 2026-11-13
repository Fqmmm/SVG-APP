import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const extensionRoot = resolve(__dirname, "../../..");
const repositoryRoot = resolve(extensionRoot, "..");

test("both repository-root and standalone F5 launches load the extension manifest instead of the CLI", () => {
  for (const workspace of [repositoryRoot, extensionRoot]) {
    const launch = JSON.parse(readFileSync(resolve(workspace, ".vscode/launch.json"), "utf8"));
    const config = launch.configurations.find((item: { type: string }) => {
      return item.type === "extensionHost";
    });
    assert.ok(config);
    const argument = config.args.find((value: string) => {
      return value.startsWith("--extensionDevelopmentPath=");
    });
    const developmentPath = argument.slice("--extensionDevelopmentPath=".length).replace("${workspaceFolder}", workspace);
    assert.equal(resolve(developmentPath), extensionRoot);
    const manifest = JSON.parse(readFileSync(resolve(developmentPath, "package.json"), "utf8"));
    assert.equal(typeof manifest.engines.vscode, "string");
    assert.ok(existsSync(resolve(developmentPath, manifest.main)));
    const tasks = JSON.parse(readFileSync(resolve(workspace, ".vscode/tasks.json"), "utf8"));
    assert.ok(tasks.tasks.some((task: { label: string }) => {
      return task.label === config.preLaunchTask;
    }));
  }
});

test("the demonstration workspace uses the text editor for SVG navigation", () => {
  const settings = JSON.parse(readFileSync(resolve(extensionRoot, "examples/.vscode/settings.json"), "utf8"));
  assert.equal(settings["workbench.editorAssociations"]["*.svg"], "default");
});
