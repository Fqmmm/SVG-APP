import assert from "node:assert/strict";
import { test } from "node:test";
import { Tokenizer } from "../../src/cli/Tokenizer.js";

test("tokenizer skips blank lines and whole-line comments", () => {
  const tokenizer = new Tokenizer();
  for (const line of ["", " \t ", "  # comment"]) assert.deepEqual(tokenizer.tokenize(line), []);
});
test("tokenizer keeps colors and hashes inside ordinary arguments", () => {
  assert.deepEqual(new Tokenizer().tokenize("create rect r 0 0 10 20 #4a90d9"), ["create", "rect", "r", "0", "0", "10", "20", "#4a90d9"]);
});
test("tokenizer preserves quoted spaces, Chinese, empty content and hash characters", () => {
  const tokenizer = new Tokenizer();
  assert.deepEqual(tokenizer.tokenize('create text t 1 2 "开始 # end"'), ["create", "text", "t", "1", "2", "开始 # end"]);
  assert.deepEqual(tokenizer.tokenize('create text t 1 2 ""'), ["create", "text", "t", "1", "2", ""]);
});
test("tokenizer decodes escaped quotes and backslashes inside quotes", () => {
  const line = "create text t 1 2 \"say \\\"Hi\\\" at C:\\\\tmp\"";
  assert.deepEqual(new Tokenizer().tokenize(line), ["create", "text", "t", "1", "2", "say \"Hi\" at C:\\tmp"]);
});
test("tokenizer rejects unterminated quotes, invalid escapes and joined quoted tokens", () => {
  const tokenizer = new Tokenizer();
  for (const line of ["create text t 1 2 \"open", "x \"a\\q\"", "x \"a\"b", "x a\"b\"", "x \"trailing\\"]) {
    assert.throws(() => tokenizer.tokenize(line), /quote|escape/);
  }
});
test("tokenizer does not interpret trailing hashes as comments", () => {
  assert.deepEqual(new Tokenizer().tokenize("move r 1 2 # note"), ["move", "r", "1", "2", "#", "note"]);
});
