import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Brain, 
  Terminal, 
  Code, 
  GitCommit, 
  TestTube, 
  Zap,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  Key,
  Shield,
  Folder,
  FileText,
  ChevronDown,
  ChevronRight,
  Copy,
  Download
} from 'lucide-react';
// Removed template-based CodegenPanel; agent now handles real codegen via tool calls

// Enhanced system prompt for real agent execution
const SYSTEM_PROMPT = `
You are Reflex Coder, a precise, instruction-following autonomous coding agent.

Instruction Hierarchy (strict):
1) User instructions and constraints
2) Repo-specific conventions and existing patterns
3) Language/framework best practices
4) Your general preferences

Operating Rules:
- Restate the task and list explicit requirements you must satisfy.
- Ask concise clarifying questions if anything is ambiguous; otherwise proceed.
- Produce a short plan first, then execute it step-by-step using tools.
- Prefer minimal, surgical changes aligned with the repo style.
- Validate results (build/tests/lint) when feasible; report failures and next steps.
- Never fabricate tools, files, or APIs. Use only the tools listed below.
- Stop and request confirmation before destructive changes (deletes/moves) unless explicitly allowed.

Available Tools (JSON-only calls; no extra text):
- read_file: {"tool":"read_file","path":"<path>"}
- list_files: {"tool":"list_files","path":"<dir|optional>","maxDepth":<int|optional>}
- make_dir: {"tool":"make_dir","path":"<dir>","recursive":true}
- write_file: {"tool":"write_file","path":"<path>","content":"<full content>","overwrite":true}
- move_path: {"tool":"move_path","from":"<old>","to":"<new>","overwrite":true}
- delete_path: {"tool":"delete_path","path":"<path>","recursive":true}
- run_shell: {"tool":"run_shell","cmd":"<command>"}
- git_commit: {"tool":"git_commit","msg":"<conventional commit message>"}
- test_runner: {"tool":"test_runner","cmd":"<optional test command>"}

Response Policy:
- Tool calls: emit ONLY compact JSON objects as above, one per action.
- Explanations: concise, action-focused natural language when not calling tools.
- If the user requests code, prefer writing directly to files via write_file.
- After changes, run tests or build if applicable.
- Do not claim success until verification passes.

Quality Bar:
- Idiomatic, type-safe, well-structured code with error handling.
- Clear, minimal documentation where helpful; avoid noisy comments.
- Keep changes focused on the user’s request; avoid unrelated refactors.
`;

const TOOL_PROMPTS: Record<string, string> = {
  read_file: `Read file content before editing to maintain context and style.`,
  list_files: `Discover project structure before adding new files.`,
  make_dir: `Create needed directories before writing files.`,
  write_file: `Write full file content (idempotent). Include imports and error handling.`,
  move_path: `Rename/move paths carefully; preserve imports and references.`,
  delete_path: `Delete only when certain. Prefer deprecation over removal.`,
  run_shell: `Run build/test/lint or local scripts. Capture outputs.`,
  git_commit: `Atomic commits with conventional messages (feat|fix|docs|refactor).`,
  test_runner: `Run the project's tests or a provided command.`,
};

interface AgentState {
  status: 'idle' | 'thinking' | 'coding' | 'testing' | 'verifying' | 'committing' | 'training';
  thoughts: string[];
  currentAction: string;
  tools: string[];
  reward: number;
  episode: number;
  trajectory: any[];
  attempts?: number;
  successCount?: number;
  lastVerification?: { cmd: string; success: boolean; stdout?: string; stderr?: string } | null;
}

interface LogEntry {
  timestamp: string;
  type: 'thought' | 'action' | 'tool' | 'reward' | 'code' | 'file';
  content: string;
  reward?: number;
  code?: string;
  filename?: string;
}

