/**
 * CLAWDEV Agent Controller - Sistema de Controle Total
 * 
 * Este módulo gerencia o ciclo de vida completo do agente autônomo:
 * - Inicialização e configuração
 * - Start/Stop/Pause/Restart
 * - Monitoramento de saúde
 * - Recuperação automática de falhas
 * - Persistência de estado
 */

import { db } from '@/lib/db'
import { EventEmitter } from 'events'

// ============================================================================
// TYPES
// ============================================================================

export type AgentMode = 'autonomous' | 'supervised' | 'manual'
export type AgentState = 'idle' | 'starting' | 'running' | 'paused' | 'stopping' | 'error' | 'recovering'
export type AgentGoal = 'monitor' | 'fix' | 'improve' | 'learn' | 'deploy' | 'custom'

export interface AgentConfig {
  id: string
  name: string
  mode: AgentMode
  autoStart: boolean
  autoRecover: boolean
  autoImprove: boolean
  learningEnabled: boolean
  maxRetries: number
  loopIntervalMs: number
  cooldownMs: number
  maxCyclesPerSession: number
  priority: 'low' | 'normal' | 'high' | 'critical'
  primaryProvider: 'zai' | 'groq' | 'auto'
  goals: AgentGoalConfig[]
  constraints: AgentConstraint[]
  createdAt: Date
  updatedAt: Date
}

export interface AgentGoalConfig {
  id: string
  type: AgentGoal
  description: string
  priority: number
  enabled: boolean
  schedule?: string // cron expression
  lastExecuted?: Date
  nextExecution?: Date
  successCount: number
  failureCount: number
}

export interface AgentConstraint {
  id: string
  type: 'time' | 'resource' | 'action' | 'domain'
  rule: string
  enabled: boolean
}

export interface AgentStatus {
  state: AgentState
  isRunning: boolean
  isPaused: boolean
  isRecovering: boolean
  currentCycle: number
  totalCycles: number
  uptime: number
  startTime: Date | null
  lastActivity: Date | null
  lastError: string | null
  consecutiveErrors: number
  healthScore: number // 0-100
  activeGoals: string[]
  pendingActions: number
  learningProgress: number
}

export interface AgentEvent {
  type: 'state_change' | 'cycle_start' | 'cycle_end' | 'error' | 'recovery' | 'goal_complete' | 'learning'
  data: unknown
  timestamp: Date
}

export interface AgentAction {
  id: string
  type: 'fix' | 'optimize' | 'deploy' | 'restart' | 'alert' | 'learn' | 'improve' | 'execute'
  description: string
  status: 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: number
  autoApproved: boolean
  requiresApproval: boolean
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  result?: string
  error?: string
  metadata?: Record<string, unknown>
}

// ============================================================================
// AGENT CONTROLLER CLASS
// ============================================================================

class AgentController extends EventEmitter {
  private static instance: AgentController
  private config: AgentConfig | null = null
  private status: AgentStatus
  private loopInterval: NodeJS.Timeout | null = null
  private healthCheckInterval: NodeJS.Timeout | null = null
  private recoveryTimeout: NodeJS.Timeout | null = null
  private startTime: Date | null = null
  private isInitialized: boolean = false

  private constructor() {
    super()
    this.status = this.getDefaultStatus()
  }

  static getInstance(): AgentController {
    if (!AgentController.instance) {
      AgentController.instance = new AgentController()
    }
    return AgentController.instance
  }

  private getDefaultStatus(): AgentStatus {
    return {
      state: 'idle',
      isRunning: false,
      isPaused: false,
      isRecovering: false,
      currentCycle: 0,
      totalCycles: 0,
      uptime: 0,
      startTime: null,
      lastActivity: null,
      lastError: null,
      consecutiveErrors: 0,
      healthScore: 100,
      activeGoals: [],
      pendingActions: 0,
      learningProgress: 0
    }
  }

