import ts from "typescript";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { posix, resolve } from "node:path";

function analyze(source, path = "source.ts") {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const imports = [], exports = [], functions = [];
  const isFunction = node => ts.isFunctionLike(node) && node.body !== undefined;
  const logical = new Set([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken]);
  function complexity(body) {
    let count = 1;
    function visit(node) {
      if (isFunction(node)) {
        return;
      }
      if (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForOfStatement(node)
        || ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)
        || ts.isCaseClause(node) || ts.isCatchClause(node) || ts.isConditionalExpression(node)
        || (ts.isBinaryExpression(node) && logical.has(node.operatorToken.kind))) {
        count += 1;
      }
      ts.forEachChild(node, visit);
    }
    visit(body);
    return count;
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined) {
      imports.push(node.moduleSpecifier.text);
    }
    if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if (node.name !== undefined) {
        exports.push(node.name.getText(ast));
      }
      if (ts.isVariableStatement(node)) {
        exports.push(...node.declarationList.declarations.map(declaration => declaration.name.getText(ast)));
      }
    }
    if (isFunction(node)) {
      const position = ast.getLineAndCharacterOfPosition(node.getStart(ast));
      functions.push({ name: node.name?.getText(ast) ?? "<anonymous>", line: position.line + 1, complexity: complexity(node.body) });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { lines: source.split(/\r?\n/u).length - (source.endsWith("\n") ? 1 : 0),
    imports: [...new Set(imports)], exports, functions,
    forwardingOnly: ast.statements.length > 0 && ast.statements.every(node => ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) };
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).replace(/\r\n/gu, "\n");
}

function role(path, current) {
  if (!current) {
    return path === "src/main.ts" ? "assembly" : "core";
  }
  if (path.startsWith("src/plugins/")) {
    return "plugin";
  }
  return path === "src/main.ts" || path.startsWith("src/composition/") ? "assembly" : "core";
}

function responsibility(path, entryRole, report) {
  if (path.endsWith("/index.ts")) {
    return "Public extension SDK exports";
  }
  const names = report.exports.join(", ") || posix.basename(path, ".ts");
  return ({ core: "Kernel policy/service/contract: ", plugin: "Built-in contribution: ", assembly: "Construct and connect dependencies: " })[entryRole] + names;
}

function snapshot(label, paths, sourceFor, current) {
  const known = new Set(paths);
  const files = paths.sort().map(path => {
    const source = sourceFor(path);
    const report = analyze(source, path);
    const internal = report.imports.filter(name => name.startsWith(".")).map(name => {
      return posix.normalize(posix.join(posix.dirname(path), name)).replace(/\.js$/u, ".ts");
    }).filter(path => known.has(path));
    const entryRole = role(path, current);
    return { path, role: entryRole, responsibility: responsibility(path, entryRole, report),
      sha256: createHash("sha256").update(source).digest("hex"), ...report, dependencies: [...new Set(internal)], fanIn: 0, fanOut: new Set(internal).size };
  });
  for (const file of files) {
    file.fanIn = files.filter(other => other.dependencies.includes(file.path)).length;
  }
  return { label, files, summary: {
    files: files.length, lines: files.reduce((total, file) => total + file.lines, 0),
    functions: files.reduce((total, file) => total + file.functions.length, 0),
    totalComplexity: files.reduce((total, file) => total + file.functions.reduce((sum, fn) => sum + fn.complexity, 0), 0),
    maxComplexity: Math.max(0, ...files.flatMap(file => file.functions.map(fn => fn.complexity))),
    dependencyEdges: files.reduce((total, file) => total + file.fanOut, 0),
    linesByRole: Object.fromEntries(["core", "assembly", "plugin"].map(name => [name, files.filter(file => file.role === name).reduce((sum, file) => sum + file.lines, 0)])),
    roles: Object.fromEntries(["core", "assembly", "plugin"].map(name => [name, files.filter(file => file.role === name).length])),
  } };
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = directory + "/" + entry.name;
    return entry.isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
}

