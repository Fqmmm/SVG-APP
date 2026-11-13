import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { createEditor } from "../../src/composition/createEditor.js";
import { ShapeDefinition, Group } from "../../src/extensions/index.js";

class NamedGroup extends Group {
  override get type(): string {
    return "named";
  }

  override get canUngroup(): boolean {
    return false;
  }

  override assertUngroupable(): void {
    throw new Error("named container cannot be dissolved: " + this.id);
  }
}

test("registered presentation and edit descriptions customize a type without changing command dispatch", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "named", help: "  named <id>",
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new NamedGroup(id);
    }),
    present(shape) {
      return { treeLabel: "container#" + shape.id, summary: "" };
    },
    describeEdit(change) {
      if (change.operation === "create" && change.phase === "applied") {
        return "constructed " + change.shape.id;
      }
      if (change.operation === "set") {
        return change.phase + " " + change.attribute;
      }
      return undefined;
    },
  });
  const editor = createEditor(framework);
  editor.dispatcher.dispatch("init");
  assert.equal(editor.dispatcher.dispatch("create named n"), "constructed n");
  assert.match(editor.dispatcher.dispatch("tree"), /container#n/);
  assert.equal(editor.dispatcher.dispatch("set n fill red"), "applied fill");
  assert.equal(editor.dispatcher.dispatch("undo"), "undone fill");
  assert.equal(editor.dispatcher.dispatch("redo"), "applied fill");
  assert.throws(() => editor.dispatcher.dispatch("ungroup n"), /named container cannot be dissolved: n/);
});
