import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { createEditor } from "../../src/composition/createEditor.js";
import { ShapeTypeDecorator } from "../../src/plugins/examples/ShapeTypeDecorator.js";
import { StyleAttributeHandler } from "../../src/plugins/examples/StyleAttributeHandler.js";

test("opt-in class plugins supply real decorator and attribute implementations without changing defaults", () => {
  const framework = createDefaultFramework();
  const editor = createEditor(framework);
  editor.dispatcher.dispatch("init");
  editor.dispatcher.dispatch("create rect r 1 2 3 4");
  const plain = editor.dispatcher.dispatch("tree");
  assert.equal(framework.decorators.all().length, 0);
  assert.equal(framework.attributes.all().length, 0);
  framework.decorators.register(new ShapeTypeDecorator());
  framework.attributes.register(new StyleAttributeHandler());
  assert.equal(editor.dispatcher.dispatch("tree"), plain + " (rect)");
  editor.dispatcher.dispatch("set r fill blue");
  assert.equal(editor.session.document.get("r").styles["fill"], "blue");
  editor.dispatcher.dispatch("undo");
  assert.equal(editor.session.document.get("r").styles["fill"], undefined);
  editor.dispatcher.dispatch("redo");
  assert.equal(editor.session.document.get("r").styles["fill"], "blue");
  assert.throws(() => editor.dispatcher.dispatch("set r label value"), /unknown attribute: label/);
});
