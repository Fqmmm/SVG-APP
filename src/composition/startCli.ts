import type { Readable, Writable } from "node:stream";
import { RegisteredRepl } from "../cli/RegisteredRepl.js";
import { createDefaultFramework } from "./createDefaultFramework.js";
import { createEditor } from "./createEditor.js";
import { PluginLoader } from "./plugins/PluginLoader.js";

export async function createCommandEditor(options: { configPath?: string; report: (message: string) => void }) {
  const framework = createDefaultFramework();
  const loader = new PluginLoader(framework, options.report);
  if (options.configPath !== undefined) {
    await loader.loadConfiguration(options.configPath);
    return createEditor(framework);
  }
  const { registerCodePlugins } = await import("./codePlugins.js");
  await registerCodePlugins(loader);
  return createEditor(framework);
}

export async function runCli(options: { args: readonly string[]; input: Readable; output: Writable }): Promise<void> {
  const report = (message: string): void => {
    options.output.write(message + "\n");
  };
  const args = options.args;
  const valid = args.length === 0 || (args.length === 2 && args[0] === "--config");
  if (!valid) {
    report("error: usage: svg-app [--config <file>]");
  }
  const editor = valid ? await createCommandEditor({ report, ...(args.length === 0 ? {} : { configPath: args[1]! }) }) : createEditor();
  await new RegisteredRepl(options.input, options.output, editor.dispatcher).run();
}
