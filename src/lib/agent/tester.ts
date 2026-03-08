/**
 * CLAWDEV Test Runner - Execução de Testes REAL
 * 
 * Sistema completo de execução de testes:
 * - Jest, Vitest, Bun Test
 * - Coverage reports
 * - Lint checks
 * - Type checking
 * - E2E tests
 * 
 * TUDO REAL - Sem simulações!
 */

import { realExecutor, ExecutionResult } from './executor'
import { db } from '@/lib/db'

// ============================================================================
// TYPES
// ============================================================================

export interface TestResult {
  success: boolean
  passed: number
  failed: number
  skipped: number
  total: number
  duration: number
  coverage?: {
    lines: number
    statements: number
    branches: number
    functions: number
  }
  failures: TestFailure[]
  output: string
}

export interface TestFailure {
  file: string
  test: string
  message: string
  stack?: string
  line?: number
  column?: number
}

export interface LintResult {
  success: boolean
  errors: number
  warnings: number
  issues: LintIssue[]
  output: string
}

export interface LintIssue {
  file: string
  line: number
  column: number
  severity: 'error' | 'warning'
  rule: string
  message: string
}

export interface TypeCheckResult {
  success: boolean
  errors: TypeCheckError[]
  output: string
}

export interface TypeCheckError {
  file: string
  line: number
  column: number
  message: string
  code: string
}

export interface BuildResult {
  success: boolean
  output: string
  errors: string[]
  warnings: string[]
  duration: number
  size?: {
    total: number
    files: { path: string; size: number }[]
  }
}

// ============================================================================
// TEST RUNNER CLASS
// ============================================================================

class TestRunner {
  private static instance: TestRunner
  private projectPath: string = process.cwd()

  private constructor() {}

  static getInstance(): TestRunner {
    if (!TestRunner.instance) {
      TestRunner.instance = new TestRunner()
    }
    return TestRunner.instance
  }

  setProjectPath(path: string): void {
    this.projectPath = path
  }

  // ============================================================================
  // TEST EXECUTION
  // ============================================================================

  /**
   * Run tests with Bun
   */
  async runBunTests(pattern?: string): Promise<TestResult> {
    const cmd = pattern 
      ? `bun test ${pattern}`
      : 'bun test'
    
    const result = await realExecutor.executeCommand(cmd, this.projectPath)
    return this.parseBunTestOutput(result)
  }

  /**
   * Run tests with Jest
   */
  async runJest(pattern?: string, coverage: boolean = true): Promise<TestResult> {
    const coverageFlag = coverage ? '--coverage' : ''
    const cmd = pattern 
      ? `npx jest ${pattern} ${coverageFlag} --json`
      : `npx jest ${coverageFlag} --json`
    
    const result = await realExecutor.executeCommand(cmd, this.projectPath)
    return this.parseJestOutput(result)
  }

  /**
   * Run tests with Vitest
   */
  async runVitest(pattern?: string, coverage: boolean = true): Promise<TestResult> {
    const coverageFlag = coverage ? '--coverage' : ''
    const cmd = pattern 
      ? `npx vitest run ${pattern} ${coverageFlag}`
      : `npx vitest run ${coverageFlag}`
    
    const result = await realExecutor.executeCommand(cmd, this.projectPath)
    return this.parseVitestOutput(result)
  }

  /**
   * Auto-detect and run tests
   */
  async runTests(options?: { 
    pattern?: string
    coverage?: boolean
    type?: 'bun' | 'jest' | 'vitest' | 'auto'
  }): Promise<TestResult> {
    const type = options?.type || 'auto'
    const coverage = options?.coverage ?? true
    const pattern = options?.pattern

    // Auto-detect test framework
    if (type === 'auto') {
      const detectedType = await this.detectTestFramework()
      switch (detectedType) {
        case 'bun':
          return this.runBunTests(pattern)
        case 'vitest':
          return this.runVitest(pattern, coverage)
        case 'jest':
        default:
          return this.runJest(pattern, coverage)
      }
    }

    switch (type) {
      case 'bun':
        return this.runBunTests(pattern)
      case 'vitest':
        return this.runVitest(pattern, coverage)
      case 'jest':
      default:
        return this.runJest(pattern, coverage)
    }
  }

  /**
   * Run a single test file
   */
  async runTestFile(filePath: string): Promise<TestResult> {
    return this.runTests({ pattern: filePath })
  }

  // ============================================================================
  // LINT
  // ============================================================================

  /**
   * Run ESLint
   */
  async runLint(pattern?: string, fix: boolean = false): Promise<LintResult> {
    const fixFlag = fix ? '--fix' : ''
    const patternArg = pattern || '.'
    const cmd = `npx eslint ${patternArg} ${fixFlag} --format json`
    
    const result = await realExecutor.executeCommand(cmd, this.projectPath)
    return this.parseLintOutput(result)
  }

  /**
   * Run lint and auto-fix
   */
  async lintAndFix(pattern?: string): Promise<LintResult> {
    return this.runLint(pattern, true)
  }

