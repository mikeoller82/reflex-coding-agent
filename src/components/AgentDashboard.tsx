import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
  TrendingUp
} from 'lucide-react';

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

  const mockThoughts = [
    "🤔 Analyzing the request: 'add rust sub-cmd that formats XML and tests it'",
    "📋 Breaking down into steps: 1) Create XML formatter 2) Add CLI subcommand 3) Write tests",
    "🔍 Searching codebase for existing CLI structure and XML handling patterns",
    "💡 Planning tool sequence: write_file → run_shell → git_commit"
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Autonomous Coding Agent
            </h1>
            <p className="text-muted-foreground mt-2">
              RL-powered CLI copilot with Tree-of-Thought reasoning
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

          {/* Training Panel */}
          <div className="space-y-6">
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
                  <span className="font-mono text-primary">claude-sonnet-4</span>
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