function dependencyDiagram(report) {
  const moduleOf = file => file.path === "src/extensions/index.ts" ? "public SDK|src/extensions/index.ts"
    : file.role + "|" + (file.path === "src/main.ts" ? file.path : posix.dirname(file.path));
  const names = [...new Set(report.files.map(moduleOf))];
  const aliases = new Map(names.map((name, index) => [name, "module" + index]));
  const lines = ["@startuml", "title " + report.label + " - CLI module dependencies", "left to right direction"];
  for (const name of names) {
    const [role, path] = name.split("|");
    lines.push('component "' + path + '\\n' + role + '" as ' + aliases.get(name));
  }
  const modules = new Map(report.files.map(file => [file.path, moduleOf(file)]));
  const counts = new Map();
  for (const file of report.files) {
    for (const dependency of file.dependencies) {
      const source = modules.get(file.path), destination = modules.get(dependency);
      if (destination !== source) {
        const key = aliases.get(source) + " --> " + aliases.get(destination);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, count] of counts) {
    lines.push(key + " : " + count);
  }
  return lines.concat("@enduml", "").join("\n");
}

function checkBoundaries(report) {
  const byPath = new Map(report.files.map(file => [file.path, file]));
  const violations = report.files.flatMap(file => file.dependencies.filter(dependency => {
    const destination = byPath.get(dependency);
    if (file.role === "core") {
      return destination.role !== "core";
    }
    return file.role === "plugin" && destination.role !== "plugin" && dependency !== "src/extensions/index.ts";
  }).map(dependency => file.path + " -> " + dependency));
  if (violations.length > 0) {
    throw new Error("dependency boundary violations:\n" + violations.join("\n"));
  }
}

const artifactNames = ["files.csv", "before.puml", "after.puml", "summary.json"];
const digest = source => createHash("sha256").update(source.replace(/\r\n/gu, "\n")).digest("hex");
const generatorSha256 = () => digest(readFileSync(new URL(import.meta.url), "utf8"));

function verifySnapshot(directory) {
  const saved = JSON.parse(readFileSync(resolve(directory, "inventory.json"), "utf8"));
  const current = snapshot("framework-worktree", walk("src"), path => readFileSync(path, "utf8").replace(/\r\n/gu, "\n"), true);
  const recorded = new Map(saved.after.files.map(file => [file.path, file.sha256]));
  if (current.files.length !== recorded.size || current.files.some(file => file.sha256 !== recorded.get(file.path))) {
    throw new Error("metrics snapshot is stale: CLI sources changed; run npm run metrics");
  }
  if (saved.generatorSha256 !== generatorSha256()) {
    throw new Error("metrics snapshot is stale: generator changed; run npm run metrics");
  }
  for (const name of artifactNames) {
    if (digest(readFileSync(resolve(directory, name), "utf8")) !== saved.artifactHashes?.[name]) {
      throw new Error("metrics artifact changed: " + name);
    }
  }
  checkBoundaries(current);
  process.stdout.write("metrics snapshot verified\n");
}

if (process.argv.includes("--analyze")) {
  process.stdout.write(JSON.stringify(analyze(readFileSync(0, "utf8"))));
} else if (process.argv.includes("--verify")) {
  verifySnapshot(resolve(process.argv[3] ?? "docs/metrics/framework"));
} else if (process.argv.includes("--audit-fixture")) {
  const sources = JSON.parse(readFileSync(0, "utf8"));
  const report = snapshot("fixture", Object.keys(sources), path => sources[path], true);
  checkBoundaries(report);
  process.stdout.write(JSON.stringify({ summary: report.summary, diagram: dependencyDiagram(report) }));
} else if (process.argv.includes("--check-boundaries")) {
  const report = snapshot("framework-worktree", walk("src"), path => readFileSync(path, "utf8"), true);
  checkBoundaries(report);
  process.stdout.write("dependency boundaries passed\n");
} else {
  const baseline = process.argv[2] ?? "final";
  const output = resolve(process.argv[3] ?? "docs/metrics/framework");
  const baselineRevision = git("rev-parse", baseline).trim();
  const paths = git("ls-tree", "-r", "--name-only", baseline, "--", "src").trim().split("\n").filter(path => path.endsWith(".ts"));
  if (paths.length === 0) {
    throw new Error("baseline has no CLI TypeScript sources: " + baseline);
  }
  const before = snapshot(baseline, paths, path => git("show", baseline + ":" + path), false);
  const after = snapshot("framework-worktree", walk("src"), path => readFileSync(path, "utf8").replace(/\r\n/gu, "\n"), true);
  checkBoundaries(after);
  mkdirSync(output, { recursive: true });
  const write = (name, content) => writeFileSync(resolve(output, name), content, "utf8");

  const rows = ["snapshot,role,path,lines,functions,totalComplexity,maxComplexity,fanIn,fanOut"];
  for (const report of [before, after]) {
    for (const file of report.files) {
      rows.push([report.label, file.role, file.path, file.lines, file.functions.length,
        file.functions.reduce((total, fn) => total + fn.complexity, 0), Math.max(0, ...file.functions.map(fn => fn.complexity)), file.fanIn, file.fanOut].join(","));
    }
  }
  write("files.csv", rows.join("\n") + "\n");
  write("before.puml", dependencyDiagram(before));
  write("after.puml", dependencyDiagram(after));
  write("summary.json", JSON.stringify({ before: before.summary, after: after.summary }, null, 2) + "\n");
  const artifactHashes = Object.fromEntries(artifactNames.map(name => [name, digest(readFileSync(resolve(output, name), "utf8"))]));
  write("inventory.json", JSON.stringify({ baselineRevision, headRevision: git("rev-parse", "HEAD").trim(),
    generatorSha256: generatorSha256(), artifactHashes,
    scope: "CLI src/**/*.ts only; excludes VSCode extension, tests, generated files", before, after }, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ before: before.summary, after: after.summary }, null, 2) + "\n");
}
