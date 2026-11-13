#!/usr/bin/env node
// Writes .screen-spec.json and per-harness project-level MCP config.
// Zero dependencies. Never writes an API key value, only the env var name.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_FILE = ".screen-spec.json";
const SERVER_NAME = "spec-tool";
const DEFAULT_KEY_ENV = "SPEC_TOOL_KEY";
const KEY_ENV_RE = /^[A-Z_][A-Z0-9_]*$/;
const HARNESSES = ["claude", "codex", "opencode"];

function normalizeServer(server) {
  if (typeof server !== "string" || !/^https?:\/\//.test(server)) {
    throw new Error("server must be an http(s):// URL");
  }
  let u;
  try {
    u = new URL(server);
  } catch {
    throw new Error("server must be a valid http(s):// URL");
  }
  if (u.username || u.password || server.includes("?") || server.includes("#")) {
    throw new Error("server must be a plain http(s):// URL without credentials, query or fragment");
  }
  return server.replace(/\/+$/, "");
}

function checkKeyEnv(keyEnv) {
  if (typeof keyEnv !== "string" || !KEY_ENV_RE.test(keyEnv)) {
    throw new Error(`keyEnv must match ${KEY_ENV_RE} (an environment variable name, not the key itself)`);
  }
  return keyEnv;
}

export function readRepoConfig(repoDir) {
  let text;
  try {
    text = fs.readFileSync(path.join(repoDir, CONFIG_FILE), "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
  const cfg = JSON.parse(text);
  if (!cfg || cfg.version !== 1) throw new Error("unsupported .screen-spec.json version");
  if (typeof cfg.keyEnv !== "string" || !KEY_ENV_RE.test(cfg.keyEnv)) {
    throw new Error(`invalid .screen-spec.json: keyEnv must match ${KEY_ENV_RE}`);
  }
  try {
    normalizeServer(cfg.server);
  } catch {
    throw new Error("invalid .screen-spec.json: server must be an http(s):// URL");
  }
  if (!Array.isArray(cfg.projects) || cfg.projects.length === 0 || cfg.projects.some((p) => typeof p !== "string" || !p.trim())) {
    throw new Error("invalid .screen-spec.json: projects must be a non-empty list of project ids");
  }
  return cfg;
}

export function writeRepoConfig(repoDir, { server, keyEnv = DEFAULT_KEY_ENV, projects }) {
  const url = normalizeServer(server);
  checkKeyEnv(keyEnv);
  if (!Array.isArray(projects) || projects.length === 0 || projects.some((p) => typeof p !== "string" || !p.trim())) {
    throw new Error("projects must be a non-empty list of project ids");
  }
  const cfg = { version: 1, server: url, keyEnv, projects };
  fs.writeFileSync(path.join(repoDir, CONFIG_FILE), JSON.stringify(cfg, null, 2) + "\n");
  return cfg;
}

function entries(mcpUrl, keyEnv) {
  return {
    claude: { type: "http", url: mcpUrl, headers: { Authorization: `Bearer \${${keyEnv}:-}` } },
    opencode: { type: "remote", url: mcpUrl, enabled: true, headers: { Authorization: `Bearer {env:${keyEnv}}` } },
  };
}

function tomlBlock(mcpUrl, keyEnv) {
  return `[mcp_servers.${SERVER_NAME}]\nurl = ${JSON.stringify(mcpUrl)}\nbearer_token_env_var = ${JSON.stringify(keyEnv)}\n`;
}

// Merge our entry into a JSON file under `key`. Returns "written" | "unchanged" | skipped info.
function mergeJson(file, key, entry) {
  let doc = {};
  let existed = true;
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    existed = false;
  }
  if (existed && raw.trim() !== "") {
    try {
      doc = JSON.parse(raw);
    } catch {
      return { skip: "not plain JSON (comments or syntax error); left untouched" };
    }
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      return { skip: "top level is not a JSON object; left untouched" };
    }
  }
  if (doc[key] !== undefined && (doc[key] === null || typeof doc[key] !== "object" || Array.isArray(doc[key]))) {
    return { skip: `"${key}" is not an object; left untouched` };
  }
  doc[key] = { ...(doc[key] ?? {}), [SERVER_NAME]: entry };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  return {};
}

const PLAIN_HEADER = new RegExp(`^\\[mcp_servers\\.${SERVER_NAME}\\][ \\t]*(#.*)?\\r?$`, "m");

