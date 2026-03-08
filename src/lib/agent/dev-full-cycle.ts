/**
 * CLAWDEV Dev Full Cycle - Agente de Desenvolvimento Autônomo REAL
 * 
 * Sistema completo de desenvolvimento autônomo:
 * - Criar features do zero
 * - Corrigir bugs automaticamente
 * - Refatorar código
 * - Gerar testes
 * - Fazer commits e deploys
 * 
 * TUDO 100% REAL - Sem simulações!
 */

import { realExecutor } from './executor'
import { gitManager } from './git'
import { aiCoder, BugAnalysis } from './ai-coder'
import { testRunner, TestResult, LintResult, TypeCheckResult } from './tester'
import { deployer, DeployResult } from './deployer'
import { db } from '@/lib/db'

// ============================================================================
// TYPES
// ============================================================================

export interface DevTask {
  id: string
  type: 'create' | 'fix' | 'refactor' | 'test' | 'document' | 'deploy' | 'optimize'
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  files?: string[]
  requirements?: string[]
  result?: DevTaskResult
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  error?: string
}

export interface DevTaskResult {
  success: boolean
  message: string
  filesChanged: string[]
  testsPassed: boolean
  deployed: boolean
  details: Record<string, unknown>
}

export interface ProjectHealth {
  score: number
  issues: {
    type: 'error' | 'warning' | 'suggestion'
    count: number
    details: string[]
  }[]
  recommendations: string[]
  lastCheck: Date
}

export interface DevCycleResult {
  task: DevTask
  steps: DevCycleStep[]
  totalDuration: number
  success: boolean
}

export interface DevCycleStep {
  phase: 'analyze' | 'plan' | 'implement' | 'test' | 'commit' | 'deploy'
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  duration?: number
  output?: string
  error?: string
}

// ============================================================================
// DEV FULL CYCLE CLASS
// ============================================================================

class DevFullCycle {
  private static instance: DevFullCycle
  private taskQueue: DevTask[] = []
  private currentTask: DevTask | null = null
  private isProcessing: boolean = false

  private constructor() {}

