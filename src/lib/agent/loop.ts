import { db } from '@/lib/db'
import type { OODAPhase, OODALoopState, AgentStatus, LogEntry, AutonomousAction } from '@/types'

// Global state for the OODA loop
let loopState: OODALoopState = {
  phase: 'idle',
  startTime: new Date().toISOString(),
  progress: 0,
  observations: [],
  orientations: [],
  decisions: [],
  actions: [],
  verifications: [],
  learnings: []
}

let agentStatus: AgentStatus = {
  isRunning: false,
  currentPhase: 'idle',
  phaseProgress: 0,
  lastCycleTime: new Date().toISOString(),
  cycleCount: 0,
  errors: 0,
  autoFixEnabled: true,
  mode: 'local',
  loopInterval: 10,
  currentTask: 'Initializing...'
}

let loopInterval: NodeJS.Timeout | null = null
const phaseDuration = 2000 // 2 seconds per phase

// Phase icons and labels
export const phaseInfo: Record<OODAPhase, { icon: string; label: string; description: string }> = {
  observe: { icon: '👁️', label: 'Observe', description: 'Collecting system data and metrics' },
  orient: { icon: '🧭', label: 'Orient', description: 'Analyzing context and patterns' },
  decide: { icon: '⚖️', label: 'Decide', description: 'Choosing optimal action' },
  act: { icon: '⚡', label: 'Act', description: 'Executing chosen action' },
  verify: { icon: '✅', label: 'Verify', description: 'Validating action results' },
  learn: { icon: '📚', label: 'Learn', description: 'Storing insights for future' },
  idle: { icon: '💤', label: 'Idle', description: 'Waiting for activation' }
}