  // ============================================================================
  // TYPE CHECKING
  // ============================================================================

  /**
   * Run TypeScript type checking
   */
  async typeCheck(): Promise<TypeCheckResult> {
    const result = await realExecutor.executeCommand('npx tsc --noEmit', this.projectPath)
    return this.parseTypeCheckOutput(result)
  }

  /**
   * Run strict type checking
   */
  async strictTypeCheck(): Promise<TypeCheckResult> {
    const result = await realExecutor.executeCommand('npx tsc --noEmit --strict', this.projectPath)
    return this.parseTypeCheckOutput(result)
  }

  // ============================================================================
  // BUILD
  // ============================================================================

  /**
   * Run build
   */
  async build(): Promise<BuildResult> {
    const startTime = Date.now()
    
    // Try different build commands
    const buildCommands = [
      'bun run build',
      'npm run build',
      'next build'
    ]

    let result: ExecutionResult | null = null
    
    for (const cmd of buildCommands) {
      result = await realExecutor.executeCommand(cmd, this.projectPath)
      if (result.success) break
    }

    const duration = Date.now() - startTime

    if (!result) {
      return {
        success: false,
        output: '',
        errors: ['No build command found'],
        warnings: [],
        duration
      }
    }

    return this.parseBuildOutput(result, duration)
  }

  /**
   * Run production build with all checks
   */
  async productionBuild(): Promise<{
    lint: LintResult
    typeCheck: TypeCheckResult
    build: BuildResult
    success: boolean
  }> {
    const [lintResult, typeCheckResult, buildResult] = await Promise.all([
      this.runLint(),
      this.typeCheck(),
      this.build()
    ])

    return {
      lint: lintResult,
      typeCheck: typeCheckResult,
      build: buildResult,
      success: lintResult.success && typeCheckResult.success && buildResult.success
    }
  }

  // ============================================================================
  // QUALITY CHECKS
  // ============================================================================

  /**
   * Run all quality checks
   */
  async runAllChecks(): Promise<{
    tests: TestResult
    lint: LintResult
    typeCheck: TypeCheckResult
    build: BuildResult
    overall: {
      success: boolean
      score: number
      issues: string[]
    }
  }> {
    const [tests, lint, typeCheck, build] = await Promise.all([
      this.runTests(),
      this.runLint(),
      this.typeCheck(),
      this.build()
    ])

    // Calculate overall score
    let score = 100
    const issues: string[] = []

    if (!tests.success) {
      score -= 30
      issues.push(`${tests.failed} test(s) failed`)
    }
    if (!lint.success) {
      score -= 20
      issues.push(`${lint.errors} lint error(s)`)
    }
    if (!typeCheck.success) {
      score -= 25
      issues.push(`${typeCheck.errors.length} type error(s)`)
    }
    if (!build.success) {
      score -= 25
      issues.push('Build failed')
    }

    // Log results
    await this.logTestResults({ tests, lint, typeCheck, build })

    return {
      tests,
      lint,
      typeCheck,
      build,
      overall: {
        success: tests.success && lint.success && typeCheck.success && build.success,
        score: Math.max(0, score),
        issues
      }
    }
  }

  /**
   * Quick quality check (lint + type check only)
   */
  async quickCheck(): Promise<{
    lint: LintResult
    typeCheck: TypeCheckResult
    success: boolean
  }> {
    const [lint, typeCheck] = await Promise.all([
      this.runLint(),
      this.typeCheck()
    ])

    return {
      lint,
      typeCheck,
      success: lint.success && typeCheck.success
    }
  }

  // ============================================================================
  // PARSERS
  // ============================================================================

  private parseBunTestOutput(result: ExecutionResult): TestResult {
    const output = result.stdout + result.stderr
    const failures: TestFailure[] = []

    // Parse Bun test output
    const passMatch = output.match(/(\d+) tests? passed/i)
    const failMatch = output.match(/(\d+) tests? failed/i)
    const skipMatch = output.match(/(\d+) tests? skipped/i)

    const passed = passMatch ? parseInt(passMatch[1]) : 0
    const failed = failMatch ? parseInt(failMatch[1]) : 0
    const skipped = skipMatch ? parseInt(skipMatch[1]) : 0

    // Parse failure details
    const failureRegex = /✗ (.+?)\n\s+error: (.+?)(?:\n|$)/gi
    let match
    while ((match = failureRegex.exec(output)) !== null) {
      failures.push({
        file: 'unknown',
        test: match[1],
        message: match[2]
      })
    }

    return {
      success: result.success && failed === 0,
      passed,
      failed,
      skipped,
      total: passed + failed + skipped,
      duration: result.duration,
      failures,
      output
    }
  }

