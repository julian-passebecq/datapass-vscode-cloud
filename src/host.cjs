/** Local, bounded observations. Never reads project file contents or executes project code. */
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const { classifyFile } = require('./core.js');
const EXCLUDED = new Set(['.git','.datapass','.claude','.codex','node_modules','.venv','venv','dist','build','.next','.vscode-test','__pycache__']);
const PROBES = Object.freeze({ node: [['node'], ['--version']], python: [[process.platform === 'win32' ? 'python' : 'python3', 'python'], ['--version']], az: [['az'], ['version']], func: [['func'], ['--version']], fab: [['fab'], ['--version']] });
function within(root, file) {
  const rel = path.relative(root, file);
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`));
}
async function scanFolder(root, revision, limits = {}) {
  const maxEntries = limits.maxEntries ?? 1500, maxFiles = limits.maxFiles ?? 120, maxDepth = limits.maxDepth ?? 6;
  const canonical = await fsp.realpath(root);
  const queue = [{ dir: canonical, depth: 0 }], files = [], notes = [];
  let examined = 0, partial = false;
  outer: while (queue.length) {
    const { dir, depth } = queue.shift();
    try {
      const entries = await fsp.opendir(dir);
      for await (const entry of entries) {
        if (++examined > maxEntries) { partial = true; break outer; }
        if (entry.isSymbolicLink()) { partial = true; continue; }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!EXCLUDED.has(entry.name)) {
            if (depth < maxDepth) queue.push({dir:full, depth:depth + 1}); else partial = true;
          }
        } else if (entry.isFile()) {
          const rel = path.relative(canonical, full).split(path.sep).join('/');
          const kind = classifyFile(rel);
          if (!kind) continue;
          if (files.length >= maxFiles) { partial = true; break outer; }
          files.push({ path: rel, kind });
        }
      }
    } catch { partial = true; notes.push('A folder could not be listed.'); }
  }
  if (partial) notes.push('Bounded scan: limits, skipped links or unreadable folders prevent a completeness claim.');
  const sorted = files.sort((a,b)=>a.path.localeCompare(b.path)).map((f,i)=>({id:`f${revision}-${i}`, ...f}));
  return { files: sorted, scan: partial ? 'partial' : 'complete', scannedAt: new Date().toISOString(), notes: [...new Set(notes)] };
}
async function safeFile(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\0') || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new Error('Invalid file reference.');
  const canonical = await fsp.realpath(root), requested = path.resolve(canonical, relative);
  if (!within(canonical, requested)) throw new Error('File is outside the selected folder.');
  // Reject symlink swaps in both leaf and parent components between scan and open.
  let current = canonical;
  for (const segment of path.relative(canonical, requested).split(path.sep)) {
    current = path.join(current, segment);
    if ((await fsp.lstat(current)).isSymbolicLink()) throw new Error('Symbolic links are not opened by Cloud Studio.');
  }
  const real = await fsp.realpath(requested);
  if (!within(canonical, real) || !(await fsp.stat(real)).isFile()) throw new Error('File is not a regular file in this folder.');
  if ((await fsp.stat(real)).size > 2 * 1024 * 1024) throw new Error('This file exceeds the 2 MiB source-view limit. Open it manually with its native tool.');
  return real;
}
function absoluteEntries(raw, platform = process.platform) {
  const parser = platform === 'win32' ? path.win32 : path.posix;
  return String(raw ?? '').split(platform === 'win32' ? ';' : ':').map(s=>s.trim().replace(/^"(.*)"$/, '$1'))
    .filter(s=>parser.isAbsolute(s) && !(platform === 'win32' && /^[/\\](?![/\\])/.test(s)));
}
async function resolveProbe(id, excludedRoots = [], env = process.env) {
  const def = PROBES[id]; if (!def) return undefined;
  const roots = await Promise.all(excludedRoots.map(r=>fsp.realpath(r).catch(()=>path.resolve(r))));
  for (const name of def[0]) for (const dir of absoluteEntries(env.PATH ?? env.Path)) {
    const executable = path.join(dir, name + (process.platform === 'win32' ? '.exe' : ''));
    try {
      const real = await fsp.realpath(executable);
      if (roots.some(r=>within(r,real)) || !(await fsp.stat(real)).isFile()) continue;
      await fsp.access(real, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
      return { executable: real, args: def[1] };
    } catch { /* keep searching absolute PATH entries */ }
  }
  return undefined;
}
async function probeVersion(id, trusted, roots = [], deps = {}) {
  const at = new Date().toISOString();
  if (!trusted) return { state:'unknown', detail:'Restricted Mode: CLI probes disabled.', at };
  if (!PROBES[id]) return { state:'unknown', detail:'No executable probe is registered.', at };
  const resolve = deps.resolve ?? resolveProbe, run = deps.run ?? cp.execFile;
  const def = await resolve(id, roots);
  if (!def) return { state:'not-detected', detail:'No supported executable on absolute PATH outside project folders. Windows .cmd shims are not executed.', at };
  return new Promise(resolveResult=>run(def.executable, def.args, {
    cwd:os.homedir(), shell:false, timeout:3500, maxBuffer:16384, windowsHide:true,
    env:{...process.env, NODE_OPTIONS:'', PYTHONPATH:'', PYTHONSTARTUP:''}
  }, (error, stdout, stderr)=>{
    if (error) { resolveResult({state:'failed', detail:error.killed ? 'Version probe timed out.' : 'Version probe failed; no authentication or runtime conclusion.', at}); return; }
    const raw = `${stdout}\n${stderr}`;
    const version = id === 'az' ? /"azure-cli"\s*:\s*"([0-9.]+)"/.exec(raw)?.[1] : /(?:^|[^\w.])v?(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)(?![\w.])/.exec(raw)?.[1];
    resolveResult(version ? {state:'detected',version,detail:'Version command succeeded; account, dependencies and operation are unverified.',at}
      : {state:'unknown', detail:'Command returned successfully but its version was not recognized.',at});
  }));
}
module.exports = { within, scanFolder, safeFile, absoluteEntries, resolveProbe, probeVersion };
