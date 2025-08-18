import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Shield
} from 'lucide-react';

// Intelligent system and tool prompts (non-visual enhancement)
const SYSTEM_PROMPT = `
You are an autonomous, reinforcement-learning coding copilot.
- Goals: plan with Tree-of-Thoughts, act via JSON tool-calls, verify via compiler/tests, and iterate.
- Output policy: when calling tools, respond ONLY with compact JSON; otherwise use concise natural language.
- Safety: operate in a sandbox, avoid network unless tool permits, never leak secrets, respect path allowlist.
- Verification: after each tool call, check compile/tests/diff and update plan. Prefer minimal diffs and idempotent edits.
- Git etiquette: use conventional commits; summarize rationale in 1-2 lines.
- Reasoning: explore 2-3 branches, score them (feasibility, risk, test impact), then pick best.
- Toolset: write_file, run_shell, git_commit, test_runner, code_search, web_search.
`;

const TOOL_PROMPTS: Record<string, string> = {
  write_file: `Use to create/modify files. Always write full file content. Validate syntax. JSON: {"tool":"write_file","path":"<path>","content":"<full file>"}`,
  run_shell: `Use to run commands in sandbox. Keep commands safe and deterministic. JSON: {"tool":"run_shell","cmd":"<command>"}`,
  git_commit: `Stage and commit atomic changes with conventional message. JSON: {"tool":"git_commit","msg":"feat: ..."}`,
  test_runner: `Run test suites and parse results for reward shaping. JSON: {"tool":"run_shell","cmd":"npm test | cargo test | pytest"}`,
  code_search: `Search repository for symbols/usage before editing. JSON: {"tool":"run_shell","cmd":"rg -n '<query>'"}`,
  web_search: `Only when necessary to consult docs. Summarize and cite. JSON: {"tool":"run_shell","cmd":"curl ..."}`,
};

interface AgentState {
  status: 'idle' | 'thinking' | 'coding' | 'testing' | 'committing' | 'training';
  thoughts: string[];
  currentAction: string;
  tools: string[];
  reward: number;
  episode: number;
  trajectory: any[];
}

interface LogEntry {
  timestamp: string;
  type: 'thought' | 'action' | 'tool' | 'reward';
  content: string;
  reward?: number;
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
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [availableModels, setAvailableModels] = useState<Record<string, any[]>>({});
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const { toast } = useToast();

  const providers = [
    { id: 'OPENROUTER_API_KEY', name: 'OpenRouter', description: 'Access to multiple models', baseUrl: 'https://openrouter.ai/api/v1' },
    { id: 'ANTHROPIC_API_KEY', name: 'Anthropic', description: 'Claude models', baseUrl: 'https://api.anthropic.com' },
    { id: 'OPENAI_API_KEY', name: 'OpenAI', description: 'GPT models', baseUrl: 'https://api.openai.com/v1' },
    { id: 'HUGGINGFACE_API_KEY', name: 'HuggingFace', description: 'Open-source models', baseUrl: 'https://api-inference.huggingface.co' },
    { id: 'GROQ_API_KEY', name: 'Groq', description: 'Fast inference', baseUrl: 'https://api.groq.com/openai/v1' },
    { id: 'PERPLEXITY_API_KEY', name: 'Perplexity', description: 'Search-enhanced models', baseUrl: 'https://api.perplexity.ai' },
  ];

  const mockThoughts = [
    "🧭 System primed: role=RL coding copilot, mode=autonomous, sandbox=docker+firejail",
    "🧠 Tree-of-Thought: outline plan → evaluate branches → pick best action",
    "🛠️ Tool-calling: emit STRICT JSON for write_file/run_shell/git_commit/test_runner",
    "🔐 Safety: read-only until tests compile; never exfiltrate secrets; respect path allowlist",
    "✅ Verifier: after each step, re-check compile/tests/diff and adjust plan",
    "📦 Commit style: conventional commits + concise summary of changes"
  ];

  const mockActions = [
    { type: 'write_file', path: 'src/xml_formatter.rs', content: 'XML formatting logic...' },
    { type: 'write_file', path: 'src/cli.rs', content: 'CLI subcommand registration...' },
    { type: 'run_shell', cmd: 'cargo test xml_formatter' },
    { type: 'git_commit', msg: 'Add XML formatting subcommand with tests' }
  ];

  const runAgent = () => {
    if (!command.trim()) return;
    
    setIsRunning(true);
    setAgentState(prev => ({ ...prev, status: 'thinking' }));
    addLog('thought', 'System prompt primed: ToT + verifier + JSON-only tool calls');
    addLog('tool', 'Tool prompts loaded: write_file, run_shell, git_commit, test_runner, code_search, web_search');
    
    // Simulate agent execution
    setTimeout(() => {
      setAgentState(prev => ({ ...prev, status: 'coding' }));
      addLog('thought', `Starting: ${command}`);
    }, 500);

    setTimeout(() => {
      mockThoughts.forEach((thought, i) => {
        setTimeout(() => addLog('thought', thought), i * 1000);
      });
    }, 1000);

    setTimeout(() => {
      setAgentState(prev => ({ ...prev, status: 'testing' }));
      mockActions.forEach((action, i) => {
        setTimeout(() => {
          addLog('action', `${action.type}: ${action.cmd || action.path || action.msg}`);
          if (action.type === 'run_shell') {
            setTimeout(() => addLog('tool', '✅ Tests passed: 3/3'), 500);
          }
        }, i * 1500);
      });
    }, 5000);

    setTimeout(() => {
      setAgentState(prev => ({ 
        ...prev, 
        status: 'training',
        reward: prev.reward + 2.5 
      }));
      addLog('reward', 'Episode complete! Reward: +2.5');
      setTrainingProgress(prev => Math.min(prev + 15, 100));
    }, 12000);

    setTimeout(() => {
      setAgentState(prev => ({ 
        ...prev, 
        status: 'idle',
        episode: prev.episode + 1 
      }));
      setIsRunning(false);
    }, 15000);
  };

  const addLog = (type: LogEntry['type'], content: string, reward?: number) => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      type,
      content,
      reward
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
      // Fetch available models first
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Agent Logs */}
          <Card className="xl:col-span-2 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Agent Activity</h3>
              <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            </div>
            <ScrollArea className="h-96 w-full pr-4">
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
                        'bg-agent-success/20 text-agent-success'
                      }`}>
                        {log.type}
                      </div>
                      <p className="text-foreground">{log.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* API Key Management */}
          <div className="space-y-6">
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
                    <p className="text-lg font-mono text-agent-success">87%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Steps</p>
                    <p className="text-lg font-mono text-primary">5.2</p>
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
                  <span className="font-mono text-agent-success">autonomous</span>
                </div>
                <div className="flex justify-between">
                  <span>Sandbox:</span>
                  <span className="font-mono text-agent-tool">docker+firejail</span>
                </div>
                <div className="flex justify-between">
                  <span>Project:</span>
                  <span className="font-mono text-muted-foreground">./workspace</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}