import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from 'fs/promises';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCb);

// Lightweight API for file IO, shell, and git operations used by the agent
function registerAgentAPIs(server: any) {
  // Write file
  server.middlewares.use('/api/files/write', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { path: targetPath, content, overwrite } = JSON.parse(body || '{}');
      if (!targetPath || typeof content !== 'string') throw new Error('path and content required');
      const full = path.resolve(process.cwd(), targetPath);
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

  // Run shell command
  server.middlewares.use('/api/shell', async (req: any, res: any) => {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { cmd, cwd } = JSON.parse(body || '{}');
      if (!cmd || typeof cmd !== 'string') throw new Error('cmd required');
      const { stdout, stderr } = await exec(cmd, { cwd: cwd ? path.resolve(process.cwd(), cwd) : process.cwd(), env: process.env, maxBuffer: 10 * 1024 * 1024 });
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
      const { msg } = JSON.parse(body || '{}');
      if (!msg) throw new Error('msg required');
      await exec('git add -A');
      await exec(`git commit -m ${JSON.stringify(msg)}`);
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
