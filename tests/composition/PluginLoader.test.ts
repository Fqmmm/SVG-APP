import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { ShapeDefinition } from "../../src/extensions/index.js";
import type { ShapeProvider } from "../../src/extensions/index.js";
import { Text } from "../../src/domain/Text.js";
import { Framework } from "../../src/extensions/index.js";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { createEditor } from "../../src/composition/createEditor.js";
import { PluginLoader } from "../../src/composition/plugins/PluginLoader.js";

function command(name: string) {
  return { name, help: [name], requiresDocument: false, execute() {
    return name;
  } };
}

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "svg-loader-"));
  return {
    directory,
    config: join(directory, "plugins.config.json"),
    package(name: string, source: string, commands: readonly string[]) {
      const root = join(directory, name);
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "package.json"), JSON.stringify({ name, type: "module", main: "index.mjs", contributes: { commands } }));
      writeFileSync(join(root, "index.mjs"), source);
      return root;
    },
    close() {
      assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

const pluginSource = (name: string): string => `export default { activate(ctx, options) {
  ctx.commands.register({name: ${JSON.stringify(name)}, help: [${JSON.stringify(name)}], requiresDocument: false,
    execute() { return options?.value ?? ${JSON.stringify(name)}; }});
}};`;

test("code activation publishes only a verified manifest and forwards options", async () => {
  const framework = new Framework();
  const errors: string[] = [];
  const loader = new PluginLoader(framework, message => errors.push(message));
  await loader.activate({ module: "code-plugin", manifest: { name: "code-plugin", contributes: { commands: ["echo"] } },
    options: { value: "configured" }, plugin: {
      activate(context: Framework, options: unknown) {
        const value = (options as { value: string }).value;
        context.commands.register({ ...command("echo"), execute() {
          return value;
        } });
      },
    } });
  assert.deepEqual(errors, []);
  assert.equal(createEditor(framework).dispatcher.dispatch("echo"), "configured");
});

test("activation failure and manifest mismatch discard registrations while preserving earlier plugins", async () => {
  const framework = createDefaultFramework();
  const errors: string[] = [];
  const loader = new PluginLoader(framework, message => errors.push(message));
  await loader.activate({ module: "good", manifest: { name: "good", contributes: { commands: ["good"] } }, plugin: {
    activate(context: Framework) {
      context.commands.register(command("good"));
    },
  } });
  await loader.activate({ module: "throwing", manifest: { name: "throwing", contributes: { commands: ["partial"] } }, plugin: {
    async activate(context: Framework) {
      context.commands.register(command("partial"));
      context.decorators.register({ name: "partial-label", decorate() {
        return "partial";
      } });
      await Promise.resolve();
      throw new Error("boom");
    },
  } });
  await loader.activate({ module: "mismatch", manifest: { name: "mismatch", contributes: { commands: ["declared"] } }, plugin: {
    activate(context: Framework) {
      context.commands.register(command("different"));
    },
  } });
  assert.match(errors[0]!, /^error: plugin failed to activate: throwing \(boom\)$/);
  assert.match(errors[1]!, /^error: plugin manifest mismatch: mismatch \(declared: .*registered: /);
  assert.equal(framework.commands.find("partial"), undefined);
  assert.equal(framework.decorators.find("partial-label"), undefined);
  assert.equal(framework.commands.find("different"), undefined);
  assert.equal(createEditor(framework).dispatcher.dispatch("good"), "good");
});

test("a duplicate with an existing registration rejects all contributions from the current plugin", async () => {
  const framework = createDefaultFramework();
  const errors: string[] = [];
  const loader = new PluginLoader(framework, message => errors.push(message));
  const original = framework.commands.get("init");
  await loader.activate({ module: "duplicate", manifest: { name: "duplicate", contributes: { commands: ["fresh", "init"] } }, plugin: {
    activate(context: Framework) {
      context.commands.register(command("fresh"));
      context.commands.register(command("init"));
    },
  } });
  assert.deepEqual(errors, ["error: duplicate registration: commands/init"]);
  assert.equal(framework.commands.find("fresh"), undefined);
  assert.equal(framework.commands.get("init"), original);
});

test("config resolves relative to its own directory, forwards options, skips disabled modules and continues after failures", async () => {
  const files = fixture();
  try {
    files.package("first", pluginSource("first"), ["first"]);
    files.package("no-default", "export const value = 1;", []);
    files.package("dependency", 'import "./missing-dependency.mjs"; export default {};', []);
    files.package("last", pluginSource("last"), ["last"]);
    files.package("disabled-existing", 'throw new Error("disabled module evaluated");', []);
    writeFileSync(files.config, JSON.stringify({ plugins: [
      { module: "./first", options: { value: "options reached plugin" } }, { module: "./missing" },
      { module: "./no-default" }, { module: "./dependency" },
      { module: "./disabled-not-installed", enabled: false }, { module: "./disabled-existing", enabled: false }, { module: "./last" },
    ] }));
    const framework = createDefaultFramework();
    const errors: string[] = [];
    await new PluginLoader(framework, message => errors.push(message)).loadConfiguration(files.config);
    assert.equal(createEditor(framework).dispatcher.dispatch("first"), "options reached plugin");
    assert.equal(createEditor(framework).dispatcher.dispatch("last"), "last");
    assert.equal(errors.length, 3);
    assert.equal(errors[0], "error: plugin not found: ./missing");
    assert.equal(errors[1], "error: plugin has no default export: ./no-default");
    assert.match(errors[2]!, /^error: plugin failed to activate: dependency /);
    assert.equal(framework.commands.all().at(-2)?.name, "first");
    assert.equal(framework.commands.all().at(-1)?.name, "last");
  } finally {
    files.close();
  }
});

test("invalid config starts with built-ins and bare package names resolve through node_modules", async () => {
  const files = fixture();
  try {
    for (const content of ["{broken", "{}", '{"plugins":[null]}', '{"plugins":[{"module":"x","enabled":"false"}]}']) {
      writeFileSync(files.config, content);
      const framework = createDefaultFramework();
      const errors: string[] = [];
      await new PluginLoader(framework, message => errors.push(message)).loadConfiguration(files.config);
      assert.deepEqual(errors, ["error: invalid plugin config"]);
      assert.equal(createEditor(framework).dispatcher.dispatch("init"), "canvas 800x600 created");
    }
    files.package("node_modules/test-package", pluginSource("packaged"), ["packaged"]);
    writeFileSync(files.config, JSON.stringify({ plugins: [{ module: "test-package" }] }));
    const framework = createDefaultFramework();
    const errors: string[] = [];
    await new PluginLoader(framework, message => errors.push(message)).loadConfiguration(files.config);
    assert.deepEqual(errors, []);
    assert.equal(createEditor(framework).dispatcher.dispatch("packaged"), "packaged");
  } finally {
    files.close();
  }
});

test("config activation and manifest failures roll back before a later plugin is loaded", async () => {
  const files = fixture();
  try {
    files.package("bad-activate", pluginSource("partial") + '\n', ["partial"]);
    writeFileSync(join(files.directory, "bad-activate", "index.mjs"),
      'export default { activate(ctx) { ctx.commands.register({name:"partial",help:[],requiresDocument:false,execute(){return "";}}); throw new Error("boom"); } };');
    files.package("bad-manifest", pluginSource("undeclared"), ["expected"]);
    files.package("good-after-failure", pluginSource("after"), ["after"]);
    writeFileSync(files.config, JSON.stringify({ plugins: [
      { module: "./bad-activate" }, { module: "./bad-manifest" }, { module: "./good-after-failure" },
    ] }));
    const framework = createDefaultFramework();
    const errors: string[] = [];
    await new PluginLoader(framework, message => errors.push(message)).loadConfiguration(files.config);
    assert.match(errors[0]!, /^error: plugin failed to activate: bad-activate \(boom\)$/);
    assert.match(errors[1]!, /^error: plugin manifest mismatch: bad-manifest/);
    assert.equal(framework.commands.find("partial"), undefined);
    assert.equal(framework.commands.find("undeclared"), undefined);
    assert.equal(createEditor(framework).dispatcher.dispatch("after"), "after");
  } finally {
    files.close();
  }
});

test("duplicates within one activation and mismatches in another category roll back all categories", async () => {
  const framework = createDefaultFramework();
  const errors: string[] = [];
  const loader = new PluginLoader(framework, message => errors.push(message));
  await loader.activate({ module: "self-duplicate", manifest: { name: "self-duplicate", contributes: { commands: ["same"] } }, plugin: {
    activate(context: Framework) {
      context.commands.register(command("same"));
      context.commands.register(command("same"));
    },
  } });
  await loader.activate({ module: "cross-category", manifest: { name: "cross-category", contributes: { commands: ["new"] } }, plugin: {
    activate(context: Framework) {
      context.commands.register(command("new"));
      context.attributes.register({ name: "extra-attribute", handles() {
        return false;
      }, apply() {
      } });
    },
  } });
  assert.equal(errors[0], "error: duplicate registration: commands/same");
  assert.match(errors[1]!, /plugin manifest mismatch: cross-category/);
  assert.equal(framework.commands.find("same"), undefined);
  assert.equal(framework.commands.find("new"), undefined);
  assert.equal(framework.attributes.find("extra-attribute"), undefined);
});

test("malformed manifests are rejected before plugin activation", async () => {
  for (const contributes of [null, { commands: ["same", "same"] }, { unknown: [] }]) {
    const framework = new Framework();
    const errors: string[] = [];
    let activated = false;
    await new PluginLoader(framework, message => errors.push(message)).activate({
      module: "malformed", manifest: { name: "malformed", contributes }, plugin: {
        activate() {
          activated = true;
        },
      },
    });
    assert.equal(activated, false);
    assert.match(errors[0]!, /plugin failed to activate: malformed \(invalid plugin manifest\)/);
  }
});

test("a package with a nested type-only package.json still uses its plugin manifest", async () => {
  const files = fixture();
  try {
    const root = files.package("node_modules/nested-plugin", pluginSource("nested"), ["nested"]);
    mkdirSync(join(root, "dist"));
    writeFileSync(join(root, "dist", "package.json"), JSON.stringify({ type: "module" }));
    writeFileSync(join(root, "dist", "index.mjs"), pluginSource("nested"));
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    manifest.main = "dist/index.mjs";
    writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
    writeFileSync(files.config, JSON.stringify({ plugins: [{ module: "nested-plugin" }] }));
    const framework = createDefaultFramework();
    const errors: string[] = [];
    await new PluginLoader(framework, message => errors.push(message)).loadConfiguration(files.config);
    assert.deepEqual(errors, []);
    assert.equal(createEditor(framework).dispatcher.dispatch("nested"), "nested");
  } finally {
    files.close();
  }
});

test("code assembly catches module evaluation failures and proceeds to the next selected plugin", async () => {
  const files = fixture();
  try {
    const badRoot = files.package("bad-code", 'throw new Error("evaluation failed");', ["bad"]);
    files.package("good-code", pluginSource("good"), ["good"]);
    const framework = createDefaultFramework();
    const errors: string[] = [];
    const loader = new PluginLoader(framework, message => errors.push(message));
    await loader.loadCode({ module: "./bad-code", directory: files.directory,
      async load() {
        return (await import(pathToFileURL(join(badRoot, "index.mjs")).href)).default;
      },
    });
    await loader.loadCode({ module: "./good-code", directory: files.directory,
      async load() {
        return { activate(context: Framework) {
          context.commands.register(command("good"));
        } };
      },
    });
    assert.deepEqual(errors, ["error: plugin failed to activate: bad-code (evaluation failed)"]);
    assert.equal(framework.commands.find("bad"), undefined);
    assert.equal(createEditor(framework).dispatcher.dispatch("good"), "good");
  } finally {
    files.close();
  }
});

test("bare plugins use import conditions for import-only and dual-export packages", async () => {
  const files = fixture();
  try {
    const esm = files.package("node_modules/esm-only", pluginSource("esm"), ["esm"]);
    writeFileSync(join(esm, "package.json"), JSON.stringify({ name: "esm-only", type: "module",
      exports: { ".": { import: "./index.mjs" } }, contributes: { commands: ["esm"] } }));
    const dual = files.package("node_modules/dual", pluginSource("choice"), ["choice"]);
    writeFileSync(join(dual, "require.cjs"), 'module.exports={activate(ctx){ctx.commands.register({name:"choice",help:[],requiresDocument:false,execute(){return "wrong require branch";}});}};');
    writeFileSync(join(dual, "package.json"), JSON.stringify({ name: "dual", type: "module",
      exports: { ".": { import: "./index.mjs", require: "./require.cjs" } }, contributes: { commands: ["choice"] } }));
    writeFileSync(files.config, JSON.stringify({ plugins: [{ module: "esm-only" }, { module: "dual" }] }));
    const framework = createDefaultFramework();
    const errors: string[] = [];
    await new PluginLoader(framework, message => errors.push(message)).loadConfiguration(files.config);
    assert.deepEqual(errors, []);
    assert.equal(createEditor(framework).dispatcher.dispatch("esm"), "esm");
    assert.equal(createEditor(framework).dispatcher.dispatch("choice"), "choice");
  } finally {
    files.close();
  }
});

test("bare package metadata comes from the package root even when dist has a named manifest", async () => {
  const files = fixture();
  try {
    const root = files.package("node_modules/root-manifest", pluginSource("root"), ["root"]);
    mkdirSync(join(root, "dist"));
    writeFileSync(join(root, "dist", "package.json"), JSON.stringify({ name: "build-output", type: "module" }));
    writeFileSync(join(root, "dist", "entry.mjs"), pluginSource("root"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root-manifest", type: "module", main: "dist/entry.mjs", contributes: { commands: ["root"] } }));
    for (const module of ["root-manifest", "./node_modules/root-manifest/dist/entry.mjs"]) {
      writeFileSync(files.config, JSON.stringify({ plugins: [{ module }] }));
      const framework = createDefaultFramework();
      const errors: string[] = [];
      await new PluginLoader(framework, message => errors.push(message)).loadConfiguration(files.config);
      assert.deepEqual(errors, []);
      assert.equal(createEditor(framework).dispatcher.dispatch("root"), "root");
    }
  } finally {
    files.close();
  }
});

test("plugin-thrown framework-looking messages retain activation failure identity", async () => {
  for (const message of ["duplicate registration: fake", "plugin manifest mismatch: fake"]) {
    const errors: string[] = [];
    await new PluginLoader(new Framework(), error => errors.push(error)).activate({
      module: "spoofed", manifest: { name: "spoofed" }, plugin: {
        activate() {
          throw new Error(message);
        },
      },
    });
    assert.deepEqual(errors, ["error: plugin failed to activate: spoofed (" + message + ")"]);
  }
});

test("shape contributions are discarded after activation failure or a shape manifest mismatch", async () => {
  class DraftText extends Text {
    override get type(): string {
      return "draft";
    }
  }
  for (const mode of ["throw", "mismatch"]) {
    const framework = createDefaultFramework();
    const original = framework.shapes.get("g");
    const errors: string[] = [];
    await new PluginLoader(framework, message => errors.push(message)).activate({
      module: "shapes", manifest: { name: "shapes", contributes: { shapes: mode === "throw" ? ["draft"] : ["other"], commands: ["pending"] } },
      plugin: {
        activate(context: Framework) {
          context.shapes.register({ name: "draft", help: "draft",
            definition: new ShapeDefinition({ geometry: [], hasText: true }, (id, input) => {
              return new DraftText(id, 0, 0, input.content!);
            }),
            text(shape) {
              assert.ok(shape instanceof DraftText);
              return shape.content;
            },
          });
          context.commands.register(command("pending"));
          if (mode === "throw") {
            throw new Error("abort");
          }
        },
      },
    });
    assert.equal(errors.length, 1);
    assert.equal(framework.shapes.find("draft"), undefined);
    assert.equal(framework.commands.find("pending"), undefined);
    assert.equal(framework.shapes.get("g"), original);
  }
});

test("post-activation revalidation catches a shape contract changed after initial registration", async () => {
  class DraftText extends Text {
    override get type(): string {
      return "draft";
    }
  }
  const framework = new Framework();
  const errors: string[] = [];
  await new PluginLoader(framework, message => errors.push(message)).activate({
    module: "changed", manifest: { name: "changed", contributes: { shapes: ["draft"] } }, plugin: {
      activate(context: Framework) {
        const provider: ShapeProvider = {
          name: "draft", help: "draft",
          definition: new ShapeDefinition({ geometry: [], hasText: true }, (id, input) => {
            return new DraftText(id, 0, 0, input.content!);
          }),
          text() {
            return "text";
          },
        };
        context.shapes.register(provider);
        delete provider.text;
      },
    },
  });
  assert.match(errors[0]!, /plugin failed to activate: changed \(invalid shape text contract: draft\)/);
  assert.equal(framework.shapes.find("draft"), undefined);
});