  private getDefaultConfig(): AgentConfig {
    return {
      id: 'clawdev-main',
      name: 'CLAWDEV Autonomous Agent',
      mode: 'autonomous',
      autoStart: true,
      autoRecover: true,
      autoImprove: true,
      learningEnabled: true,
      maxRetries: 3,
      loopIntervalMs: 10000, // 10 seconds
      cooldownMs: 5000, // 5 seconds
      maxCyclesPerSession: 1000,
      priority: 'normal',
      primaryProvider: 'auto',
      goals: [
        {
          id: 'system-health',
          type: 'monitor',
          description: 'Monitor system health and resources',
          priority: 1,
          enabled: true,
          successCount: 0,
          failureCount: 0
        },
        {
          id: 'error-fix',
          type: 'fix',
          description: 'Automatically fix detected errors',
          priority: 2,
          enabled: true,
          successCount: 0,
          failureCount: 0
        },
        {
          id: 'self-improve',
          type: 'improve',
          description: 'Continuously improve own code and performance',
          priority: 3,
          enabled: true,
          successCount: 0,
          failureCount: 0
        },
        {
          id: 'continuous-learn',
          type: 'learn',
          description: 'Learn from all actions and outcomes',
          priority: 4,
          enabled: true,
          successCount: 0,
          failureCount: 0
        }
      ],
      constraints: [
        {
          id: 'max-cpu',
          type: 'resource',
          rule: 'cpu_usage < 90',
          enabled: true
        },
        {
          id: 'max-memory',
          type: 'resource',
          rule: 'memory_usage < 85',
          enabled: true
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<{ success: boolean; message: string }> {
    if (this.isInitialized) {
      return { success: true, message: 'Agent already initialized' }
    }

    try {
      // Load config from database
      const savedConfig = await this.loadConfigFromDB()
      this.config = savedConfig || this.getDefaultConfig()

      // Save default config if not exists
      if (!savedConfig) {
        await this.saveConfigToDB(this.config)
      }

      // Initialize database tables if needed
      await this.initializeDB()

      this.isInitialized = true
      this.emit('initialized', { config: this.config })

      // Auto-start if configured
      if (this.config.autoStart) {
        await this.start()
      }

      return { success: true, message: 'Agent initialized successfully' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.status.state = 'error'
      this.status.lastError = errorMessage
      return { success: false, message: `Initialization failed: ${errorMessage}` }
    }
  }

  private async initializeDB(): Promise<void> {
    // Ensure agent config table exists
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS agent_config (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mode TEXT DEFAULT 'autonomous',
        auto_start INTEGER DEFAULT 1,
        auto_recover INTEGER DEFAULT 1,
        auto_improve INTEGER DEFAULT 1,
        learning_enabled INTEGER DEFAULT 1,
        max_retries INTEGER DEFAULT 3,
        loop_interval_ms INTEGER DEFAULT 10000,
        cooldown_ms INTEGER DEFAULT 5000,
        max_cycles_per_session INTEGER DEFAULT 1000,
        priority TEXT DEFAULT 'normal',
        primary_provider TEXT DEFAULT 'auto',
        goals TEXT DEFAULT '[]',
        constraints TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Ensure agent actions table exists
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS agent_action (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        auto_approved INTEGER DEFAULT 0,
        requires_approval INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        result TEXT,
        error TEXT,
        metadata TEXT
      )
    `
  }

  // ============================================================================
  // CONTROL METHODS
  // ============================================================================

  async start(): Promise<{ success: boolean; message: string }> {
    if (this.status.isRunning && !this.status.isPaused) {
      return { success: false, message: 'Agent is already running' }
    }

    if (!this.isInitialized) {
      await this.initialize()
    }

    this.status.state = 'starting'
    this.emit('state_change', { from: 'idle', to: 'starting' })

    try {
      this.startTime = new Date()
      this.status.startTime = this.startTime
      this.status.isRunning = true
      this.status.isPaused = false

      // Start main loop
      this.startMainLoop()

      // Start health check
      this.startHealthCheck()

      this.status.state = 'running'
      this.emit('state_change', { from: 'starting', to: 'running' })

      await this.log('INFO', 'Agent started successfully', 'controller')

      return { success: true, message: 'Agent started successfully' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.status.state = 'error'
      this.status.lastError = errorMessage
      await this.log('ERROR', `Failed to start agent: ${errorMessage}`, 'controller')
      return { success: false, message: `Start failed: ${errorMessage}` }
    }
  }

  async stop(): Promise<{ success: boolean; message: string }> {
    if (!this.status.isRunning) {
      return { success: false, message: 'Agent is not running' }
    }

    this.status.state = 'stopping'
    this.emit('state_change', { from: this.status.state, to: 'stopping' })

    try {
      // Clear intervals
      if (this.loopInterval) {
        clearInterval(this.loopInterval)
        this.loopInterval = null
      }
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }
      if (this.recoveryTimeout) {
        clearTimeout(this.recoveryTimeout)
        this.recoveryTimeout = null
      }

      this.status.isRunning = false
      this.status.isPaused = false
      this.status.state = 'idle'
      this.startTime = null

      this.emit('state_change', { from: 'stopping', to: 'idle' })
      await this.log('INFO', 'Agent stopped', 'controller')

      return { success: true, message: 'Agent stopped successfully' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.status.state = 'error'
      this.status.lastError = errorMessage
      return { success: false, message: `Stop failed: ${errorMessage}` }
    }
  }

  async pause(): Promise<{ success: boolean; message: string }> {
    if (!this.status.isRunning || this.status.isPaused) {
      return { success: false, message: 'Agent is not running or already paused' }
    }

    this.status.isPaused = true
    this.status.state = 'paused'
    this.emit('state_change', { from: 'running', to: 'paused' })
    await this.log('INFO', 'Agent paused', 'controller')

    return { success: true, message: 'Agent paused' }
  }

  async resume(): Promise<{ success: boolean; message: string }> {
    if (!this.status.isRunning || !this.status.isPaused) {
      return { success: false, message: 'Agent is not paused' }
    }

    this.status.isPaused = false
    this.status.state = 'running'
    this.emit('state_change', { from: 'paused', to: 'running' })
    await this.log('INFO', 'Agent resumed', 'controller')

    return { success: true, message: 'Agent resumed' }
  }

  async restart(): Promise<{ success: boolean; message: string }> {
    const stopResult = await this.stop()
    if (!stopResult.success) {
      return stopResult
    }

    // Wait for cooldown
    await new Promise(resolve => setTimeout(resolve, this.config?.cooldownMs || 5000))

    return this.start()
  }

  // ============================================================================
  // MAIN LOOP
  // ============================================================================

  private startMainLoop(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval)
    }

    const intervalMs = this.config?.loopIntervalMs || 10000

    this.loopInterval = setInterval(async () => {
      if (this.status.isPaused || !this.status.isRunning) {
        return
      }

      try {
        await this.executeCycle()
      } catch (error) {
        await this.handleError(error)
      }
    }, intervalMs)

    // Execute first cycle immediately
    this.executeCycle().catch(err => this.handleError(err))
  }

  private async executeCycle(): Promise<void> {
    if (!this.config) return

    this.status.currentCycle++
    this.status.totalCycles++
    this.status.lastActivity = new Date()
    this.status.uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0

    this.emit('cycle_start', { cycle: this.status.currentCycle })

    // Check max cycles
    if (this.status.currentCycle > this.config.maxCyclesPerSession) {
      await this.log('INFO', 'Max cycles reached, taking cooldown', 'controller')
      this.status.currentCycle = 0
      await new Promise(resolve => setTimeout(resolve, this.config?.cooldownMs || 5000))
    }

    // Execute enabled goals
    for (const goal of this.config.goals) {
      if (!goal.enabled) continue

      try {
        await this.executeGoal(goal)
      } catch (error) {
        this.status.consecutiveErrors++
        await this.log('ERROR', `Goal ${goal.id} failed: ${error}`, 'controller')
      }
    }

    this.emit('cycle_end', { cycle: this.status.currentCycle, status: this.status })

    // Update health score
    this.updateHealthScore()
  }

  private async executeGoal(goal: AgentGoalConfig): Promise<void> {
    switch (goal.type) {
      case 'monitor':
        await this.monitorSystem()
        break
      case 'fix':
        await this.autoFix()
        break
      case 'improve':
        await this.selfImprove()
        break
      case 'learn':
        await this.learn()
        break
      case 'deploy':
        await this.autoDeploy()
        break
      case 'custom':
        await this.executeCustomGoal(goal)
        break
    }
  }

  // ============================================================================
  // GOAL IMPLEMENTATIONS
  // ============================================================================

  private async monitorSystem(): Promise<void> {
    // Collect system metrics
    const metrics = {
      timestamp: new Date(),
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }

    // Check constraints
    const memoryUsageMB = metrics.memory.heapUsed / 1024 / 1024
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100

    if (memoryUsagePercent > 90) {
      await this.log('WARN', `High memory usage: ${memoryUsagePercent.toFixed(1)}%`, 'monitor')
      // Trigger garbage collection if possible
      if (global.gc) {
        global.gc()
        await this.log('INFO', 'Garbage collection triggered', 'monitor')
      }
    }

    // Store metrics
    await db.metric.create({
      data: {
        name: 'system_health',
        value: 100 - memoryUsagePercent,
        unit: '%',
        category: 'agent'
      }
    }).catch(() => {})
  }

  private async autoFix(): Promise<void> {
    // Check for recent errors
    const recentErrors = await db.log.findMany({
      where: {
        level: 'ERROR',
        timestamp: {
          gte: new Date(Date.now() - 60000) // Last minute
        }
      },
      take: 10
    })

    if (recentErrors.length > 0) {
      await this.log('INFO', `Found ${recentErrors.length} recent errors to analyze`, 'autofix')

      for (const error of recentErrors) {
        // Try to find a fix in learnings
        const relatedLearning = await db.learning.findFirst({
          where: {
            category: 'error',
            insight: { contains: error.message.substring(0, 50) }
          }
        })

        if (relatedLearning) {
          await this.log('INFO', `Found related learning for error: ${relatedLearning.insight}`, 'autofix')
        }
      }
    }
  }

  private async selfImprove(): Promise<void> {
    if (!this.config?.autoImprove) return

    // Analyze recent performance
    const recentActions = await db.action.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 3600000) // Last hour
        }
      },
      take: 50
    })

    const failedActions = recentActions.filter(a => a.status === 'failed')
    const successRate = recentActions.length > 0
      ? ((recentActions.length - failedActions.length) / recentActions.length) * 100
      : 100

    if (successRate < 80) {
      await this.log('WARN', `Low success rate: ${successRate.toFixed(1)}%`, 'improve')

      // Store learning
      await db.learning.create({
        data: {
          insight: `Low success rate detected: ${successRate.toFixed(1)}%. Consider reviewing recent failures.`,
          category: 'optimization',
          context: JSON.stringify({ failedCount: failedActions.length, total: recentActions.length }),
          success: false
        }
      })
    }

    // Update learning progress
    const totalLearnings = await db.learning.count()
    this.status.learningProgress = Math.min(100, totalLearnings)
  }

  private async learn(): Promise<void> {
    if (!this.config?.learningEnabled) return

    // Analyze patterns in recent actions
    const actions = await db.action.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' }
    })

    const patterns: Record<string, number> = {}
    for (const action of actions) {
      const key = `${action.type}:${action.status}`
      patterns[key] = (patterns[key] || 0) + 1
    }

    // Store pattern insights
    const dominantPattern = Object.entries(patterns).sort((a, b) => b[1] - a[1])[0]
    if (dominantPattern && dominantPattern[1] >= 5) {
      await db.learning.create({
        data: {
          insight: `Pattern detected: ${dominantPattern[0]} occurs frequently (${dominantPattern[1]} times)`,
          category: 'pattern',
          context: JSON.stringify(patterns),
          success: true
        }
      })

      this.emit('learning', { pattern: dominantPattern, total: patterns })
    }
  }

  private async autoDeploy(): Promise<void> {
    // Check if there are pending deployments
    await this.log('INFO', 'Checking for pending deployments...', 'deploy')
    // Implementation would connect to Coolify or similar
  }

  private async executeCustomGoal(goal: AgentGoalConfig): Promise<void> {
    await this.log('INFO', `Executing custom goal: ${goal.description}`, 'custom')
    // Custom goals would be defined by user
  }

  // ============================================================================
  // HEALTH & RECOVERY
  // ============================================================================

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth()
    }, 30000) // Every 30 seconds
  }

  private checkHealth(): void {
    const memUsage = process.memoryUsage()
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024
    const usagePercent = (heapUsedMB / heapTotalMB) * 100

    // Update health score based on various factors
    let healthScore = 100

    // Memory impact
    if (usagePercent > 90) healthScore -= 30
    else if (usagePercent > 80) healthScore -= 20
    else if (usagePercent > 70) healthScore -= 10

    // Error impact
    if (this.status.consecutiveErrors > 5) healthScore -= 25
    else if (this.status.consecutiveErrors > 3) healthScore -= 15
    else if (this.status.consecutiveErrors > 0) healthScore -= 5

    this.status.healthScore = Math.max(0, Math.min(100, healthScore))

    // Trigger recovery if needed
    if (this.status.healthScore < 50 && this.config?.autoRecover) {
      this.triggerRecovery()
    }
  }

  private updateHealthScore(): void {
    // Reduce consecutive errors on successful cycle
    if (this.status.consecutiveErrors > 0) {
      this.status.consecutiveErrors = Math.max(0, this.status.consecutiveErrors - 1)
    }

    // Recalculate health
    if (this.status.healthScore < 100) {
      this.status.healthScore = Math.min(100, this.status.healthScore + 1)
    }
  }

  private async triggerRecovery(): Promise<void> {
    if (this.status.isRecovering) return

    this.status.isRecovering = true
    this.status.state = 'recovering'
    this.emit('state_change', { from: 'running', to: 'recovering' })

    await this.log('WARN', 'Triggering automatic recovery', 'recovery')

    try {
      // 1. Clear caches
      if (global.gc) global.gc()

      // 2. Reset error count
      this.status.consecutiveErrors = 0

      // 3. Take a cooldown
      await new Promise(resolve => setTimeout(resolve, 10000))

      // 4. Restart if needed
      if (this.status.healthScore < 30) {
        await this.restart()
      }

      this.status.healthScore = 75
      this.status.isRecovering = false
      this.status.state = 'running'

      this.emit('recovery', { success: true })
      await this.log('INFO', 'Recovery completed', 'recovery')
    } catch (error) {
      this.status.isRecovering = false
      this.status.state = 'error'
      this.emit('recovery', { success: false, error })
      await this.log('ERROR', `Recovery failed: ${error}`, 'recovery')
    }
  }

  private async handleError(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    this.status.lastError = errorMessage
    this.status.consecutiveErrors++

    await this.log('ERROR', errorMessage, 'controller')

    if (this.status.consecutiveErrors >= (this.config?.maxRetries || 3)) {
      if (this.config?.autoRecover) {
        await this.triggerRecovery()
      } else {
        await this.stop()
      }
    }
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  private async loadConfigFromDB(): Promise<AgentConfig | null> {
    try {
      const result = await db.$queryRaw<Array<{
        id: string
        name: string
        mode: string
        auto_start: number
        auto_recover: number
        auto_improve: number
        learning_enabled: number
        max_retries: number
        loop_interval_ms: number
        cooldown_ms: number
        max_cycles_per_session: number
        priority: string
        primary_provider: string
        goals: string
        constraints: string
        created_at: Date
        updated_at: Date
      }>>`SELECT * FROM agent_config WHERE id = 'clawdev-main' LIMIT 1`

      if (result && result.length > 0) {
        const row = result[0]
        return {
          id: row.id,
          name: row.name,
          mode: row.mode as AgentMode,
          autoStart: row.auto_start === 1,
          autoRecover: row.auto_recover === 1,
          autoImprove: row.auto_improve === 1,
          learningEnabled: row.learning_enabled === 1,
          maxRetries: row.max_retries,
          loopIntervalMs: row.loop_interval_ms,
          cooldownMs: row.cooldown_ms,
          maxCyclesPerSession: row.max_cycles_per_session,
          priority: row.priority as 'low' | 'normal' | 'high' | 'critical',
          primaryProvider: row.primary_provider as 'zai' | 'groq' | 'auto',
          goals: JSON.parse(row.goals || '[]'),
          constraints: JSON.parse(row.constraints || '[]'),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      }
      return null
    } catch {
      return null
    }
  }

  private async saveConfigToDB(config: AgentConfig): Promise<void> {
    await db.$executeRaw`
      INSERT OR REPLACE INTO agent_config (
        id, name, mode, auto_start, auto_recover, auto_improve, learning_enabled,
        max_retries, loop_interval_ms, cooldown_ms, max_cycles_per_session,
        priority, primary_provider, goals, constraints, updated_at
      ) VALUES (
        ${config.id}, ${config.name}, ${config.mode}, ${config.autoStart ? 1 : 0},
        ${config.autoRecover ? 1 : 0}, ${config.autoImprove ? 1 : 0}, ${config.learningEnabled ? 1 : 0},
        ${config.maxRetries}, ${config.loopIntervalMs}, ${config.cooldownMs}, ${config.maxCyclesPerSession},
        ${config.priority}, ${config.primaryProvider}, ${JSON.stringify(config.goals)},
        ${JSON.stringify(config.constraints)}, CURRENT_TIMESTAMP
      )
    `
  }

  private async log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, source: string): Promise<void> {
    try {
      await db.log.create({
        data: { level, message, source }
      })
    } catch {
      // Fallback to console
      console.log(`[${level}] [${source}] ${message}`)
    }
  }

  // ============================================================================
  // PUBLIC GETTERS
  // ============================================================================

  getStatus(): AgentStatus {
    return { ...this.status }
  }

  getConfig(): AgentConfig | null {
    return this.config ? { ...this.config } : null
  }

  isRunning(): boolean {
    return this.status.isRunning && !this.status.isPaused
  }

  isPaused(): boolean {
    return this.status.isPaused
  }

  isHealthy(): boolean {
    return this.status.healthScore >= 70
  }

  // ============================================================================
  // CONFIG UPDATE
  // ============================================================================

  async updateConfig(updates: Partial<AgentConfig>): Promise<{ success: boolean; message: string }> {
    if (!this.config) {
      return { success: false, message: 'Agent not initialized' }
    }

    try {
      this.config = {
        ...this.config,
        ...updates,
        updatedAt: new Date()
      }

      await this.saveConfigToDB(this.config)
      this.emit('config_update', { config: this.config })

      return { success: true, message: 'Configuration updated' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, message: `Update failed: ${errorMessage}` }
    }
  }

  // ============================================================================
  // ACTION MANAGEMENT
  // ============================================================================

  async createAction(action: Omit<AgentAction, 'id' | 'createdAt'>): Promise<AgentAction> {
    const id = `action-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    const fullAction: AgentAction = {
      ...action,
      id,
      createdAt: new Date()
    }

    // Save to database
    await db.action.create({
      data: {
        id,
        type: action.type,
        description: action.description,
        status: action.status,
        autoApproved: action.autoApproved,
        result: action.result
      }
    })

    this.status.pendingActions++
    this.emit('action_created', { action: fullAction })

    return fullAction
  }

  async executeAction(actionId: string): Promise<{ success: boolean; result?: string; error?: string }> {
    const action = await db.action.findUnique({ where: { id: actionId } })

    if (!action) {
      return { success: false, error: 'Action not found' }
    }

    try {
      // Update status
      await db.action.update({
        where: { id: actionId },
        data: { status: 'running', startedAt: new Date() }
      })

      // Execute based on type
      let result = ''
      switch (action.type) {
        case 'execute':
          // Custom code execution would happen here
          result = 'Code execution not implemented yet'
          break
        case 'fix':
          result = 'Auto-fix triggered'
          break
        default:
          result = `Action ${action.type} executed`
      }

      // Mark as complete
      await db.action.update({
        where: { id: actionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          result
        }
      })

      this.status.pendingActions--
      this.emit('action_complete', { actionId, result })

      return { success: true, result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await db.action.update({
        where: { id: actionId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: errorMessage
        }
      })

      return { success: false, error: errorMessage }
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const agentController = AgentController.getInstance()
export default AgentController
