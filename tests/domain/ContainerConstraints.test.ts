import assert from "node:assert/strict";
import { test } from "node:test";
import { Group } from "../../src/domain/Group.js";
import { Rect } from "../../src/domain/primitives/Rect.js";
import type { Shape } from "../../src/domain/Shape.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { EditorSession } from "../../src/application/session/EditorSession.js";
import { CommandDispatcher } from "../../src/composition/defaults/CommandDispatcher.js";

class RequiredChildGroup extends Group {
  override validateChildren(children: readonly Shape[]): void {
    if (!children.some(child => child.id === this.id + "-keep")) {
      throw new Error("missing required child: " + this.id);
    }
  }
}

function protectedGroup(id = "protected"): RequiredChildGroup {
  return new RequiredChildGroup(id, [new Rect(id + "-keep", 1, 2, 3, 4)]);
}

test("container policies reject invalid construction and direct removal or reparent before mutation", () => {
  assert.throws(() => new RequiredChildGroup("invalid"), /missing required child: invalid/);
  const document = new SvgDocument();
  const group = protectedGroup();
  document.add(group);
  document.add(new Group("other"));
  const required = document.get("protected-keep");
  assert.throws(() => document.remove(required.id), /missing required child: protected/);
  assert.throws(() => document.reparent(required.id, "other"), /missing required child: protected/);
  assert.equal(document.get(required.id), required);
  assert.equal(document.parentOf(required.id), group);
  assert.deepEqual(group.children, [required]);
  document.remove(group.id);
  document.add(group);
  assert.equal(document.parentOf(required.id), group);
});

test("all structural replacements are checked before any group list is written", () => {
  const document = new SvgDocument();
  const first = new Group("first");
  const group = protectedGroup();
  const moved = new Rect("moved", 0, 0, 1, 1);
  document.add(first);
  document.add(group);
  document.add(moved);
  assert.throws(() => document.replaceStructure([first, group], new Map([
    [first, [moved]], [group, []],
  ])), /missing required child: protected/);
  assert.deepEqual(document.children, [first, group, moved]);
  assert.deepEqual(first.children, []);
  assert.equal(document.parentOf("moved"), null);
  assert.throws(() => document.replaceStructure([document.get("protected-keep"), first, moved], new Map([[group, []]])),
    /missing required child: protected/);
  assert.equal(document.parentOf("protected-keep"), group);
});

test("group/ungroup and failed structural edits preserve the undo and redo history", () => {
  const session = new EditorSession();
  const cli = new CommandDispatcher(session);
  cli.dispatch("init");
  session.document.add(new Group("outer", [protectedGroup()]));
  cli.dispatch("create rect loose 1 2 3 4");
  cli.dispatch("move loose 5 6");
  cli.dispatch("undo");
  for (const command of ["delete protected-keep", "group collected protected-keep", "addto outer protected-keep", "ungroup protected"]) {
    assert.throws(() => cli.dispatch(command), /missing required child: protected/);
    assert.equal(session.document.find("collected"), undefined);
    assert.equal(session.document.parentOf("protected-keep")?.id, "protected");
  }
  cli.dispatch("redo");
  assert.equal(session.document.get("loose").geometry["x"], 6);
});

test("within-parent reorder and unrelated edits remain allowed by a membership policy", () => {
  const document = new SvgDocument();
  const group = protectedGroup();
  document.add(group);
  document.add(new Rect("extra", 0, 0, 1, 1), group.id);
  document.reparent("protected-keep", group.id, 1);
  assert.deepEqual(group.children.map(child => child.id), ["extra", "protected-keep"]);
  document.remove("extra");
  assert.deepEqual(group.children.map(child => child.id), ["protected-keep"]);
});
