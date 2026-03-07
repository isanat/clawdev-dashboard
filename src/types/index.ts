// OODA Loop Types
export type OODAPhase = 'observe' | 'orient' | 'decide' | 'act' | 'verify' | 'learn' | 'idle'

export interface AgentStatus {
  isRunning: boolean
  currentPhase: OODAPhase
  phaseProgress: number // 0-100
  lastCycleTime: string
  cycleCount: number
  errors: number
  autoFixEnabled: boolean
  mode: 'local' | 'coolify' | 'hybrid'
  loopInterval: number // seconds
  currentTask?: string
}

export interface OODALoopState {
  phase: OODAPhase
  startTime: string
  progress: number
  observations: string[]
  orientations: string[]
  decisions: string[]
  actions: string[]
  verifications: string[]
  learnings: string[]
}

// Chat Types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  provider?: 'zai' | 'groq' | 'local'
  timestamp: string
}

export interface ChatRequest {
  message: string
  history: { role: string; content: string }[]
}

export interface ChatResponse {
  response: string
  provider: 'zai' | 'groq' | 'local'
  fallbackUsed: boolean
  error?: string
}

// Skills Types
export interface Skill {
  id: string
  name: string
  description: string
  enabled: boolean
  usageCount: number
  lastUsed?: string
  category: 'scanner' | 'analyzer' | 'security' | 'automation'
  status: 'active' | 'idle' | 'error'
  icon: string
}

export interface SkillExecution {
  skillId: string
  result: string
  success: boolean
  duration: number
}

// Log Types
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
export type LogSource = 'agent' | 'api' | 'system' | 'skill'

export interface LogEntry {
  id: string
  level: LogLevel
  message: string
  source?: LogSource
  metadata?: Record<string, unknown>
  timestamp: string
}

// Action Types
export type ActionType = 'fix' | 'optimize' | 'deploy' | 'restart' | 'alert'
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'

export interface AutonomousAction {
  id: string
  type: ActionType
  description: string
  status: ActionStatus
  result?: string
  autoApproved: boolean
  createdAt: string
  completedAt?: string
}

// Metrics Types
export interface SystemMetrics {
  cpu: number
  memory: number
  disk: number
  network: {
    in: number
    out: number
  }
  processes: number
  uptime: number
}

export interface APIMetric {
  name: string
  status: 'connected' | 'disconnected' | 'error'
  latency: number
  lastChecked: string
}

export interface AgentMetrics {
  loopsCompleted: number
  errorsFixed: number
  avgCycleTime: number
  learningsStored: number
}

export interface MetricsResponse {
  system: SystemMetrics
  apis: APIMetric[]
  agent: AgentMetrics
  timestamp: string
}

// Config Types
export interface AgentConfiguration {
  mode: 'local' | 'coolify' | 'hybrid'
  autoFix: boolean
  loopInterval: number
  zaiApiKey: string
  groqApiKey: string
  coolifyApiUrl?: string
  coolifyApiToken?: string
  coolifyAppUuid?: string
  projectPath?: string
  supervisedMode: boolean
}

// Learning Types
export interface Learning {
  id: string
  insight: string
  category: 'error' | 'optimization' | 'pattern' | 'security'
  context?: string
  actionTaken?: string
  success: boolean
  createdAt: string
}

// Connection Status
export interface ConnectionStatus {
  name: string
  status: 'success' | 'error'
  message: string
  latency?: number
  details?: Record<string, unknown>
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Dashboard State
export interface DashboardState {
  agentStatus: AgentStatus
  metrics: MetricsResponse | null
  skills: Skill[]
  logs: LogEntry[]
  actions: AutonomousAction[]
  chatMessages: ChatMessage[]
  config: AgentConfiguration | null
  connectionStatus: ConnectionStatus[]
}

// Event Types for SSE
export interface AgentEvent {
  type: 'status' | 'log' | 'action' | 'metric' | 'learning'
  data: unknown
  timestamp: string
}
