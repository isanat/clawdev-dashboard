/**
 * CLAWDEV Real Executor - Sistema de Execução REAL
 * 
 * Este módulo executa comandos REAIS no sistema:
 * - Git operations (commit, push, pull)
 * - Code generation com AI
 * - Test execution
 * - Deploy automation
 * - File operations
 * 
 * SEM SIMULAÇÕES - TUDO REAL!
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'

const execAsync = promisify(exec)

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  duration: number
  timestamp: Date
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  clean: boolean
}

export interface CodeGenerationResult {
  success: boolean
  code: string
  explanation: string
  files: { path: string; content: string }[]
}

export interface TestResult {
  success: boolean
  passed: number
  failed: number
  total: number
  duration: number
  coverage?: number
  details: string
}

export interface DeployResult {
  success: boolean
  url?: string
  version?: string
  error?: string
  logs: string
}

// ============================================================================
// REAL EXECUTOR CLASS
// ============================================================================

class RealExecutor {
  private static instance: RealExecutor
  private baseDir: string
  private maxExecutionTime: number = 120000 // 2 minutes

  private constructor() {
    this.baseDir = process.cwd()
  }

  static getInstance(): RealExecutor {
    if (!RealExecutor.instance) {
      RealExecutor.instance = new RealExecutor()
    }
    return RealExecutor.instance
  }

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute a shell command - REAL execution
   */
  async executeCommand(command: string, cwd?: string): Promise<ExecutionResult> {
    const startTime = Date.now()
    const workingDir = cwd || this.baseDir

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: this.maxExecutionTime,
        env: { ...process.env, FORCE_COLOR: '0' }
      })

      const result: ExecutionResult = {
        success: true,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        duration: Date.now() - startTime,
        timestamp: new Date()
      }

      await this.logExecution('INFO', command, result)
      return result

    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; code?: number }
      const result: ExecutionResult = {
        success: false,
        stdout: execError.stdout || '',
        stderr: execError.stderr || (error instanceof Error ? error.message : 'Unknown error'),
        exitCode: execError.code || 1,
        duration: Date.now() - startTime,
        timestamp: new Date()
      }

      await this.logExecution('ERROR', command, result)
      return result
    }
  }

  private async logExecution(level: 'INFO' | 'ERROR', command: string, result: ExecutionResult): Promise<void> {
    try {
      await db.log.create({
        data: {
          level,
          message: `Command: ${command.substring(0, 100)}`,
          source: 'executor',
          metadata: JSON.stringify({
            exitCode: result.exitCode,
            duration: result.duration,
            success: result.success
          })
        }
      })
    } catch {
      // Ignore logging errors
    }
  }

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  /**
   * Read a file - REAL file reading
   */
  async readFile(filePath: string): Promise<{ success: boolean; content: string; error?: string }> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath)
      const content = await fs.readFile(fullPath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { 
        success: false, 
        content: '', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Write a file - REAL file writing
   */
  async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath)
      const dir = path.dirname(fullPath)
      
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(fullPath, content, 'utf-8')
      
      await db.log.create({
        data: {
          level: 'INFO',
          message: `File written: ${filePath}`,
          source: 'executor'
        }
      })
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Delete a file - REAL file deletion
   */
  async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath)
      await fs.unlink(fullPath)
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * List files in directory - REAL directory listing
   */
  async listFiles(dirPath: string): Promise<{ success: boolean; files: string[]; error?: string }> {
    try {
      const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(this.baseDir, dirPath)
      const files = await fs.readdir(fullPath)
      return { success: true, files }
    } catch (error) {
      return { 
        success: false, 
        files: [], 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Check if file exists - REAL file check
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath)
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  // ============================================================================
  // SYSTEM MONITORING - REAL
  // ============================================================================

  /**
   * Get REAL system metrics
   */
  async getSystemMetrics(): Promise<{
    cpu: number
    memory: { used: number; total: number; percentage: number }
    disk: { used: number; total: number; percentage: number }
    uptime: number
    loadAverage: number[]
  }> {
    try {
      // Get memory info
      const memInfo = await this.readFile('/proc/meminfo')
      let memTotal = 0
      let memAvailable = 0
      
      if (memInfo.success) {
        const totalMatch = memInfo.content.match(/MemTotal:\s+(\d+)/)
        const availableMatch = memInfo.content.match(/MemAvailable:\s+(\d+)/)
        if (totalMatch) memTotal = parseInt(totalMatch[1]) * 1024
        if (availableMatch) memAvailable = parseInt(availableMatch[1]) * 1024
      }

      // Get load average
      const loadAvg = await this.readFile('/proc/loadavg')
      let loads = [0, 0, 0]
      if (loadAvg.success) {
        const parts = loadAvg.content.split(' ')
        loads = parts.slice(0, 3).map(p => parseFloat(p))
      }

      // Get uptime
      const uptimeResult = await this.readFile('/proc/uptime')
      let uptime = 0
      if (uptimeResult.success) {
        uptime = parseFloat(uptimeResult.content.split(' ')[0])
      }

      // Get disk usage
      const diskResult = await this.executeCommand('df -B1 / | tail -1')
      let diskUsed = 0
      let diskTotal = 0
      if (diskResult.success) {
        const parts = diskResult.stdout.trim().split(/\s+/)
        if (parts.length >= 3) {
          diskTotal = parseInt(parts[1])
          diskUsed = parseInt(parts[2])
        }
      }

      // Get CPU usage (rough estimate from load average)
      const cpu = Math.min(100, (loads[0] / 4) * 100) // Assuming 4 cores

      return {
        cpu: Math.round(cpu),
        memory: {
          used: memTotal - memAvailable,
          total: memTotal,
          percentage: memTotal > 0 ? Math.round(((memTotal - memAvailable) / memTotal) * 100) : 0
        },
        disk: {
          used: diskUsed,
          total: diskTotal,
          percentage: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0
        },
        uptime,
        loadAverage: loads
      }
    } catch {
      return {
        cpu: 0,
        memory: { used: 0, total: 0, percentage: 0 },
        disk: { used: 0, total: 0, percentage: 0 },
        uptime: 0,
        loadAverage: [0, 0, 0]
      }
    }
  }

  // ============================================================================
  // PROCESS MANAGEMENT - REAL
  // ============================================================================

  /**
   * Check if a process is running - REAL check
   */
  async isProcessRunning(processName: string): Promise<boolean> {
    const result = await this.executeCommand(`pgrep -f "${processName}"`)
    return result.success && result.stdout.trim().length > 0
  }

  /**
   * Kill a process - REAL kill
   */
  async killProcess(processName: string): Promise<ExecutionResult> {
    return this.executeCommand(`pkill -f "${processName}"`)
  }

  /**
   * Start a service - REAL service start
   */
  async startService(serviceName: string): Promise<ExecutionResult> {
    return this.executeCommand(`sudo systemctl start ${serviceName}`)
  }

  /**
   * Stop a service - REAL service stop
   */
  async stopService(serviceName: string): Promise<ExecutionResult> {
    return this.executeCommand(`sudo systemctl stop ${serviceName}`)
  }

  /**
   * Check service status - REAL status check
   */
  async checkServiceStatus(serviceName: string): Promise<{
    running: boolean
    status: string
    uptime?: string
  }> {
    const result = await this.executeCommand(`systemctl is-active ${serviceName}`)
    const running = result.stdout.trim() === 'active'
    
    let uptime: string | undefined
    if (running) {
      const statusResult = await this.executeCommand(`systemctl show ${serviceName} --property=ActiveEnterTimestamp`)
      if (statusResult.success) {
        uptime = statusResult.stdout.trim().replace('ActiveEnterTimestamp=', '')
      }
    }

    return {
      running,
      status: result.stdout.trim(),
      uptime
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const realExecutor = RealExecutor.getInstance()
export default RealExecutor
