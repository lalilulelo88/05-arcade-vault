import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
const input = JSON.parse(readFileSync(0, "utf8"));
const file = input.tool_input?.file_path;
if (!file) process.exit(0);
// Solo archivos dentro del proyecto.
const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const rel = relative(cwd, file);
if (rel.startsWith("..") || isAbsolute(rel)) process.exit(0);
const bins = {
  prettier: "node_modules/prettier/bin/prettier.cjs",
  eslint: "node_modules/eslint/bin/eslint.js",
};
const run = ([tool, ...args]) =>
  spawnSync(process.execPath, [bins[tool], ...args], { encoding: "utf8", cwd });
const fail = (r) => {
  console.error(r.stdout + r.stderr);
  process.exit(2);
};
const isScript = /\.(m|c)?[jt]sx?$/.test(file);
// Código compacto: sin líneas en blanco. Markdown/JSON quedan fuera (ahí la línea en blanco es sintaxis).
// ponytail: también borra líneas en blanco dentro de template literals; usar un parser si eso importa.
if (isScript || /\.css$/.test(file)) {
  const src = readFileSync(file, "utf8");
  writeFileSync(file, src.replace(/^[ \t]*\r?\n/gm, ""));
}
const prettier = run(["prettier", "--write", "--ignore-unknown", file]);
if (prettier.status !== 0) fail(prettier);
if (isScript) {
  const lint = run(["eslint", "--fix", file]);
  if (lint.status !== 0) fail(lint);
}
