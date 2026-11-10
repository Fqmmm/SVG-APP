import type { ExtensionRegistry, ShapeProvider } from "../../extensions/index.js";
import { RectProvider, CircleProvider, EllipseProvider, LineProvider, TextProvider, GroupProvider } from "./providers.js";

export function registerBuiltinShapes(registry: ExtensionRegistry<ShapeProvider>): void {
  for (const provider of [new RectProvider(), new CircleProvider(), new EllipseProvider(), new LineProvider(), new TextProvider(), new GroupProvider()]) {
    registry.register(provider);
  }
}