  static getInstance(): DevFullCycle {
    if (!DevFullCycle.instance) {
      DevFullCycle.instance = new DevFullCycle()
    }
    return DevFullCycle.instance
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Create a new feature from scratch - REAL implementation
   */
  async createFeature(description: string, files: string[]): Promise<DevCycleResult> {
    const task: DevTask = {
      id: `task-${Date.now()}`,
      type: 'create',
      status: 'pending',
      priority: 'high',
      description,
      files,
      createdAt: new Date()
    }

    return this.executeTask(task)
  }

  /**
   * Fix a bug - REAL bug fix
   */
  async fixBug(filePath: string, bugDescription: string): Promise<DevCycleResult> {
    const task: DevTask = {
      id: `task-${Date.now()}`,
      type: 'fix',
      status: 'pending',
      priority: 'high',
      description: `Fix bug in ${filePath}: ${bugDescription}`,
      files: [filePath],
      createdAt: new Date()
    }

    return this.executeTask(task)
  }

  /**
   * Auto-detect and fix all bugs - REAL auto-fix
   */
  async autoFixAll(): Promise<DevCycleResult[]> {
    const results: DevCycleResult[] = []

    // Scan all TypeScript files
    const files = await this.getProjectFiles()
    
    for (const file of files) {
      const analysis = await aiCoder.analyzeCode(file)
      
      if (analysis.found && analysis.bugs.length > 0) {
        for (const bug of analysis.bugs) {
          if (bug.severity === 'critical' || bug.severity === 'high') {
            const result = await this.fixBug(file, bug.description)
            results.push(result)
          }
        }
      }
    }

    return results
  }

  /**
   * Refactor code - REAL refactoring
   */
  async refactor(filePath: string, instructions: string): Promise<DevCycleResult> {
    const task: DevTask = {
      id: `task-${Date.now()}`,
      type: 'refactor',
      status: 'pending',
      priority: 'medium',
      description: `Refactor ${filePath}: ${instructions}`,
      files: [filePath],
      createdAt: new Date()
    }

    return this.executeTask(task)
  }

  /**
   * Generate tests for a file - REAL test generation
   */
  async generateTests(filePath: string): Promise<DevCycleResult> {
    const task: DevTask = {
      id: `task-${Date.now()}`,
      type: 'test',
      status: 'pending',
      priority: 'medium',
      description: `Generate tests for ${filePath}`,
      files: [filePath],
      createdAt: new Date()
    }

    return this.executeTask(task)
  }

  /**
   * Commit and deploy changes - REAL deployment
   */
  async commitAndDeploy(message: string): Promise<DevCycleResult> {
    const task: DevTask = {
      id: `task-${Date.now()}`,
      type: 'deploy',
      status: 'pending',
      priority: 'high',
      description: `Deploy: ${message}`,
      createdAt: new Date()
    }

    return this.executeTask(task)
  }

  /**
   * Analyze project health - REAL analysis
   */
  async analyzeProjectHealth(): Promise<ProjectHealth> {
    const issues: ProjectHealth['issues'] = []
    const recommendations: string[] = []
    let score = 100

    // Run all checks in parallel
    const [lintResult, typeCheckResult, testResult] = await Promise.all([
      testRunner.runLint(),
      testRunner.typeCheck(),
      testRunner.runTests()
    ])

    // Lint issues
    if (lintResult.errors > 0 || lintResult.warnings > 0) {
      issues.push({
        type: lintResult.errors > 0 ? 'error' : 'warning',
        count: lintResult.errors + lintResult.warnings,
        details: lintResult.issues.slice(0, 10).map(i => `${i.file}:${i.line} - ${i.message}`)
      })
      score -= lintResult.errors * 5
      score -= lintResult.warnings * 2
      
      if (lintResult.errors > 0) {
        recommendations.push('Fix lint errors before deploying')
      }
    }

    // Type check issues
    if (typeCheckResult.errors.length > 0) {
      issues.push({
        type: 'error',
        count: typeCheckResult.errors.length,
        details: typeCheckResult.errors.slice(0, 10).map(e => `${e.file}:${e.line} - ${e.message}`)
      })
      score -= typeCheckResult.errors.length * 10
      recommendations.push('Fix TypeScript errors')
    }

    // Test issues
    if (!testResult.success) {
      issues.push({
        type: 'error',
        count: testResult.failed,
        details: testResult.failures.slice(0, 5).map(f => `${f.test}: ${f.message}`)
      })
      score -= testResult.failed * 15
      recommendations.push('Fix failing tests')
    }

    // Check for uncommitted changes
    const gitStatus = await gitManager.getStatus()
    if (!gitStatus.clean) {
      issues.push({
        type: 'warning',
        count: gitStatus.modified.length + gitStatus.staged.length,
        details: ['There are uncommitted changes']
      })
      recommendations.push('Commit or stash pending changes')
    }

    // Check for missing tests
    const coverage = testResult.coverage
    if (coverage && coverage.lines < 80) {
      issues.push({
        type: 'suggestion',
        count: 100 - coverage.lines,
        details: [`Code coverage is ${coverage.lines}%`]
      })
      recommendations.push('Increase test coverage to at least 80%')
      score -= (80 - coverage.lines) / 2
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      recommendations,
      lastCheck: new Date()
    }
  }

  /**
   * Full development cycle - Complete autonomous development
   */
  async fullCycle(taskDescription: string): Promise<DevCycleResult> {
    // Analyze what needs to be done
    const task: DevTask = {
      id: `task-${Date.now()}`,
      type: 'create',
      status: 'pending',
      priority: 'high',
      description: taskDescription,
      createdAt: new Date()
    }

    return this.executeTask(task)
  }

  // ============================================================================
  // TASK EXECUTION
  // ============================================================================

  private async executeTask(task: DevTask): Promise<DevCycleResult> {
    const startTime = Date.now()
    const steps: DevCycleStep[] = []
    task.status = 'in_progress'
    task.startedAt = new Date()
    this.currentTask = task

    try {
      // PHASE 1: ANALYZE
      steps.push({ phase: 'analyze', status: 'running' })
      const analysis = await this.analyzeTask(task)
      steps[0].status = 'success'
      steps[0].output = JSON.stringify(analysis)

      // PHASE 2: PLAN
      steps.push({ phase: 'plan', status: 'running' })
      const plan = await this.planTask(task, analysis)
      steps[1].status = 'success'
      steps[1].output = JSON.stringify(plan)

      // PHASE 3: IMPLEMENT
      steps.push({ phase: 'implement', status: 'running' })
      const implementation = await this.implementTask(task, plan)
      if (!implementation.success) {
        steps[2].status = 'failed'
        steps[2].error = implementation.error
        throw new Error(implementation.error || 'Implementation failed')
      }
      steps[2].status = 'success'
      steps[2].output = `Modified ${implementation.filesChanged.length} files`

      // PHASE 4: TEST
      steps.push({ phase: 'test', status: 'running' })
      const testResults = await this.runTestsForTask(task)
      if (!testResults.success) {
        steps[3].status = 'failed'
        steps[3].error = `${testResults.failed} tests failed`
        // Try to auto-fix tests
        await this.autoFixTests(testResults)
        // Re-run tests
        const retryResults = await testRunner.runTests()
        if (retryResults.success) {
          steps[3].status = 'success'
          steps[3].output = 'Tests fixed automatically'
        } else {
          throw new Error('Tests failed after auto-fix attempt')
        }
      } else {
        steps[3].status = 'success'
        steps[3].output = `${testResults.passed} tests passed`
      }

      // PHASE 5: COMMIT
      steps.push({ phase: 'commit', status: 'running' })
      const commitResult = await gitManager.addAndCommit(
        `${task.type}: ${task.description.substring(0, 50)}`
      )
      if (!commitResult.success) {
        steps[4].status = 'skipped'
        steps[4].output = 'No changes to commit'
      } else {
        steps[4].status = 'success'
        steps[4].output = `Commit: ${commitResult.commitHash}`
      }

      // PHASE 6: DEPLOY
      if (task.priority === 'high' || task.priority === 'critical') {
        steps.push({ phase: 'deploy', status: 'running' })
        const deployResult = await deployer.quickDeploy()
        if (deployResult.success) {
          steps[5].status = 'success'
          steps[5].output = `Deployed version ${deployResult.version}`
        } else {
          steps[5].status = 'failed'
          steps[5].error = deployResult.error
        }
      } else {
        steps.push({ phase: 'deploy', status: 'skipped' })
      }

      task.status = 'completed'
      task.completedAt = new Date()
      task.result = {
        success: true,
        message: 'Task completed successfully',
        filesChanged: implementation.filesChanged,
        testsPassed: true,
        deployed: steps[5]?.status === 'success',
        details: { steps: steps.map(s => s.status) }
      }

    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : 'Unknown error'
      task.result = {
        success: false,
        message: task.error,
        filesChanged: [],
        testsPassed: false,
        deployed: false,
        details: { error: task.error }
      }
    }

    this.currentTask = null

    return {
      task,
      steps,
      totalDuration: Date.now() - startTime,
      success: task.status === 'completed'
    }
  }

  // ============================================================================
  // TASK PHASES
  // ============================================================================

  private async analyzeTask(task: DevTask): Promise<Record<string, unknown>> {
    const analysis: Record<string, unknown> = {}

    switch (task.type) {
      case 'fix':
        // Analyze the bug
        if (task.files && task.files.length > 0) {
          const codeAnalysis = await aiCoder.analyzeCode(task.files[0])
          analysis['bugs'] = codeAnalysis.bugs
          analysis['severity'] = codeAnalysis.bugs[0]?.severity || 'unknown'
        }
        break

      case 'create':
        // Analyze requirements
        analysis['requirements'] = task.requirements || []
        analysis['filesNeeded'] = task.files || []
        break

      case 'refactor':
        // Analyze code quality
        if (task.files && task.files.length > 0) {
          const review = await aiCoder.reviewCode(task.files[0])
          analysis['review'] = review
        }
        break

      case 'deploy':
        // Check deployment readiness
        const health = await this.analyzeProjectHealth()
        analysis['health'] = health
        break
    }

    return analysis
  }

  private async planTask(
    task: DevTask, 
    analysis: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const plan: Record<string, unknown> = {
      approach: '',
      steps: [],
      estimatedChanges: 0
    }

    switch (task.type) {
      case 'fix':
        plan['approach'] = 'ai-assisted-fix'
        plan['steps'] = [
          'Analyze bug cause',
          'Generate fix with AI',
          'Apply fix',
          'Verify fix'
        ]
        plan['estimatedChanges'] = 1
        break

      case 'create':
        plan['approach'] = 'ai-code-generation'
        plan['steps'] = [
          'Design architecture',
          'Generate code',
          'Create tests',
          'Integrate with existing code'
        ]
        plan['estimatedChanges'] = task.files?.length || 1
        break

      case 'refactor':
        plan['approach'] = 'ai-refactoring'
        plan['steps'] = [
          'Identify improvement areas',
          'Apply refactoring patterns',
          'Ensure functionality preserved',
          'Update tests'
        ]
        plan['estimatedChanges'] = 1
        break

      case 'deploy':
        plan['approach'] = 'standard-deploy'
        plan['steps'] = [
          'Run pre-deploy checks',
          'Build application',
          'Deploy to VPS',
          'Verify health'
        ]
        plan['estimatedChanges'] = 0
        break
    }

    return plan
  }

  private async implementTask(
    task: DevTask,
    plan: Record<string, unknown>
  ): Promise<{ success: boolean; filesChanged: string[]; error?: string }> {
    const filesChanged: string[] = []

    try {
      switch (task.type) {
        case 'fix': {
          if (!task.files || task.files.length === 0) {
            return { success: false, filesChanged: [], error: 'No file specified' }
          }
          
          const result = await aiCoder.fixBug(task.files[0], task.description)
          if (result.success) {
            filesChanged.push(task.files[0])
          }
          return { success: result.success, filesChanged, error: result.error }
        }

        case 'create': {
          if (!task.files || task.files.length === 0) {
            return { success: false, filesChanged: [], error: 'No files specified' }
          }
          
          const result = await aiCoder.createFeature(
            task.description,
            task.description,
            task.files
          )
          if (result.success && result.files) {
            filesChanged.push(...result.files.map(f => f.path))
          }
          return { success: result.success, filesChanged, error: result.error }
        }

        case 'refactor': {
          if (!task.files || task.files.length === 0) {
            return { success: false, filesChanged: [], error: 'No file specified' }
          }
          
          const result = await aiCoder.refactor(task.files[0], task.description)
          if (result.success) {
            filesChanged.push(task.files[0])
          }
          return { success: result.success, filesChanged, error: result.error }
        }

        case 'test': {
          if (!task.files || task.files.length === 0) {
            return { success: false, filesChanged: [], error: 'No file specified' }
          }
          
          const result = await aiCoder.generateTests(task.files[0])
          if (result.success && result.files) {
            filesChanged.push(...result.files.map(f => f.path))
          }
          return { success: result.success, filesChanged, error: result.error }
        }

        case 'deploy': {
          const result = await deployer.quickDeploy()
          return { success: result.success, filesChanged: [], error: result.error }
        }

        default:
          return { success: false, filesChanged: [], error: 'Unknown task type' }
      }
    } catch (error) {
      return {
        success: false,
        filesChanged,
        error: error instanceof Error ? error.message : 'Implementation failed'
      }
    }
  }

  private async runTestsForTask(task: DevTask): Promise<TestResult> {
    // Run relevant tests
    if (task.files && task.files.length > 0) {
      // Run tests for specific files
      const testPatterns = task.files.map(f => {
        const baseName = f.replace(/\.[^.]+$/, '')
        return `**/${baseName}.test.*`
      })
      
      // For now, run all tests
      return testRunner.runTests()
    }

    return testRunner.runTests()
  }

  private async autoFixTests(testResults: TestResult): Promise<void> {
    // Try to auto-fix failing tests
    for (const failure of testResults.failures) {
      if (failure.file) {
        try {
          await aiCoder.fixBug(failure.file, `Test failing: ${failure.message}`)
        } catch {
          // Ignore fix failures
        }
      }
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async getProjectFiles(): Promise<string[]> {
    const result = await realExecutor.listFiles('src')
    if (!result.success) return []

    const files: string[] = []
    
    const scanDir = async (dir: string) => {
      const listResult = await realExecutor.listFiles(dir)
      if (!listResult.success) return

      for (const file of listResult.files) {
        const fullPath = `${dir}/${file}`
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          files.push(fullPath)
        }
        // Check if it's a directory
        if (!file.includes('.')) {
          await scanDir(fullPath)
        }
      }
    }

    for (const file of result.files) {
      const fullPath = `src/${file}`
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        files.push(fullPath)
      }
      if (!file.includes('.')) {
        await scanDir(fullPath)
      }
    }

    return files
  }

  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Add task to queue
   */
  addToQueue(task: Omit<DevTask, 'id' | 'status' | 'createdAt'>): string {
    const fullTask: DevTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      status: 'pending',
      createdAt: new Date()
    }
    this.taskQueue.push(fullTask)
    return fullTask.id
  }

  /**
   * Process queue
   */
  async processQueue(): Promise<DevCycleResult[]> {
    if (this.isProcessing) return []

    this.isProcessing = true
    const results: DevCycleResult[] = []

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!
      const result = await this.executeTask(task)
      results.push(result)
    }

    this.isProcessing = false
    return results
  }

  /**
   * Get current task
   */
  getCurrentTask(): DevTask | null {
    return this.currentTask
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { pending: number; processing: boolean; currentTask: DevTask | null } {
    return {
      pending: this.taskQueue.length,
      processing: this.isProcessing,
      currentTask: this.currentTask
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const devFullCycle = DevFullCycle.getInstance()
export default DevFullCycle