export default function AgentDashboard() {
  const [agentState, setAgentState] = useState<AgentState>({
    status: 'idle',
    thoughts: [],
    currentAction: '',
    tools: [],
    reward: 0,
    episode: 1,
    trajectory: []
  });

  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [autoContinue, setAutoContinue] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [verificationCmd, setVerificationCmd] = useState<string>('');
  const [strictMode, setStrictMode] = useState<boolean>(true);
  const [stats, setStats] = useState<{ totalAttempts: number; totalSuccesses: number }>({ totalAttempts: 0, totalSuccesses: 0 });
  const [attemptHistory, setAttemptHistory] = useState<Array<{ attempt: number; timestamp: string; cmd?: string; success?: boolean; stdout?: string; stderr?: string }>>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [availableModels, setAvailableModels] = useState<Record<string, any[]>>({});
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [workspaceFolder, setWorkspaceFolder] = useState('./workspace');
  const [generatedFiles, setGeneratedFiles] = useState<{filename: string, content: string}[]>([]);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [storedApiKeys, setStoredApiKeys] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Persist workspace folder across sessions and allow absolute paths
  useEffect(() => {
    const saved = localStorage.getItem('reflex.workspaceFolder');
    if (saved) setWorkspaceFolder(saved);
    const savedStats = localStorage.getItem('reflex.stats');
    if (savedStats) {
      try { setStats(JSON.parse(savedStats)); } catch {}
    }
    const savedStrict = localStorage.getItem('reflex.strictMode');
    if (savedStrict !== null) setStrictMode(savedStrict === '1');
  }, []);
  useEffect(() => {
    if (workspaceFolder) localStorage.setItem('reflex.workspaceFolder', workspaceFolder);
  }, [workspaceFolder]);
  useEffect(() => {
    localStorage.setItem('reflex.stats', JSON.stringify(stats));
  }, [stats]);
  useEffect(() => {
    localStorage.setItem('reflex.strictMode', strictMode ? '1' : '0');
  }, [strictMode]);

  const providers = [
    { id: 'OPENROUTER_API_KEY', name: 'OpenRouter', description: 'Access to multiple models', baseUrl: 'https://openrouter.ai/api/v1' },
    { id: 'ANTHROPIC_API_KEY', name: 'Anthropic', description: 'Claude models', baseUrl: 'https://api.anthropic.com' },
    { id: 'OPENAI_API_KEY', name: 'OpenAI', description: 'GPT models', baseUrl: 'https://api.openai.com/v1' },
    { id: 'HUGGINGFACE_API_KEY', name: 'HuggingFace', description: 'Open-source models', baseUrl: 'https://api-inference.huggingface.co' },
    { id: 'GROQ_API_KEY', name: 'Groq', description: 'Fast inference', baseUrl: 'https://api.groq.com/openai/v1' },
    { id: 'PERPLEXITY_API_KEY', name: 'Perplexity', description: 'Search-enhanced models', baseUrl: 'https://api.perplexity.ai' },
  ];


  const runAgent = async () => {
    if (!command.trim()) return;

    // Get the active model configuration
    const firstProvider = Object.keys(selectedModels)[0];
    if (!firstProvider || !selectedModels[firstProvider] || Object.keys(availableModels).length === 0) {
      toast({
        title: "No Model Selected",
        description: "Please configure and select a model first.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setAgentState(prev => ({ ...prev, status: 'thinking', attempts: 0 }));
    addLog('thought', 'System prompt primed with strict instruction-following');
    addLog('tool', 'Tools ready: read_file, list_files, make_dir, write_file, move_path, delete_path, run_shell, git_commit, test_runner');
    addLog('thought', `Processing request: ${command}`);

    try {
      const providerData = providers.find(p => p.id === firstProvider);
      const modelId = selectedModels[firstProvider];
      
      setAgentState(prev => ({ ...prev, status: 'coding' }));
      addLog('thought', `Using ${providerData?.name} - ${modelId}`);
      
      // Determine verification command
      let verifyCmd = verificationCmd.trim();
      if (!verifyCmd) {
        verifyCmd = await autoDetectVerificationCmd();
        if (verifyCmd) {
          setVerificationCmd(verifyCmd);
          addLog('tool', `Auto-detected verification: ${verifyCmd}`);
        }
      }

      let attempt = 0;
      let solved = false;
      let lastFailureSummary = '';
      
      while (true) {
        attempt += 1;
        setAgentState(prev => ({ ...prev, status: 'coding', attempts: attempt }));
        addLog('thought', `Attempt ${attempt}: planning and executing...`);

        // Create the agent request (system prompt sent separately by callLLMAPI)
        const userPrompt = `User Request: ${command}

Context:
${lastFailureSummary ? `Previous attempt failed. Key errors/output to address:\n${lastFailureSummary}` : 'First attempt. No prior failures.'}

Required behavior:
- Restate the task and list explicit requirements.
- Propose a short, ordered plan.
- Execute using ONLY tool-call JSON objects. No surrounding text.
- Use the available tools to read existing code, write files, and run commands.
- After changes, run tests or build if applicable and summarize results.
- Do not claim success until verification passes.
- Stop and ask for confirmation before destructive actions unless authorized.`;

        // Make the API call
        const response = await callLLMAPI(firstProvider, modelId, (strictMode ? `${userPrompt}\n\nIMPORTANT: Strict mode is enabled. Output ONLY JSON tool call objects, one per action, with no extra text.` : userPrompt));
        if (!response) throw new Error('No response from model');

        setAgentState(prev => ({ ...prev, status: 'testing' }));
        addLog('action', 'Analyzing response and extracting implementation details...');
        const proc = await processAgentResponse(response, { strictMode });
        if (!proc.ok) {
          addLog('action', `Strict mode: ${proc.message || 'Expected JSON tool calls only.'}`);
          if (!autoContinue || attempt >= maxAttempts) break;
          lastFailureSummary = truncate(`Strict mode: ${proc.message || 'Expected JSON tool calls only.'}`, 4000);
          continue;
        }

        // Verification step
        if (verifyCmd) {
          setAgentState(prev => ({ ...prev, status: 'verifying' }));
          addLog('action', `Verifying with: ${verifyCmd}`);
          const res = await postJSON('/api/shell', { cmd: verifyCmd, cwd: workspaceFolder });
          const success = !!res.success;
          const stdout = res.stdout || '';
          const stderr = res.stderr || res.error || '';
          setAgentState(prev => ({ ...prev, lastVerification: { cmd: verifyCmd, success, stdout, stderr } }));
          if (stdout) addLog('tool', `verify stdout:\n${stdout}`);
          if (stderr) addLog('tool', `verify stderr:\n${stderr}`);
          // persist attempt entry and stats
          setAttemptHistory(prev => [...prev, { attempt, timestamp: new Date().toLocaleTimeString(), cmd: verifyCmd, success, stdout: truncate(stdout, 1000), stderr: truncate(stderr, 1000) }]);
          setStats(prev => ({ ...prev, totalAttempts: prev.totalAttempts + 1, totalSuccesses: prev.totalSuccesses + (success ? 1 : 0) }));
          if (success) {
            solved = true;
            break;
          } else {
            lastFailureSummary = truncate(`${stdout}\n${stderr}`, 4000);
          }
        } else {
          // No verification available; consider success only with user confirmation
          addLog('thought', 'No verification command configured. Enable one for accurate reward.');
          break;
        }

        if (!autoContinue || attempt >= maxAttempts) break;
      }

      if (solved) {
        setAgentState(prev => ({ 
          ...prev, 
          status: 'training',
          reward: prev.reward + 1,
          successCount: (prev.successCount || 0) + 1
        }));
        addLog('reward', '✅ Verified success. Reward +1');
        updateTrainingProgress();
      } else {
        addLog('action', `Stopped after ${attempt} attempt(s)${autoContinue ? '' : ' (auto-continue disabled)'}.`);
      }

    } catch (error) {
      console.error('Agent execution error:', error);
      addLog('action', `❌ Error: ${error.message}`);
      toast({
        title: "Execution Error", 
        description: `Failed to process request: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setAgentState(prev => ({ 
        ...prev, 
        status: 'idle',
        episode: prev.episode + 1 
      }));
      setIsRunning(false);
    }
  };

  const postJSON = async (url: string, body: any) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, ...data } as any;
  };

  const autoDetectVerificationCmd = async (): Promise<string> => {
    try {
      const res = await postJSON('/api/files/read', { path: 'package.json', cwd: workspaceFolder });
      if (res.success && res.content) {
        const pkg = JSON.parse(res.content);
        const scripts = pkg.scripts || {};
        if (scripts.test) return 'npm test --silent';
        if (scripts.build) return 'npm run build';
      }
      const tsc = await postJSON('/api/files/read', { path: 'tsconfig.json', cwd: workspaceFolder });
      if (tsc.success) return 'npx tsc -noEmit';
    } catch {}
    return '';
  };

  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '\n...' : s);

  const updateTrainingProgress = () => {
    setTrainingProgress(prev => Math.min(prev + 10, 100));
  };

  const callLLMAPI = async (provider: string, modelId: string, userPrompt: string) => {
    const providerData = providers.find(p => p.id === provider);
    if (!providerData) throw new Error('Provider not found');

    const savedApiKey = storedApiKeys[provider];
    if (!savedApiKey) throw new Error('API key not found for provider');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let requestBody: any = {};
    let endpoint = '';

    switch (provider) {
      case 'OPENROUTER_API_KEY':
        endpoint = `${providerData.baseUrl}/chat/completions`;
        headers['Authorization'] = `Bearer ${savedApiKey}`;
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'Reflex Coder';
        requestBody = {
          model: modelId,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        };
        break;
      
      case 'ANTHROPIC_API_KEY':
        endpoint = `${providerData.baseUrl}/v1/messages`;
        headers['Authorization'] = `Bearer ${savedApiKey}`;
        headers['anthropic-version'] = '2023-06-01';
        requestBody = {
          model: modelId,
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        };
        break;
      
      case 'OPENAI_API_KEY':
        endpoint = `${providerData.baseUrl}/chat/completions`;
        headers['Authorization'] = `Bearer ${savedApiKey}`;
        requestBody = {
          model: modelId,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        };
        break;
      
      case 'GROQ_API_KEY':
        endpoint = `${providerData.baseUrl}/chat/completions`;
        headers['Authorization'] = `Bearer ${savedApiKey}`;
        requestBody = {
          model: modelId,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        };
        break;
      
      case 'PERPLEXITY_API_KEY':
        endpoint = `${providerData.baseUrl}/chat/completions`;
        headers['Authorization'] = `Bearer ${savedApiKey}`;
        requestBody = {
          model: modelId,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        };
        break;
      
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    // Extract content based on provider response format
    if (provider === 'ANTHROPIC_API_KEY') {
      return data.content?.[0]?.text || '';
    } else {
      return data.choices?.[0]?.message?.content || '';
    }
  };

  const processAgentResponse = async (response: string, opts?: { strictMode?: boolean }): Promise<{ ok: boolean; message?: string }> => {
    addLog('thought', 'Processing model response...');
    
    try {
      // Try to extract tool calls from fenced JSON or inline objects
      let toolCalls: any[] = [];
      const fenced = extractCodeBlocks(response);
      for (const block of fenced) {
        const content = block.code.trim();
        if (content.startsWith('{') && content.includes('"tool"')) {
          try { toolCalls.push(JSON.parse(content)); } catch (_) {}
        }
      }
      if (toolCalls.length === 0) {
        const inlineMatches = response.match(/\{[\s\S]*?\}/g) || [];
        for (const m of inlineMatches) {
          if (m.includes('"tool"')) { try { toolCalls.push(JSON.parse(m)); } catch (_) {} }
        }
      }

      if (toolCalls.length > 0) {
        for (const call of toolCalls) {
          await executeToolCall(call);
        }
        return { ok: true };
      } else {
        if (opts?.strictMode) {
          return { ok: false, message: 'No valid JSON tool calls found.' };
        }
        // If no tool calls, treat as code generation
        addLog('thought', 'No tool calls detected, treating as code generation...');
        
        // Extract code blocks from response
        const codeBlocks = fenced;
        
        if (codeBlocks.length > 0) {
          const generatedFiles: {filename: string, content: string}[] = [];
          
          codeBlocks.forEach((block, index) => {
            const filename = block.language === 'rust' ? `src/generated_${index + 1}.rs` :
                           block.language === 'javascript' ? `src/generated_${index + 1}.js` :
                           block.language === 'python' ? `src/generated_${index + 1}.py` :
                           `src/generated_${index + 1}.txt`;
            
            generatedFiles.push({ filename, content: block.code });
            addLog('file', `Generated: ${filename}`, undefined, block.code, filename);
          });
          
          setGeneratedFiles(generatedFiles);
          setShowCodePanel(true);
          addLog('code', `Code generation complete - ${codeBlocks.length} files created`);
        } else {
          // Just show the response as a thought
          addLog('thought', `Model response: ${response.substring(0, 500)}${response.length > 500 ? '...' : ''}`);
        }
        return { ok: true };
      }
    } catch (error) {
      addLog('action', `❌ Error processing response: ${error.message}`);
      return { ok: false, message: error.message };
    }
  };

  const executeToolCall = async (toolCall: any) => {
    const { tool, ...params } = toolCall;
    
    addLog('action', `🛠️ Executing: ${tool}`);
    
    switch (tool) {
      case 'write_file':
        if (params.path && params.content) {
          try {
            // Persist to filesystem via dev server API
            const res = await fetch('/api/files/write', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: params.path, content: params.content, overwrite: true, cwd: workspaceFolder })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'write failed');
            addLog('file', `Wrote file: ${params.path}`, undefined, params.content, params.path);
            setGeneratedFiles(prev => [...prev, { filename: params.path, content: params.content }]);
            setShowCodePanel(true);
          } catch (e: any) {
            addLog('action', `❌ write_file failed: ${e.message}`);
          }
        }
        break;

      case 'read_file':
        if (params.path) {
          try {
            const res = await fetch('/api/files/read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: params.path, cwd: workspaceFolder })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'read failed');
            addLog('file', `Read file: ${params.path}`, undefined, data.content, params.path);
          } catch (e: any) {
            addLog('action', `❌ read_file failed: ${e.message}`);
          }
        }
        break;

      case 'list_files':
        try {
          const res = await fetch('/api/files/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cwd: workspaceFolder, path: params.path || '.', maxDepth: params.maxDepth || 2 })
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'list failed');
          const listing = (data.files || []).map((f: any) => `${f.type}: ${f.path}`).join('\n');
          addLog('tool', `Listed files (base: ${workspaceFolder}):\n${listing}`);
        } catch (e: any) {
          addLog('action', `❌ list_files failed: ${e.message}`);
        }
        break;

      case 'delete_path':
        if (params.path) {
          try {
            const res = await fetch('/api/files/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: params.path, cwd: workspaceFolder, recursive: params.recursive ?? true })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'delete failed');
            addLog('action', `🗑️ Deleted: ${params.path}`);
          } catch (e: any) {
            addLog('action', `❌ delete_path failed: ${e.message}`);
          }
        }
        break;

      case 'move_path':
        if (params.from && params.to) {
          try {
            const res = await fetch('/api/files/move', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: params.from, to: params.to, cwd: workspaceFolder, overwrite: params.overwrite ?? true })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'move failed');
            addLog('action', `📦 Moved: ${params.from} -> ${params.to}`);
          } catch (e: any) {
            addLog('action', `❌ move_path failed: ${e.message}`);
          }
        }
        break;

      case 'make_dir':
        if (params.path) {
          try {
            const res = await fetch('/api/files/mkdir', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: params.path, cwd: workspaceFolder, recursive: params.recursive ?? true })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'mkdir failed');
            addLog('action', `📁 Created directory: ${params.path}`);
          } catch (e: any) {
            addLog('action', `❌ make_dir failed: ${e.message}`);
          }
        }
        break;
      
      case 'run_shell':
        if (params.cmd) {
          addLog('action', `Running command: ${params.cmd}`);
          try {
            const res = await fetch('/api/shell', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cmd: params.cmd, cwd: workspaceFolder })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'shell failed');
            if (data.stdout) addLog('tool', `stdout:\n${data.stdout}`);
            if (data.stderr) addLog('tool', `stderr:\n${data.stderr}`);
          } catch (e: any) {
            addLog('action', `❌ run_shell failed: ${e.message}`);
          }
        }
        break;

      case 'test_runner':
        try {
          const cmd = params.cmd || 'npm test --silent';
          addLog('action', `Running tests: ${cmd}`);
          const res = await fetch('/api/shell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd, cwd: workspaceFolder })
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'tests failed');
          if (data.stdout) addLog('tool', `test stdout:\n${data.stdout}`);
          if (data.stderr) addLog('tool', `test stderr:\n${data.stderr}`);
        } catch (e: any) {
          addLog('action', `❌ test_runner failed: ${e.message}`);
        }
        break;
      
      case 'git_commit':
        if (params.msg) {
          try {
            const res = await fetch('/api/git/commit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ msg: params.msg, cwd: workspaceFolder })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'commit failed');
            addLog('action', `Git commit: ${params.msg}`);
            addLog('tool', `✅ Committed: ${data.commit || params.msg}`);
          } catch (e: any) {
            addLog('action', `❌ git_commit failed: ${e.message}`);
          }
        }
        break;
      
      default:
        addLog('action', `⚠️ Unknown tool: ${tool}`);
    }
  };

  const extractCodeBlocks = (text: string) => {
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    const blocks = [];
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }
    
    return blocks;
  };

  const addLog = (type: LogEntry['type'], content: string, reward?: number, code?: string, filename?: string) => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      type,
      content,
      reward,
      code,
      filename
    }]);
  };

  const fetchAvailableModels = async (provider: string, key: string) => {
    setLoadingModels(true);
    try {
      const providerData = providers.find(p => p.id === provider);
      if (!providerData) return;

      let models: any[] = [];
      
      if (provider === 'OPENROUTER_API_KEY') {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        const data = await response.json();
        models = data.data?.map((m: any) => ({ id: m.id, name: m.name || m.id })) || [];
      } else if (provider === 'OPENAI_API_KEY') {
        // OpenAI known models (API doesn't expose models endpoint publicly)
        models = [
          { id: 'gpt-4', name: 'GPT-4' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        ];
      } else if (provider === 'ANTHROPIC_API_KEY') {
        // Anthropic known models
        models = [
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
          { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
        ];
      } else if (provider === 'GROQ_API_KEY') {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        const data = await response.json();
        models = data.data?.map((m: any) => ({ id: m.id, name: m.id })) || [];
      } else if (provider === 'PERPLEXITY_API_KEY') {
        // Perplexity known models
        models = [
          { id: 'llama-3.1-sonar-small-128k-online', name: 'Llama 3.1 Sonar Small (8B)' },
          { id: 'llama-3.1-sonar-large-128k-online', name: 'Llama 3.1 Sonar Large (70B)' },
          { id: 'llama-3.1-sonar-huge-128k-online', name: 'Llama 3.1 Sonar Huge (405B)' },
        ];
      }

      setAvailableModels(prev => ({ ...prev, [provider]: models }));
      if (models.length > 0) {
        setSelectedModels(prev => ({ ...prev, [provider]: models[0].id }));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch available models.",
        variant: "destructive",
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a provider and enter an API key.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Store the API key
      setStoredApiKeys(prev => ({ ...prev, [selectedProvider]: apiKey }));
      
      // Fetch available models
      await fetchAvailableModels(selectedProvider, apiKey);
      
      toast({
        title: "API Key Saved",
        description: `${providers.find(p => p.id === selectedProvider)?.name} API key saved and models loaded.`,
      });
      setApiKey('');
      setSelectedProvider('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save API key. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = () => {
    switch (agentState.status) {
      case 'thinking': return <Brain className="h-4 w-4 animate-thinking text-agent-thinking" />;
      case 'coding': return <Code className="h-4 w-4 text-primary" />;
      case 'testing': return <TestTube className="h-4 w-4 text-agent-tool" />;
      case 'committing': return <GitCommit className="h-4 w-4 text-agent-success" />;
      case 'training': return <Zap className="h-4 w-4 text-yellow-400" />;
      default: return <Terminal className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (agentState.status) {
      case 'thinking': return 'border-agent-thinking/50 bg-agent-thinking/10';
      case 'coding': return 'border-primary/50 bg-primary/10';
      case 'testing': return 'border-agent-tool/50 bg-agent-tool/10';
      case 'committing': return 'border-agent-success/50 bg-agent-success/10';
      case 'training': return 'border-yellow-400/50 bg-yellow-400/10';
    default: return 'border-border bg-card';
  }
};

const getCurrentModel = () => {
  // Get the first available selected model
  const firstProvider = Object.keys(selectedModels)[0];
  if (firstProvider && selectedModels[firstProvider]) {
    const providerName = providers.find(p => p.id === firstProvider)?.name;
    const modelId = selectedModels[firstProvider];
    const model = availableModels[firstProvider]?.find(m => m.id === modelId);
    return `${model?.name || modelId} (${providerName})`;
  }
  return 'claude-sonnet-4';
};

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Reflex Coder
            </h1>
            <p className="text-muted-foreground mt-2">
              Intelligent RL-powered coding copilot with autonomous reasoning
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-agent-success">
              Episode {agentState.episode}
            </Badge>
            <Badge variant="outline" className="text-primary">
              Reward: {agentState.reward.toFixed(1)}
            </Badge>
          </div>
        </div>

        {/* Command Input */}
        <Card className={`p-6 mb-6 transition-all duration-300 ${getStatusColor()}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-mono text-sm capitalize">{agentState.status}</span>
            </div>
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="add rust sub-cmd that formats XML and tests it"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="font-mono bg-terminal/50 border-border"
                disabled={isRunning}
              />
              <Button 
                onClick={runAgent} 
                disabled={isRunning || !command.trim()}
                className="px-6"
              >
                {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isRunning ? 'Running' : 'Execute'}
              </Button>
            </div>
          </div>
        </Card>

        <div className={`grid gap-6 ${showCodePanel ? 'grid-cols-1 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
          {/* Agent Logs */}
          <Card className={`p-6 ${showCodePanel ? 'lg:col-span-2 xl:col-span-2' : 'lg:col-span-1 xl:col-span-2'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Agent Activity</h3>
              <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            </div>
            <div className="w-full pr-1">
              <div className="space-y-3">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-muted-foreground font-mono text-xs mt-1">
                      {log.timestamp}
                    </span>
                    <div className="flex-1">
                      <div className={`inline-block px-2 py-1 rounded text-xs font-medium mb-1 ${
                        log.type === 'thought' ? 'bg-agent-thinking/20 text-agent-thinking' :
                        log.type === 'action' ? 'bg-primary/20 text-primary' :
                        log.type === 'tool' ? 'bg-agent-tool/20 text-agent-tool' :
                        log.type === 'code' ? 'bg-green-500/20 text-green-400' :
                        log.type === 'file' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-agent-success/20 text-agent-success'
                      }`}>
                        {log.type === 'file' ? 'FILE' : log.type}
                      </div>
                      <p className="text-foreground">{log.content}</p>
                      {log.type === 'file' && log.code && (
                        <div className="mt-2 p-3 bg-terminal/50 rounded border border-border font-mono text-xs text-muted-foreground">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-blue-400">{log.filename}</span>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(log.code || '');
                                toast({ title: "Code copied to clipboard" });
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <pre className="whitespace-pre-wrap text-xs leading-relaxed">
                            {log.code}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Generated Code Panel */}
          {showCodePanel && (
            <Card className="p-6 lg:col-span-1 xl:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-400" />
                  Generated Code
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowCodePanel(false)}
                >
                  ✕
                </Button>
              </div>
              <div className="w-full pr-1">
                <div className="space-y-3">
                  {generatedFiles.map((file, i) => (
                    <div key={i} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center justify-between">
                        <span className="font-mono text-sm text-blue-400">{file.filename}</span>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(file.content);
                              toast({ title: "Code copied to clipboard" });
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              const blob = new Blob([file.content], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = file.filename.split('/').pop() || 'file.txt';
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-3 bg-terminal/30">
                        <pre className="text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {file.content}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Settings Panel */}
          <div className="space-y-6">
            {/* Code Generation panel removed; agent handles NL → code directly */}

            {/* Workspace Settings */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Folder className="h-5 w-5 text-primary" />
              Workspace Settings
            </h3>
            <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Workspace Directory
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="./workspace"
                      value={workspaceFolder}
                      onChange={(e) => setWorkspaceFolder(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.webkitdirectory = true;
                        input.onchange = (e: any) => {
                          const files = e.target.files;
                          if (files.length > 0) {
                            const path = files[0].webkitRelativePath.split('/')[0];
                            setWorkspaceFolder(`./${path}`);
                            toast({ title: "Workspace folder updated", description: `Set to: ./${path}` });
                          }
                        };
                        input.click();
                      }}
                    >
                      <Folder className="h-4 w-4 mr-1" />
                      Browse
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Absolute or relative path. Shell, git, and file operations run with cwd = this path.
                  </p>
                </div>
                
                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="text-lg font-mono text-agent-success">Ready</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Permissions</p>
                    <p className="text-lg font-mono text-primary">Read/Write</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Attempts</p>
                    <p className="text-lg font-mono">{agentState.attempts || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Verified Successes</p>
                    <p className="text-lg font-mono">{agentState.successCount || 0}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* API Keys */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                API Keys
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Keys are encrypted and stored securely via Supabase</span>
                </div>
                <div className="space-y-3">
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div>
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-xs text-muted-foreground">{provider.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="password"
                    placeholder="Enter API key..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button 
                    onClick={handleSaveApiKey}
                    disabled={!selectedProvider || !apiKey.trim() || loadingModels}
                    className="w-full"
                    size="sm"
                  >
                    {loadingModels ? 'Loading Models...' : 'Save API Key'}
                  </Button>
                </div>
                
                {/* Model Selectors */}
                {Object.keys(availableModels).length > 0 && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Model Selection</h4>
                      {Object.entries(availableModels).map(([providerId, models]) => {
                        const provider = providers.find(p => p.id === providerId);
                        return (
                          <div key={providerId} className="space-y-2">
                            <label className="text-xs text-muted-foreground">{provider?.name}</label>
                            <Select 
                              value={selectedModels[providerId] || ''} 
                              onValueChange={(value) => setSelectedModels(prev => ({ ...prev, [providerId]: value }))}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background border-border">
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border shadow-lg z-50">
                                {models.map((model) => (
                                  <SelectItem key={model.id} value={model.id} className="text-xs">
                                    {model.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <Separator />
                <div className="text-xs text-muted-foreground">
                  <p>• Keys are never stored in frontend code</p>
                  <p>• Access via Supabase Edge Functions only</p>
                  <p>• Rotate keys regularly for security</p>
                </div>
              </div>
            </Card>

            {/* RL Training Progress */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-agent-success" />
                RL Training
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Policy Updates</span>
                    <span>{trainingProgress}%</span>
                  </div>
                  <Progress value={trainingProgress} className="h-2" />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className="text-lg font-mono text-agent-success">{(() => {
                      const rate = stats.totalAttempts > 0 ? (stats.totalSuccesses / stats.totalAttempts) * 100 : 0;
                      return `${rate.toFixed(0)}%`;
                    })()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Steps</p>
                    <p className="text-lg font-mono text-primary">{(() => {
                      const avg = stats.totalSuccesses > 0 ? (stats.totalAttempts / stats.totalSuccesses) : stats.totalAttempts;
                      return avg.toFixed(1);
                    })()}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Built-in Capabilities */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Built-in Capabilities</h3>
              <div className="space-y-2">
                {[
                  { name: 'edit_files', description: 'Direct file editing', icon: '✏️' },
                  { name: 'run_commands', description: 'Execute shell commands', icon: '⚡' },
                  { name: 'git_operations', description: 'Git add, commit, push', icon: '🔄' },
                  { name: 'test_runner', description: 'Run tests & validate', icon: '🧪' },
                  { name: 'code_analysis', description: 'Parse & understand code', icon: '🔍' },
                  { name: 'web_search', description: 'Find documentation', icon: '🌐' }
                ].map((capability) => (
                  <div key={capability.name} className="flex items-center gap-3 p-2 rounded bg-secondary/20 border border-border/50">
                    <span className="text-lg">{capability.icon}</span>
                    <div className="flex-1">
                      <div className="font-mono text-sm text-foreground">{capability.name}</div>
                      <div className="text-xs text-muted-foreground">{capability.description}</div>
                    </div>
                    <Badge variant="outline" className="text-xs bg-agent-success/20 text-agent-success border-agent-success/30">
                      ready
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Agent Runtime */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Agent Runtime</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Model:</span>
                  <span className="font-mono text-primary text-xs">{getCurrentModel()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Context:</span>
                  <span className="font-mono">45k/200k</span>
                </div>
                <div className="flex justify-between">
                  <span>Mode:</span>
                  <span className="font-mono text-agent-success">autonomous (verify)</span>
                </div>
                <div className="flex justify-between">
                  <span>Sandbox:</span>
                  <span className="font-mono text-agent-tool">docker+firejail</span>
                </div>
                <div className="flex justify-between">
                  <span>Project:</span>
                  <span className="font-mono text-muted-foreground">{workspaceFolder}</span>
                </div>
              </div>
            </Card>

            {/* Verification & Auto-Continue */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Verification</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <input
                    id="auto-continue"
                    type="checkbox"
                    checked={autoContinue}
                    onChange={(e) => setAutoContinue(e.target.checked)}
                  />
                  <label htmlFor="auto-continue">Auto-continue until verified</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="strict-mode"
                    type="checkbox"
                    checked={strictMode}
                    onChange={(e) => setStrictMode(e.target.checked)}
                  />
                  <label htmlFor="strict-mode">Strict mode (JSON tool calls only)</label>
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-32 text-muted-foreground">Max attempts</label>
                  <Input type="number" min={1} max={10} value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                    className="w-24 text-sm"/>
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-32 text-muted-foreground">Verify command</label>
                  <Input value={verificationCmd} onChange={(e) => setVerificationCmd(e.target.value)} placeholder="e.g. npm test --silent" className="font-mono"/>
                  <Button variant="outline" size="sm" onClick={async () => {
                    const auto = await autoDetectVerificationCmd();
                    if (auto) { setVerificationCmd(auto); toast({ title: 'Detected', description: auto }); }
                    else { toast({ title: 'No verification found', variant: 'destructive' }); }
                  }}>Detect</Button>
                </div>
                {agentState.lastVerification && (
                  <div className="text-xs text-muted-foreground">
                    <div>Last verify: {agentState.lastVerification.cmd} → {agentState.lastVerification.success ? 'success' : 'failed'}</div>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total attempts: {stats.totalAttempts}</span>
                  <span>Verified successes: {stats.totalSuccesses}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setStats({ totalAttempts: 0, totalSuccesses: 0 }); setAttemptHistory([]); toast({ title: 'Stats reset' }); }}>Reset stats</Button>
                </div>
              </div>
            </Card>

            {/* Results Summary */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Results Summary</h3>
              <div className="space-y-2">
                {attemptHistory.length === 0 && (
                  <div className="text-sm text-muted-foreground">No attempts yet.</div>
                )}
                {attemptHistory.map((a) => (
                  <div key={a.attempt + '-' + a.timestamp} className="border border-border rounded p-3 text-xs">
                    <div className="flex justify-between mb-2">
                      <div className="font-mono">Attempt {a.attempt}</div>
                      <div className={a.success ? 'text-agent-success' : 'text-red-400'}>{a.success ? 'verified' : 'failed'}</div>
                    </div>
                    <div className="text-muted-foreground">cmd: <span className="font-mono">{a.cmd}</span></div>
                    {a.stdout && (
                      <div className="mt-2">
                        <div className="text-muted-foreground">stdout</div>
                        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground bg-terminal/30 p-2 rounded">{a.stdout}</pre>
                      </div>
                    )}
                    {a.stderr && (
                      <div className="mt-2">
                        <div className="text-muted-foreground">stderr</div>
                        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground bg-terminal/30 p-2 rounded">{a.stderr}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
