import { projectDirectory } from "./ProjectDirectory.js";
import type { PluginLoader } from "./plugins/PluginLoader.js";

export async function registerCodePlugins(loader: PluginLoader): Promise<void> {
  const directory = projectDirectory(new URL(import.meta.url));
  await loader.loadCode({ module: "./src/plugins/stats", directory,
    async load() {
      return (await import("../plugins/stats/index.js")).default;
    },
  });
  await loader.loadCode({ module: "./src/plugins/dir", directory,
    async load() {
      return (await import("../plugins/dir/index.js")).default;
    },
  });
  await loader.loadCode({ module: "./src/plugins/box", directory,
    async load() {
      return (await import("../plugins/box/index.js")).default;
    },
  });
  await loader.loadCode({ module: "./src/plugins/modified-star", directory,
    async load() {
      return (await import("../plugins/modified-star/index.js")).default;
    },
  });
}