// Structural guard: rewrite only when the file defines spec-tool solely through the plain
// header. A root-level `mcp_servers = ...` key, or the whole-key token spec-tool on any other
// line (quoted header, subtable, inline/dotted key), makes the file ours-to-leave-alone.
const SPEC_TOOL_TOKEN = new RegExp(`(^|[."'\\s\\[{])${SERVER_NAME}($|[."'\\s\\]=])`);
function hasUnsupportedToml(text) {
  const lines = text.split("\n");
  if (lines.filter((l) => PLAIN_HEADER.test(l)).length > 1) return true;
  return lines.some((line) => {
    if (/^\s*#/.test(line) || PLAIN_HEADER.test(line)) return false;
    return /^\s*["']?mcp_servers["']?\s*(=|\.)/.test(line) || SPEC_TOOL_TOKEN.test(line);
  });
}

// Returns { skip } if the file must be left alone, else { changed }.
function mergeToml(file, block) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (hasUnsupportedToml(text)) {
    return { skip: "spec-tool is already defined in a form this script does not rewrite; left untouched" };
  }
  const m = PLAIN_HEADER.exec(text);
  let next;
  if (m) {
    const bodyStart = m.index + m[0].length;
    const nh = /\n\[/.exec(text.slice(bodyStart));
    const end = nh ? bodyStart + nh.index + 1 : text.length;
    // The section ends after its last key line; blank lines and comments that precede the
    // next header belong to what follows and are kept.
    let cut = bodyStart;
    for (const line of text.slice(bodyStart, end).matchAll(/\n([^\n]*)/g)) {
      if (line[1].trim() !== "" && !/^\s*#/.test(line[1])) cut = bodyStart + line.index + line[0].length;
    }
    next = text.slice(0, m.index) + block + text.slice(cut + 1);
  } else if (text.trim() === "") {
    next = block;
  } else {
    next = text.replace(/\s*$/, "\n\n") + block;
  }
  if (next === text) return { changed: false };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return { changed: true };
}

export function writeMcpConfigs(repoDir, { server, keyEnv = DEFAULT_KEY_ENV, harnesses }) {
  const mcpUrl = normalizeServer(server) + "/api/mcp";
  checkKeyEnv(keyEnv);
  if (!Array.isArray(harnesses) || harnesses.some((h) => !HARNESSES.includes(h))) {
    throw new Error(`harnesses must be a list of: ${HARNESSES.join(", ")}`);
  }
  const e = entries(mcpUrl, keyEnv);
  const written = [];
  const skipped = [];
  for (const h of harnesses) {
    if (h === "codex") {
      const block = tomlBlock(mcpUrl, keyEnv);
      const r = mergeToml(path.join(repoDir, ".codex", "config.toml"), block);
      if (r.skip) skipped.push({ file: ".codex/config.toml", reason: r.skip, snippet: block });
      else if (r.changed) written.push(".codex/config.toml");
      continue;
    }
    const [file, key] = h === "claude" ? [".mcp.json", "mcpServers"] : ["opencode.json", "mcp"];
    const r = mergeJson(path.join(repoDir, file), key, e[h]);
    if (r.skip) {
      skipped.push({
        file,
        reason: r.skip,
        snippet: JSON.stringify({ [key]: { [SERVER_NAME]: e[h] } }, null, 2),
      });
    } else {
      written.push(file);
    }
  }
  return { written, skipped };
}

function isMain() {
  try {
    return fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const out = { projects: [], harness: "claude" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--server") out.server = val();
    else if (a === "--project") out.projects.push(val());
    else if (a === "--key-env") out.keyEnv = val();
    else if (a === "--harness") out.harness = val();
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd !== "init") {
    throw new Error("usage: config.mjs init --server <url> --project <id> [--project <id>...] [--key-env NAME] [--harness claude,codex,opencode]");
  }
  const a = parseArgs(rest);
  const keyEnv = a.keyEnv ?? DEFAULT_KEY_ENV;
  const harnesses = a.harness.split(",").map((s) => s.trim()).filter(Boolean);
  // Validate everything before writing anything.
  normalizeServer(a.server);
  checkKeyEnv(keyEnv);
  if (a.projects.length === 0) throw new Error("projects must be a non-empty list of project ids");
  if (harnesses.some((h) => !HARNESSES.includes(h))) {
    throw new Error(`harnesses must be a list of: ${HARNESSES.join(", ")}`);
  }
  const repoDir = process.cwd();
  writeRepoConfig(repoDir, { server: a.server, keyEnv, projects: a.projects });
  const r = writeMcpConfigs(repoDir, { server: a.server, keyEnv, harnesses });
  console.log(`written: ${CONFIG_FILE}`);
  for (const f of r.written) console.log(`written: ${f}`);
  for (const s of r.skipped) {
    console.log(`skipped: ${s.file} (${s.reason}). Add this yourself:\n${s.snippet}`);
  }
  console.log(`export ${keyEnv}=<paste key from Settings → API Keys>`);
}

if (isMain()) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