  private parseJestOutput(result: ExecutionResult): TestResult {
    const output = result.stdout + result.stderr
    const failures: TestFailure[] = []

    try {
      // Try to parse JSON output
      const jsonMatch = output.match(/\{[\s\S]*"success"[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          success: data.success,
          passed: data.numPassedTests || 0,
          failed: data.numFailedTests || 0,
          skipped: data.numPendingTests || 0,
          total: data.numTotalTests || 0,
          duration: (data.testResults || []).reduce((sum: number, r: { duration?: number }) => sum + (r.duration || 0), 0),
          failures: [],
          output
        }
      }
    } catch {
      // Fall back to regex parsing
    }

    // Parse from text output
    const passMatch = output.match(/Tests:\s+(\d+) passed/i) || output.match(/(\d+) passing/i)
    const failMatch = output.match(/(\d+) failed/i)
    const skipMatch = output.match(/(\d+) skipped/i)

    const passed = passMatch ? parseInt(passMatch[1]) : 0
    const failed = failMatch ? parseInt(failMatch[1]) : 0
    const skipped = skipMatch ? parseInt(skipMatch[1]) : 0

    return {
      success: result.success && failed === 0,
      passed,
      failed,
      skipped,
      total: passed + failed + skipped,
      duration: result.duration,
      failures,
      output
    }
  }

  private parseVitestOutput(result: ExecutionResult): TestResult {
    // Vitest output is similar to Jest
    return this.parseJestOutput(result)
  }

  private parseLintOutput(result: ExecutionResult): LintResult {
    const output = result.stdout + result.stderr
    const issues: LintIssue[] = []

    try {
      // Try to parse JSON output
      const jsonMatch = output.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        for (const fileResult of data) {
          for (const msg of fileResult.messages || []) {
            issues.push({
              file: fileResult.filePath,
              line: msg.line,
              column: msg.column,
              severity: msg.severity === 2 ? 'error' : 'warning',
              rule: msg.ruleId,
              message: msg.message
            })
          }
        }
      }
    } catch {
      // Fall back to text parsing
    }

    const errors = issues.filter(i => i.severity === 'error').length
    const warnings = issues.filter(i => i.severity === 'warning').length

    return {
      success: result.success && errors === 0,
      errors,
      warnings,
      issues,
      output
    }
  }

  private parseTypeCheckOutput(result: ExecutionResult): TypeCheckResult {
    const output = result.stdout + result.stderr
    const errors: TypeCheckError[] = []

    // Parse TypeScript error format
    const errorRegex = /(.+?)\((\d+),(\d+)\):\s+error\s+(\w+):\s+(.+?)(?:\n|$)/gi
    let match
    while ((match = errorRegex.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5]
      })
    }

    return {
      success: result.success && errors.length === 0,
      errors,
      output
    }
  }

  private parseBuildOutput(result: ExecutionResult, duration: number): BuildResult {
    const output = result.stdout + result.stderr
    const errors: string[] = []
    const warnings: string[] = []

    // Extract errors
    const errorRegex = /Error:\s*(.+?)(?:\n|$)/gi
    let match
    while ((match = errorRegex.exec(output)) !== null) {
      errors.push(match[1])
    }

    // Extract warnings
    const warningRegex = /Warning:\s*(.+?)(?:\n|$)/gi
    while ((match = warningRegex.exec(output)) !== null) {
      warnings.push(match[1])
    }

    return {
      success: result.success,
      output,
      errors,
      warnings,
      duration
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async detectTestFramework(): Promise<'bun' | 'jest' | 'vitest'> {
    // Check for vitest config
    const vitestConfig = await realExecutor.fileExists('vitest.config.ts')
    if (vitestConfig) return 'vitest'

    // Check for jest config
    const jestConfig = await realExecutor.fileExists('jest.config.js') || 
                       await realExecutor.fileExists('jest.config.ts')
    if (jestConfig) return 'jest'

    // Check package.json for test script
    const pkgResult = await realExecutor.readFile('package.json')
    if (pkgResult.success) {
      try {
        const pkg = JSON.parse(pkgResult.content)
        const testScript = pkg.scripts?.test || ''
        if (testScript.includes('vitest')) return 'vitest'
        if (testScript.includes('jest')) return 'jest'
        if (testScript.includes('bun test')) return 'bun'
      } catch {
        // Ignore parse errors
      }
    }

    // Default to bun
    return 'bun'
  }

  private async logTestResults(results: {
    tests: TestResult
    lint: LintResult
    typeCheck: TypeCheckResult
    build: BuildResult
  }): Promise<void> {
    try {
      await db.log.create({
        data: {
          level: results.tests.success && results.lint.success ? 'INFO' : 'WARN',
          message: `Quality check: tests=${results.tests.passed}/${results.tests.total}, lint=${results.lint.errors} errors, types=${results.typeCheck.errors.length} errors`,
          source: 'test-runner',
          metadata: JSON.stringify({
            tests: { passed: results.tests.passed, failed: results.tests.failed },
            lint: { errors: results.lint.errors, warnings: results.lint.warnings },
            typeCheck: { errors: results.typeCheck.errors.length },
            build: { success: results.build.success, duration: results.build.duration }
          })
        }
      })
    } catch {
      // Ignore logging errors
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const testRunner = TestRunner.getInstance()
export default TestRunner
