import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import os from 'os';
import { componentTagger } from "lovable-tagger";
import fs from 'fs/promises';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCb);

// Lightweight API for file IO, shell, and git operations used by the agent
function resolveBaseCwd(cwd?: string) {
  const base = process.cwd();
  if (!cwd || typeof cwd !== 'string') return base;
  // Expand ~ to the user's home directory
  let candidate = cwd.trim();
  if (candidate === '~') candidate = os.homedir();
  else if (candidate.startsWith('~/')) candidate = path.join(os.homedir(), candidate.slice(2));
  // If absolute, path.resolve will return as-is; if relative, resolve against process cwd
  return path.resolve(base, candidate);
}

function registerAgentAPIs(server: any) {
  // Write file
  server.middlewares.use('/api/files/write', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { path: targetPath, content, overwrite, cwd } = JSON.parse(body || '{}');
      if (!targetPath || typeof content !== 'string') throw new Error('path and content required');
      const base = resolveBaseCwd(cwd);
      const full = path.resolve(base, targetPath);
      try {
        await fs.access(full);
        if (!overwrite) throw new Error(`File exists: ${targetPath}`);
      } catch (_) {}
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, path: targetPath }));
    } catch (e: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });

  // Read file
  server.middlewares.use('/api/files/read', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { path: targetPath, cwd } = JSON.parse(body || '{}');
      if (!targetPath) throw new Error('path required');
      const base = resolveBaseCwd(cwd);
      const full = path.resolve(base, targetPath);
      const data = await fs.readFile(full, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, path: targetPath, content: data }));
    } catch (e: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });

  // List files (recursive)
  server.middlewares.use('/api/files/list', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { cwd, path: rel = '.', maxDepth = 3 } = JSON.parse(body || '{}');
      const base = resolveBaseCwd(cwd);
      const root = path.resolve(base, rel);

      async function walk(dir: string, depth: number): Promise<any[]> {
        if (depth < 0) return [] as any[];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const results: any[] = [];
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          const relPath = path.relative(base, full);
          if (ent.isDirectory()) {
            results.push({ type: 'dir', path: relPath });
            results.push(...await walk(full, depth - 1));
          } else if (ent.isFile()) {
            results.push({ type: 'file', path: relPath });
          }
        }
        return results;
      }

      const tree = await walk(root, maxDepth);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, files: tree }));
    } catch (e: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });

  // Delete file or directory
  server.middlewares.use('/api/files/delete', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { path: targetPath, cwd, recursive = true } = JSON.parse(body || '{}');
      if (!targetPath) throw new Error('path required');
      const base = resolveBaseCwd(cwd);
      const full = path.resolve(base, targetPath);
      await fs.rm(full, { recursive, force: true });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    } catch (e: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });

  // Move/rename
  server.middlewares.use('/api/files/move', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { from, to, cwd, overwrite = true } = JSON.parse(body || '{}');
      if (!from || !to) throw new Error('from and to required');
      const base = resolveBaseCwd(cwd);
      const src = path.resolve(base, from);
      const dest = path.resolve(base, to);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      if (overwrite) {
        try { await fs.rm(dest, { force: true, recursive: false }); } catch {}
      }
      await fs.rename(src, dest);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    } catch (e: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });

  // Make directory
  server.middlewares.use('/api/files/mkdir', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { path: targetPath, cwd, recursive = true } = JSON.parse(body || '{}');
      if (!targetPath) throw new Error('path required');
      const base = resolveBaseCwd(cwd);
      const full = path.resolve(base, targetPath);
      await fs.mkdir(full, { recursive });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    } catch (e: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });

  // Run shell command
  server.middlewares.use('/api/shell', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { cmd, cwd } = JSON.parse(body || '{}');
      if (!cmd || typeof cmd !== 'string') throw new Error('cmd required');
      const { stdout, stderr } = await exec(cmd, { cwd: resolveBaseCwd(cwd), env: process.env, maxBuffer: 10 * 1024 * 1024 });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, stdout, stderr }));
    } catch (e: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });

  // Git commit
  server.middlewares.use('/api/git/commit', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { msg, cwd } = JSON.parse(body || '{}');
      if (!msg) throw new Error('msg required');
      const execOpts = { cwd: resolveBaseCwd(cwd), env: process.env, maxBuffer: 10 * 1024 * 1024 } as any;
      await exec('git add -A', execOpts);
      await exec(`git commit -m ${JSON.stringify(msg)}`, execOpts);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, commit: msg }));
    } catch (e: any) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    {
      name: 'agent-api',
      configureServer(server) {
        registerAgentAPIs(server);
      },
      configurePreviewServer(server) {
        registerAgentAPIs(server);
      }
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