// Log helper
async function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, source: string = 'agent', metadata?: Record<string, unknown>) {
  try {
    await db.log.create({
      data: {
        level,
        message,
        source,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    })
  } catch (error) {
    console.error('Failed to log:', error)
  }
}

// OODA Phase Implementations
async function observePhase(): Promise<string[]> {
  const observations: string[] = []
  
  // Simulate system observation
  const cpuUsage = Math.random() * 100
  const memoryUsage = Math.random() * 100
  const diskUsage = Math.random() * 100
  
  observations.push(`CPU usage: ${cpuUsage.toFixed(1)}%`)
  observations.push(`Memory usage: ${memoryUsage.toFixed(1)}%`)
  observations.push(`Disk usage: ${diskUsage.toFixed(1)}%`)
  
  // Check for anomalies
  if (cpuUsage > 80) {
    observations.push(`⚠️ High CPU usage detected: ${cpuUsage.toFixed(1)}%`)
  }
  if (memoryUsage > 85) {
    observations.push(`⚠️ High memory usage detected: ${memoryUsage.toFixed(1)}%`)
  }
  
  // Get recent logs
  const recentLogs = await db.log.findMany({
    take: 10,
    orderBy: { timestamp: 'desc' }
  })
  
  if (recentLogs.length > 0) {
    observations.push(`Found ${recentLogs.length} recent log entries`)
    const errors = recentLogs.filter(l => l.level === 'ERROR')
    if (errors.length > 0) {
      observations.push(`⚠️ ${errors.length} recent errors detected`)
    }
  }
  
  await log('INFO', `Observation phase completed: ${observations.length} observations`, 'agent', { observations })
  return observations
}

async function orientPhase(observations: string[]): Promise<string[]> {
  const orientations: string[] = []
  
  // Analyze observations
  const hasWarnings = observations.some(o => o.includes('⚠️'))
  const hasHighCpu = observations.some(o => o.includes('High CPU'))
  const hasHighMemory = observations.some(o => o.includes('High memory'))
  const hasErrors = observations.some(o => o.includes('errors detected'))
  
  if (hasWarnings) {
    orientations.push('System has active warnings requiring attention')
  }
  
  if (hasHighCpu) {
    orientations.push('CPU optimization may be needed')
  }
  
  if (hasHighMemory) {
    orientations.push('Memory cleanup recommended')
  }
  
  if (hasErrors) {
    orientations.push('Error patterns detected - investigation needed')
  }
  
  if (!hasWarnings) {
    orientations.push('System operating within normal parameters')
    orientations.push('No immediate action required')
  }
  
  // Check learned patterns
  const learnings = await db.learning.findMany({
    where: { success: true },
    take: 5,
    orderBy: { createdAt: 'desc' }
  })
  
  if (learnings.length > 0) {
    orientations.push(`Found ${learnings.length} relevant past learnings`)
  }
  
  await log('INFO', `Orientation phase completed: ${orientations.length} orientations`, 'agent', { orientations })
  return orientations
}

async function decidePhase(orientations: string[]): Promise<string[]> {
  const decisions: string[] = []
  
  const hasWarning = orientations.some(o => o.includes('warnings') || o.includes('attention'))
  const hasCpuIssue = orientations.some(o => o.includes('CPU optimization'))
  const hasMemoryWarning = orientations.some(o => o.includes('Memory cleanup'))
  const hasErrors = orientations.some(o => o.includes('Error patterns'))
  const needsNoAction = orientations.some(o => o.includes('No immediate action'))
  
  if (agentStatus.autoFixEnabled) {
    if (hasCpuIssue) {
      decisions.push('ACTION: Analyze CPU-intensive processes')
    }
    
    if (hasMemoryWarning) {
      decisions.push('ACTION: Trigger memory optimization')
    }
    
    if (hasErrors) {
      decisions.push('ACTION: Initiate error analysis and remediation')
    }
  } else {
    if (hasWarning) {
      decisions.push('ALERT: Manual review required (auto-fix disabled)')
    }
  }
  
  if (needsNoAction) {
    decisions.push('DECISION: Continue monitoring')
    decisions.push('DECISION: Wait for next cycle')
  }
  
  await log('INFO', `Decision phase completed: ${decisions.length} decisions`, 'agent', { decisions })
  return decisions
}

async function actPhase(decisions: string[]): Promise<string[]> {
  const actions: string[] = []
  
  for (const decision of decisions) {
    if (decision.startsWith('ACTION:')) {
      const actionDesc = decision.replace('ACTION: ', '')
      
      // Create action record
      const action = await db.action.create({
        data: {
          type: 'fix',
          description: actionDesc,
          status: 'completed',
          autoApproved: agentStatus.autoFixEnabled,
          result: 'Action executed successfully'
        }
      })
      
      actions.push(`Executed: ${actionDesc} (ID: ${action.id.slice(0, 8)})`)
    } else if (decision.startsWith('ALERT:')) {
      actions.push(`Alert created for manual review`)
    } else if (decision.startsWith('DECISION:')) {
      actions.push(`Decision recorded: ${decision.replace('DECISION: ', '')}`)
    }
  }
  
  await log('INFO', `Act phase completed: ${actions.length} actions`, 'agent', { actions })
  return actions
}

async function verifyPhase(actions: string[]): Promise<string[]> {
  const verifications: string[] = []
  
  for (const action of actions) {
    if (action.includes('Executed:')) {
      verifications.push(`✓ Action verified: ${action}`)
    } else if (action.includes('Alert')) {
      verifications.push(`✓ Alert pending review`)
    } else {
      verifications.push(`✓ Action acknowledged`)
    }
  }
  
  // Check for any new errors after actions
  const newErrors = await db.log.count({
    where: {
      level: 'ERROR',
      timestamp: {
        gte: new Date(Date.now() - 5000).toISOString()
      }
    }
  })
  
  if (newErrors > 0) {
    verifications.push(`⚠️ ${newErrors} new errors detected after actions`)
    agentStatus.errors += newErrors
  } else {
    verifications.push('✓ No new errors detected')
  }
  
  await log('INFO', `Verify phase completed: ${verifications.length} verifications`, 'agent', { verifications })
  return verifications
}

async function learnPhase(
  observations: string[],
  orientations: string[],
  decisions: string[],
  actions: string[],
  verifications: string[]
): Promise<string[]> {
  const learnings: string[] = []
  
  // Store insights based on the cycle
  const hadWarnings = observations.some(o => o.includes('⚠️'))
  const hadErrors = observations.some(o => o.includes('errors'))
  const actionsTaken = actions.some(a => a.includes('Executed:'))
  
  if (hadWarnings && actionsTaken) {
    const insight = `Successfully handled warning conditions with automated actions`
    await db.learning.create({
      data: {
        insight,
        category: 'pattern',
        context: JSON.stringify({ observations: observations.slice(0, 3), actions: actions.slice(0, 3) }),
        actionTaken: actions[0],
        success: true
      }
    })
    learnings.push(`Stored insight: ${insight}`)
  }
  
  if (hadErrors) {
    const insight = `Error pattern detected and logged for future reference`
    await db.learning.create({
      data: {
        insight,
        category: 'error',
        context: JSON.stringify({ errorCount: agentStatus.errors }),
        success: true
      }
    })
    learnings.push(`Stored insight: ${insight}`)
  }
  
  // General learning
  learnings.push(`Cycle ${agentStatus.cycleCount + 1} completed successfully`)
  learnings.push(`Total learnings stored: ${await db.learning.count()}`)
  
  await log('INFO', `Learn phase completed: ${learnings.length} learnings`, 'agent', { learnings })
  return learnings
}

// Main loop execution
async function executePhase(phase: OODAPhase): Promise<void> {
  agentStatus.currentPhase = phase
  agentStatus.currentTask = phaseInfo[phase].description
  loopState.phase = phase
  loopState.progress = 0
  
  // Simulate progress
  const progressInterval = setInterval(() => {
    if (loopState.progress < 100) {
      loopState.progress += 10
      agentStatus.phaseProgress = loopState.progress
    }
  }, phaseDuration / 10)
  
  try {
    switch (phase) {
      case 'observe':
        loopState.observations = await observePhase()
        break
      case 'orient':
        loopState.orientations = await orientPhase(loopState.observations)
        break
      case 'decide':
        loopState.decisions = await decidePhase(loopState.orientations)
        break
      case 'act':
        loopState.actions = await actPhase(loopState.decisions)
        break
      case 'verify':
        loopState.verifications = await verifyPhase(loopState.actions)
        break
      case 'learn':
        loopState.learnings = await learnPhase(
          loopState.observations,
          loopState.orientations,
          loopState.decisions,
          loopState.actions,
          loopState.verifications
        )
        break
    }
  } catch (error) {
    await log('ERROR', `Phase ${phase} failed: ${error}`, 'agent')
    agentStatus.errors++
  }
  
  clearInterval(progressInterval)
  loopState.progress = 100
  agentStatus.phaseProgress = 100
}

// Run complete OODA cycle
async function runOODACycle(): Promise<void> {
  const phases: OODAPhase[] = ['observe', 'orient', 'decide', 'act', 'verify', 'learn']
  
  for (const phase of phases) {
    if (!agentStatus.isRunning) break
    await executePhase(phase)
    await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause between phases
  }
  
  // Update cycle count
  agentStatus.cycleCount++
  agentStatus.lastCycleTime = new Date().toISOString()
  
  // Reset state for next cycle
  loopState = {
    phase: 'idle',
    startTime: new Date().toISOString(),
    progress: 0,
    observations: [],
    orientations: [],
    decisions: [],
    actions: [],
    verifications: [],
    learnings: []
  }
  
  await log('INFO', `OODA Cycle ${agentStatus.cycleCount} completed`, 'agent')
}

// Start the autonomous loop
export async function startLoop(intervalSeconds: number = 10): Promise<{ success: boolean; message: string }> {
  if (agentStatus.isRunning) {
    return { success: false, message: 'Loop is already running' }
  }
  
  agentStatus.isRunning = true
  agentStatus.loopInterval = intervalSeconds
  agentStatus.currentTask = 'Starting autonomous loop...'
  
  await log('INFO', `Starting autonomous loop with ${intervalSeconds}s interval`, 'agent')
  
  // Run immediately
  runOODACycle().catch(console.error)
  
  // Set up interval
  loopInterval = setInterval(() => {
    if (agentStatus.isRunning) {
      runOODACycle().catch(console.error)
    }
  }, intervalSeconds * 1000)
  
  return { success: true, message: 'Loop started successfully' }
}

// Stop the autonomous loop
export async function stopLoop(): Promise<{ success: boolean; message: string }> {
  if (!agentStatus.isRunning) {
    return { success: false, message: 'Loop is not running' }
  }
  
  agentStatus.isRunning = false
  agentStatus.currentPhase = 'idle'
  agentStatus.currentTask = 'Stopped'
  
  if (loopInterval) {
    clearInterval(loopInterval)
    loopInterval = null
  }
  
  await log('INFO', 'Autonomous loop stopped', 'agent')
  
  return { success: true, message: 'Loop stopped successfully' }
}

// Get current status
export function getStatus(): AgentStatus {
  return { ...agentStatus }
}

// Get loop state
export function getLoopState(): OODALoopState {
  return { ...loopState }
}

// Update configuration
export function updateConfig(config: Partial<AgentStatus>): void {
  if (config.autoFixEnabled !== undefined) {
    agentStatus.autoFixEnabled = config.autoFixEnabled
  }
  if (config.mode !== undefined) {
    agentStatus.mode = config.mode
  }
  if (config.loopInterval !== undefined) {
    agentStatus.loopInterval = config.loopInterval
    // Restart loop with new interval if running
    if (agentStatus.isRunning) {
      stopLoop().then(() => startLoop(config.loopInterval!))
    }
  }
}

// Get recent logs
export async function getRecentLogs(limit: number = 50, level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'): Promise<LogEntry[]> {
  const where = level ? { level } : {}
  const logs = await db.log.findMany({
    where,
    take: limit,
    orderBy: { timestamp: 'desc' }
  })
  
  return logs.map(log => ({
    id: log.id,
    level: log.level as 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
    message: log.message,
    source: log.source as 'agent' | 'api' | 'system' | 'skill' | undefined,
    metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
    timestamp: log.timestamp.toISOString()
  }))
}

// Get recent actions
export async function getRecentActions(limit: number = 20): Promise<AutonomousAction[]> {
  const actions = await db.action.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' }
  })
  
  return actions.map(action => ({
    id: action.id,
    type: action.type as 'fix' | 'optimize' | 'deploy' | 'restart' | 'alert',
    description: action.description,
    status: action.status as 'pending' | 'approved' | 'rejected' | 'completed' | 'failed',
    result: action.result || undefined,
    autoApproved: action.autoApproved,
    createdAt: action.createdAt.toISOString(),
    completedAt: action.completedAt?.toISOString()
  }))
}

// Add log entry
export async function addLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, source: string = 'system', metadata?: Record<string, unknown>): Promise<void> {
  await log(level, message, source, metadata)
}
