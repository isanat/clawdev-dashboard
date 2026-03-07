'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { 
  Activity, 
  Brain, 
  Cpu, 
  Database, 
  HardDrive, 
  MessageSquare, 
  Settings, 
  Shield, 
  Zap,
  Eye,
  Compass,
  Scale,
  CheckCircle2,
  BookOpen,
  AlertTriangle,
  Terminal,
  Wifi,
  WifiOff,
  Play,
  Pause,
  RotateCcw,
  Send,
  Bot,
  User,
  Clock,
  TrendingUp,
  Server,
  Code,
  Bug,
  Search,
  Wrench,
  RefreshCw
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface AgentState {
  status: 'idle' | 'running' | 'paused' | 'error'
  currentPhase: number
  phaseProgress: number
  loopCount: number
  errorsFixed: number
  lastAction: string
  uptime: number
}

interface SystemMetrics {
  cpu: number
  memory: number
  disk: number
  network: { in: number; out: number }
  processes: number
  errors: number
}

interface APIStatus {
  name: string
  status: 'online' | 'offline' | 'degraded'
  latency: number
  lastCheck: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  provider: string
  timestamp: Date
}

interface LogEntry {
  id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: Date
  source: string
}

interface Skill {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  enabled: boolean
  usageCount: number
  lastUsed?: Date
  status: 'active' | 'idle' | 'error'
}

interface Config {
  mode: 'local' | 'coolify' | 'hybrid'
  autoFix: boolean
  loopInterval: number
  primaryProvider: 'zai' | 'groq'
  supervised: boolean
  maxRetries: number
}

// ============================================================================
// OODA LOOP PHASES
// ============================================================================

const OODA_PHASES = [
  { name: 'Observe', icon: Eye, color: 'from-cyan-500 to-blue-500', description: 'Coletando dados do sistema' },
  { name: 'Orient', icon: Compass, color: 'from-blue-500 to-purple-500', description: 'Analisando contexto' },
  { name: 'Decide', icon: Scale, color: 'from-purple-500 to-pink-500', description: 'Tomando decisão' },
  { name: 'Act', icon: Zap, color: 'from-pink-500 to-red-500', description: 'Executando ação' },
  { name: 'Verify', icon: CheckCircle2, color: 'from-red-500 to-orange-500', description: 'Verificando resultado' },
  { name: 'Learn', icon: BookOpen, color: 'from-orange-500 to-yellow-500', description: 'Aprendendo com resultado' },
]

// ============================================================================
// DEFAULT SKILLS
// ============================================================================

const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'code-scanner',
    name: 'Code Scanner',
    description: 'Escaneia código em busca de erros e vulnerabilidades',
    icon: <Code className="w-5 h-5" />,
    enabled: true,
    usageCount: 47,
    status: 'active'
  },
  {
    id: 'log-analyzer',
    name: 'Log Analyzer',
    description: 'Analisa logs para detectar padrões de erro',
    icon: <Terminal className="w-5 h-5" />,
    enabled: true,
    usageCount: 89,
    status: 'active'
  },
  {
    id: 'security-auditor',
    name: 'Security Auditor',
    description: 'Verifica falhas de segurança e configurações',
    icon: <Shield className="w-5 h-5" />,
    enabled: true,
    usageCount: 23,
    status: 'idle'
  },
  {
    id: 'auto-fix',
    name: 'Auto-Fix Engine',
    description: 'Corrige problemas detectados automaticamente',
    icon: <Wrench className="w-5 h-5" />,
    enabled: true,
    usageCount: 156,
    status: 'active'
  },
  {
    id: 'api-profiler',
    name: 'API Profiler',
    description: 'Monitora performance das APIs',
    icon: <Activity className="w-5 h-5" />,
    enabled: true,
    usageCount: 34,
    status: 'idle'
  },
  {
    id: 'error-detector',
    name: 'Error Detector',
    description: 'Detecta erros em tempo real',
    icon: <Bug className="w-5 h-5" />,
    enabled: true,
    usageCount: 78,
    status: 'active'
  }
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CLAWDEVDashboard() {
  // State
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // Agent State
  const [agentState, setAgentState] = useState<AgentState>({
    status: 'running',
    currentPhase: 0,
    phaseProgress: 0,
    loopCount: 0,
    errorsFixed: 12,
    lastAction: 'Verificando saúde do sistema...',
    uptime: 3600
  })
  
  // System Metrics
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 45,
    memory: 62,
    disk: 38,
    network: { in: 125, out: 89 },
    processes: 142,
    errors: 2
  })
  
  // API Status
  const [apiStatus, setApiStatus] = useState<APIStatus[]>([
    { name: 'Z.AI (GLM-4.5)', status: 'online', latency: 234, lastCheck: '2s ago' },
    { name: 'GROQ', status: 'online', latency: 156, lastCheck: '2s ago' },
    { name: 'OpenClaw', status: 'online', latency: 45, lastCheck: '5s ago' },
  ])
  
  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Olá! Sou o CLAWDEV AI, seu assistente autônomo. Estou monitorando o sistema ativamente. Como posso ajudar?',
      provider: 'Z.AI',
      timestamp: new Date()
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', level: 'info', message: '[CLAWDEV] Sistema iniciado com sucesso', timestamp: new Date(), source: 'system' },
    { id: '2', level: 'info', message: '[OODA] Loop autônomo iniciado - Intervalo: 5s', timestamp: new Date(), source: 'agent' },
    { id: '3', level: 'info', message: '[OBSERVE] Coletando métricas do sistema...', timestamp: new Date(), source: 'agent' },
    { id: '4', level: 'info', message: '[ORIENT] 3 containers ativos detectados', timestamp: new Date(), source: 'agent' },
    { id: '5', level: 'warn', message: '[DECIDE] Uso de CPU acima do limiar (85%)', timestamp: new Date(), source: 'agent' },
    { id: '6', level: 'info', message: '[ACT] Otimizando processos em background...', timestamp: new Date(), source: 'agent' },
    { id: '7', level: 'info', message: '[VERIFY] CPU reduzido para 62%', timestamp: new Date(), source: 'agent' },
    { id: '8', level: 'info', message: '[LEARN] Padrão de uso identificado: picos às 14h', timestamp: new Date(), source: 'agent' },
  ])
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all')
  
  // Skills
  const [skills, setSkills] = useState<Skill[]>(DEFAULT_SKILLS)
  
  // Config
  const [config, setConfig] = useState<Config>({
    mode: 'local',
    autoFix: true,
    loopInterval: 5,
    primaryProvider: 'zai',
    supervised: false,
    maxRetries: 3
  })

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Agent Loop Simulation
  useEffect(() => {
    if (agentState.status !== 'running') return

    const interval = setInterval(() => {
      setAgentState(prev => {
        const newProgress = prev.phaseProgress + 20
        if (newProgress >= 100) {
          // Move to next phase
          const nextPhase = (prev.currentPhase + 1) % OODA_PHASES.length
          const newLoopCount = nextPhase === 0 ? prev.loopCount + 1 : prev.loopCount
          
          // Add log entry
          const phase = OODA_PHASES[nextPhase]
          addLog('info', `[${phase.name.toUpperCase()}] ${phase.description}`, 'agent')
          
          return {
            ...prev,
            currentPhase: nextPhase,
            phaseProgress: 0,
            loopCount: newLoopCount,
            lastAction: phase.description
          }
        }
        return { ...prev, phaseProgress: newProgress }
      })
    }, config.loopInterval * 200)

    return () => clearInterval(interval)
  }, [agentState.status, config.loopInterval])

  // Metrics Simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.max(20, Math.min(95, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(30, Math.min(90, prev.memory + (Math.random() - 0.5) * 5)),
        disk: Math.max(20, Math.min(80, prev.disk + (Math.random() - 0.5) * 2)),
        network: {
          in: Math.max(50, Math.min(500, prev.network.in + (Math.random() - 0.5) * 50)),
          out: Math.max(30, Math.min(300, prev.network.out + (Math.random() - 0.5) * 30))
        },
        processes: Math.max(100, Math.min(200, prev.processes + Math.floor((Math.random() - 0.5) * 10))),
        errors: Math.max(0, prev.errors + (Math.random() > 0.95 ? 1 : 0))
      }))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Uptime counter
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentState(prev => ({ ...prev, uptime: prev.uptime + 1 }))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Chat scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ============================================================================
  // HELPERS
  // ============================================================================

  const addLog = useCallback((level: LogEntry['level'], message: string, source: string = 'system') => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      level,
      message,
      timestamp: new Date(),
      source
    }
    setLogs(prev => [newLog, ...prev].slice(0, 100))
  }, [])

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': case 'active': case 'running': return 'text-green-400'
      case 'offline': case 'error': return 'text-red-400'
      case 'degraded': case 'idle': return 'text-yellow-400'
      case 'paused': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'text-cyan-400'
      case 'warn': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      case 'debug': return 'text-gray-500'
    }
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleAgentControl = (action: 'start' | 'pause' | 'reset') => {
    switch (action) {
      case 'start':
        setAgentState(prev => ({ ...prev, status: 'running' }))
        addLog('info', '[CLAWDEV] Agente retomado', 'system')
        break
      case 'pause':
        setAgentState(prev => ({ ...prev, status: 'paused' }))
        addLog('warn', '[CLAWDEV] Agente pausado', 'system')
        break
      case 'reset':
        setAgentState(prev => ({
          ...prev,
          currentPhase: 0,
          phaseProgress: 0,
          loopCount: 0,
          errorsFixed: 0,
          status: 'running'
        }))
        addLog('info', '[CLAWDEV] Agente reiniciado', 'system')
        break
    }
  }

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      provider: 'user',
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setChatLoading(true)

    try {
      // Try Z.AI first
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          history: chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))
        })
      })

      const data = await res.json()
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.error || 'Não consegui processar sua solicitação.',
        provider: data.provider || 'Z.AI',
        timestamp: new Date()
      }

      setChatMessages(prev => [...prev, assistantMessage])
      addLog('info', `[CHAT] Resposta gerada via ${assistantMessage.provider}`, 'chat')
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Erro ao conectar com os provedores de AI. Verifique as configurações.',
        provider: 'error',
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
      addLog('error', '[CHAT] Falha na conexão com AI', 'chat')
    }

    setChatLoading(false)
  }

  const toggleSkill = (skillId: string) => {
    setSkills(prev => prev.map(skill => 
      skill.id === skillId 
        ? { ...skill, enabled: !skill.enabled, status: !skill.enabled ? 'active' : 'idle' }
        : skill
    ))
    addLog('info', `[SKILL] Skill ${skillId} ${skills.find(s => s.id === skillId)?.enabled ? 'desativada' : 'ativada'}`, 'skills')
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} glass-card border-r border-border/50 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg animated-gradient flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <div className="fade-in">
                <h1 className="font-bold text-lg gradient-text">CLAWDEV</h1>
                <p className="text-xs text-muted-foreground">Autonomous Agent v6.0</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {[
            { id: 'dashboard', icon: Activity, label: 'Dashboard' },
            { id: 'agent', icon: Brain, label: 'Agente' },
            { id: 'chat', icon: MessageSquare, label: 'Chat AI' },
            { id: 'skills', icon: Zap, label: 'Skills' },
            { id: 'logs', icon: Terminal, label: 'Logs' },
            { id: 'config', icon: Settings, label: 'Config' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${
                activeTab === item.id 
                  ? 'bg-primary/20 text-primary border-l-2 border-primary' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Toggle Button */}
        <div className="p-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full justify-center"
          >
            {sidebarOpen ? '←' : '→'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {/* Header */}
        <header className="h-16 glass-card border-b border-border/50 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'agent' && 'Agente Autônomo'}
              {activeTab === 'chat' && 'Chat AI'}
              {activeTab === 'skills' && 'Skills'}
              {activeTab === 'logs' && 'Logs do Sistema'}
              {activeTab === 'config' && 'Configurações'}
            </h2>
            <Badge variant="outline" className={`${getStatusColor(agentState.status)} border-current`}>
              {agentState.status === 'running' ? '● Ativo' : agentState.status === 'paused' ? '⏸ Pausado' : '○ Idle'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Agent Quick Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAgentControl(agentState.status === 'running' ? 'pause' : 'start')}
                className={agentState.status === 'running' ? 'text-yellow-400' : 'text-green-400'}
              >
                {agentState.status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAgentControl('reset')}
                className="text-muted-foreground"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Uptime */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{formatUptime(agentState.uptime)}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin">
          
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Agent Loop Status */}
              <Card className="glass-card glass-card-hover">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    OODA Loop Autônomo
                  </CardTitle>
                  <CardDescription>Ciclo de decisão e execução autônoma</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Phase Display */}
                  <div className="flex items-center justify-between mb-4">
                    {OODA_PHASES.map((phase, index) => {
                      const isActive = index === agentState.currentPhase
                      const isPast = index < agentState.currentPhase
                      const Icon = phase.icon
                      
                      return (
                        <div key={phase.name} className="flex flex-col items-center gap-2 relative">
                          {/* Connection Line */}
                          {index < OODA_PHASES.length - 1 && (
                            <div className={`absolute top-5 left-1/2 w-full h-0.5 ${
                              isPast || isActive ? 'bg-primary/50' : 'bg-muted'
                            }`} />
                          )}
                          
                          {/* Phase Circle */}
                          <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center ${
                            isActive 
                              ? `bg-gradient-to-br ${phase.color} pulse-glow` 
                              : isPast 
                                ? 'bg-primary/30' 
                                : 'bg-muted/30'
                          }`}>
                            <Icon className={`w-5 h-5 ${isActive ? 'text-white' : isPast ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          
                          {/* Phase Name */}
                          <span className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                            {phase.name}
                          </span>
                          
                          {/* Progress Bar for Active Phase */}
                          {isActive && (
                            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16">
                              <Progress value={agentState.phaseProgress} className="h-1" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 mt-8">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{agentState.loopCount}</p>
                      <p className="text-xs text-muted-foreground">Ciclos Completos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-400">{agentState.errorsFixed}</p>
                      <p className="text-xs text-muted-foreground">Erros Corrigidos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-cyan-400">{config.loopInterval}s</p>
                      <p className="text-xs text-muted-foreground">Intervalo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-400">{skills.filter(s => s.enabled).length}</p>
                      <p className="text-xs text-muted-foreground">Skills Ativas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CPU */}
                <Card className="glass-card metric-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Cpu className="w-5 h-5 text-primary" />
                      <span className={`text-sm font-medium ${metrics.cpu > 80 ? 'text-red-400' : metrics.cpu > 60 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {metrics.cpu.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={metrics.cpu} className="h-2 mb-2" />
                    <p className="text-xs text-muted-foreground">CPU Usage</p>
                  </CardContent>
                </Card>

                {/* Memory */}
                <Card className="glass-card metric-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Database className="w-5 h-5 text-purple-400" />
                      <span className={`text-sm font-medium ${metrics.memory > 80 ? 'text-red-400' : metrics.memory > 60 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {metrics.memory.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={metrics.memory} className="h-2 mb-2" />
                    <p className="text-xs text-muted-foreground">Memória</p>
                  </CardContent>
                </Card>

                {/* Disk */}
                <Card className="glass-card metric-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <HardDrive className="w-5 h-5 text-blue-400" />
                      <span className={`text-sm font-medium ${metrics.disk > 80 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {metrics.disk.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={metrics.disk} className="h-2 mb-2" />
                    <p className="text-xs text-muted-foreground">Disco</p>
                  </CardContent>
                </Card>

                {/* Errors */}
                <Card className="glass-card metric-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <AlertTriangle className={`w-5 h-5 ${metrics.errors > 0 ? 'text-red-400' : 'text-green-400'}`} />
                      <span className={`text-sm font-medium ${metrics.errors > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {metrics.errors}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Erros Ativos</p>
                    <p className="text-lg font-bold text-foreground">{metrics.processes}</p>
                    <p className="text-xs text-muted-foreground">Processos</p>
                  </CardContent>
                </Card>
              </div>

              {/* API Status & Network */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* API Status */}
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Server className="w-4 h-4 text-primary" />
                      Status das APIs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {apiStatus.map(api => (
                        <div key={api.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                          <div className="flex items-center gap-3">
                            {api.status === 'online' ? (
                              <Wifi className="w-4 h-4 text-green-400" />
                            ) : (
                              <WifiOff className="w-4 h-4 text-red-400" />
                            )}
                            <span className="text-sm font-medium">{api.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs">
                              {api.latency}ms
                            </Badge>
                            <Badge className={`text-xs ${getStatusColor(api.status)}`}>
                              {api.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Network */}
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Rede
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/20 text-center">
                        <p className="text-2xl font-bold text-green-400">{metrics.network.in.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">KB/s Download</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/20 text-center">
                        <p className="text-2xl font-bold text-blue-400">{metrics.network.out.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">KB/s Upload</p>
                      </div>
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-muted/20">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Última ação:</span>
                        <span className="text-foreground">{agentState.lastAction}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* AGENT TAB */}
          {activeTab === 'agent' && (
            <div className="space-y-6">
              {/* Agent Control */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    Controle do Agente
                  </CardTitle>
                  <CardDescription>Gerencie o comportamento do agente autônomo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-full ${agentState.status === 'running' ? 'bg-green-400 pulse-glow' : agentState.status === 'paused' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                      <div>
                        <p className="font-medium">Status: {agentState.status === 'running' ? 'Executando' : agentState.status === 'paused' ? 'Pausado' : 'Parado'}</p>
                        <p className="text-sm text-muted-foreground">Fase atual: {OODA_PHASES[agentState.currentPhase].name}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={agentState.status === 'running' ? 'destructive' : 'default'}
                        onClick={() => handleAgentControl(agentState.status === 'running' ? 'pause' : 'start')}
                      >
                        {agentState.status === 'running' ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {agentState.status === 'running' ? 'Pausar' : 'Iniciar'}
                      </Button>
                      <Button variant="outline" onClick={() => handleAgentControl('reset')}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reiniciar
                      </Button>
                    </div>
                  </div>

                  {/* Loop Interval */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Intervalo do Loop</label>
                      <span className="text-primary font-bold">{config.loopInterval}s</span>
                    </div>
                    <Slider
                      value={[config.loopInterval]}
                      onValueChange={([value]) => setConfig(prev => ({ ...prev, loopInterval: value }))}
                      min={1}
                      max={30}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">Tempo entre cada ciclo OODA</p>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20">
                      <div>
                        <p className="font-medium">Auto-Fix</p>
                        <p className="text-xs text-muted-foreground">Corrigir erros automaticamente</p>
                      </div>
                      <Switch
                        checked={config.autoFix}
                        onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoFix: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20">
                      <div>
                        <p className="font-medium">Modo Supervisionado</p>
                        <p className="text-xs text-muted-foreground">Requer aprovação para ações</p>
                      </div>
                      <Switch
                        checked={config.supervised}
                        onCheckedChange={(checked) => setConfig(prev => ({ ...prev, supervised: checked }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Phase Details */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {(() => {
                      const PhaseIcon = OODA_PHASES[agentState.currentPhase].icon
                      return <PhaseIcon className="w-5 h-5 text-primary" />
                    })()}
                    Fase Atual: {OODA_PHASES[agentState.currentPhase].name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-muted-foreground">{OODA_PHASES[agentState.currentPhase].description}</p>
                    <Progress value={agentState.phaseProgress} className="h-2" />
                    <p className="text-sm text-muted-foreground">{agentState.phaseProgress}% completo</p>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Actions */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">Ações Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {logs.filter(l => l.source === 'agent').slice(0, 5).map(log => (
                      <div key={log.id} className="flex items-center gap-3 p-2 rounded bg-muted/20 text-sm">
                        <span className={getLogColor(log.level)}>●</span>
                        <span className="flex-1">{log.message}</span>
                        <span className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="h-[calc(100vh-10rem)] flex flex-col">
              <Card className="glass-card flex-1 flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Chat com CLAWDEV AI
                  </CardTitle>
                  <CardDescription>
                    Conectado via {config.primaryProvider === 'zai' ? 'Z.AI (GLM-4.5)' : 'GROQ'} com fallback automático
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {/* Messages */}
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4">
                      {chatMessages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div className={`max-w-[80%] rounded-lg p-3 ${
                            msg.role === 'user' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted/30 border border-border/50'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs opacity-70">
                                {msg.timestamp.toLocaleTimeString()}
                              </span>
                              {msg.provider && msg.provider !== 'user' && (
                                <Badge variant="outline" className="text-xs h-4">
                                  {msg.provider}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Pensando...</span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="flex gap-2 mt-4">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                      placeholder="Digite sua mensagem..."
                      disabled={chatLoading}
                      className="flex-1"
                    />
                    <Button onClick={handleChatSend} disabled={!chatInput.trim() || chatLoading}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* SKILLS TAB */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skills.map(skill => (
                  <Card key={skill.id} className={`glass-card glass-card-hover ${skill.enabled ? 'border-primary/30' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            skill.enabled ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground'
                          }`}>
                            {skill.icon}
                          </div>
                          <div>
                            <CardTitle className="text-base">{skill.name}</CardTitle>
                            <Badge className={`text-xs mt-1 ${getStatusColor(skill.status)}`}>
                              {skill.status}
                            </Badge>
                          </div>
                        </div>
                        <Switch
                          checked={skill.enabled}
                          onCheckedChange={() => toggleSkill(skill.id)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{skill.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Usos: {skill.usageCount}</span>
                        {skill.lastUsed && (
                          <span className="text-muted-foreground">
                            Último: {skill.lastUsed.toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-2">
                <Button
                  variant={logFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogFilter('all')}
                >
                  Todos
                </Button>
                <Button
                  variant={logFilter === 'info' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogFilter('info')}
                  className="text-cyan-400"
                >
                  Info
                </Button>
                <Button
                  variant={logFilter === 'warn' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogFilter('warn')}
                  className="text-yellow-400"
                >
                  Warn
                </Button>
                <Button
                  variant={logFilter === 'error' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLogFilter('error')}
                  className="text-red-400"
                >
                  Error
                </Button>
              </div>

              {/* Log List */}
              <Card className="glass-card">
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-16rem)]">
                    <div className="p-4 space-y-1 font-mono text-sm">
                      {logs
                        .filter(log => logFilter === 'all' || log.level === logFilter)
                        .map(log => (
                          <div
                            key={log.id}
                            className="flex items-start gap-2 p-2 rounded hover:bg-muted/20 transition-colors"
                          >
                            <span className="text-muted-foreground text-xs">
                              [{log.timestamp.toLocaleTimeString()}]
                            </span>
                            <span className={getLogColor(log.level)}>
                              [{log.level.toUpperCase()}]
                            </span>
                            <span className="flex-1">{log.message}</span>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CONFIG TAB */}
          {activeTab === 'config' && (
            <div className="space-y-6 max-w-2xl">
              {/* Mode */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">Modo de Operação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {(['local', 'coolify', 'hybrid'] as const).map(mode => (
                      <Button
                        key={mode}
                        variant={config.mode === mode ? 'default' : 'outline'}
                        onClick={() => setConfig(prev => ({ ...prev, mode }))}
                        className="w-full"
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Provider */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">Provedor AI Principal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={config.primaryProvider === 'zai' ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({ ...prev, primaryProvider: 'zai' }))}
                      className="w-full"
                    >
                      Z.AI (GLM-4.5)
                    </Button>
                    <Button
                      variant={config.primaryProvider === 'groq' ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({ ...prev, primaryProvider: 'groq' }))}
                      className="w-full"
                    >
                      GROQ
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Behavior */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">Comportamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-Fix</p>
                      <p className="text-xs text-muted-foreground">Corrigir erros automaticamente</p>
                    </div>
                    <Switch
                      checked={config.autoFix}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoFix: checked }))}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Modo Supervisionado</p>
                      <p className="text-xs text-muted-foreground">Requer aprovação para ações críticas</p>
                    </div>
                    <Switch
                      checked={config.supervised}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, supervised: checked }))}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Max Retries</p>
                      <span className="text-primary">{config.maxRetries}</span>
                    </div>
                    <Slider
                      value={[config.maxRetries]}
                      onValueChange={([value]) => setConfig(prev => ({ ...prev, maxRetries: value }))}
                      min={1}
                      max={10}
                      step={1}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* API Keys */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">API Keys</CardTitle>
                  <CardDescription>Configure suas chaves de API</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Z.AI API Key</label>
                    <Input type="password" placeholder="ed6a82df...nrydZc7MImQwWWgM" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">GROQ API Key</label>
                    <Input type="password" placeholder="gsk_EXNi...sgE77KmB" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
