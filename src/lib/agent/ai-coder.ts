/**
 * CLAWDEV AI Coder - Geração de Código com AI REAL
 * 
 * Sistema de geração de código usando Z.AI:
 * - Criar arquivos e componentes
 * - Corrigir bugs automaticamente
 * - Refatorar código
 * - Gerar testes
 * - Documentar código
 * 
 * TUDO REAL - Usa Z.AI API!
 */

import ZAI from 'z-ai-web-dev-sdk'
import { realExecutor } from './executor'
import { gitManager } from './git'
import { db } from '@/lib/db'

// ============================================================================
// TYPES
// ============================================================================

export interface CodeGenerationRequest {
  type: 'create' | 'fix' | 'refactor' | 'test' | 'document' | 'optimize'
  language: 'typescript' | 'javascript' | 'python' | 'bash' | 'sql' | 'css' | 'html'
  context: string
  file?: string
  requirements?: string[]
  existingCode?: string
}

export interface CodeGenerationResult {
  success: boolean
  code?: string
  explanation?: string
  files?: { path: string; content: string }[]
  changes?: { file: string; action: 'created' | 'modified' | 'deleted'; lines: number }[]
  error?: string
  tokensUsed?: number
}

export interface BugAnalysis {
  found: boolean
  bugs: {
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    file: string
    line?: number
    description: string
    suggestion: string
    fix?: string
  }[]
  summary: string
}

export interface CodeReview {
  score: number
  issues: {
    type: 'error' | 'warning' | 'suggestion'
    line?: number
    message: string
    suggestion?: string
  }[]
  improvements: string[]
  securityIssues: string[]
}

// ============================================================================
// AI CODER CLASS
// ============================================================================

class AICoder {
  private static instance: AICoder
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null
  private initialized: boolean = false

  private constructor() {}

  static getInstance(): AICoder {
    if (!AICoder.instance) {
      AICoder.instance = new AICoder()
    }
    return AICoder.instance
  }

  /**
   * Initialize Z.AI client
   */
  private async init(): Promise<void> {
    if (this.initialized) return

    try {
      this.zai = await ZAI.create()
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize Z.AI:', error)
      throw error
    }
  }

  /**
   * Ensure Z.AI is initialized
   */
  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init()
    }
    if (!this.zai) {
      throw new Error('Z.AI not initialized')
    }
  }

  // ============================================================================
  // CODE GENERATION
  // ============================================================================

  /**
   * Generate code based on request
   */
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    await this.ensureInit()

    try {
      const prompt = this.buildPrompt(request)
      
      const completion = await this.zai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.type, request.language)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more deterministic code
        max_tokens: 4000
      })

      const response = completion.choices[0]?.message?.content || ''
      
      // Parse the response
      const result = this.parseCodeResponse(response, request)
      
      // Log the generation
      await this.logGeneration(request, result)
      
      return result

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during code generation'
      }
    }
  }

  /**
   * Create a new file with generated code
   */
  async createFile(
    filePath: string, 
    description: string, 
    language: CodeGenerationRequest['language'] = 'typescript'
  ): Promise<CodeGenerationResult> {
    const result = await this.generateCode({
      type: 'create',
      language,
      context: `Create a new file: ${filePath}`,
      requirements: [description]
    })

    if (result.success && result.code) {
      const writeResult = await realExecutor.writeFile(filePath, result.code)
      if (!writeResult.success) {
        return { success: false, error: `Failed to write file: ${writeResult.error}` }
      }
      result.files = [{ path: filePath, content: result.code }]
    }

    return result
  }

  /**
   * Fix a bug in code
   */
  async fixBug(filePath: string, bugDescription: string): Promise<CodeGenerationResult> {
    // Read the current file
    const fileContent = await realExecutor.readFile(filePath)
    
    if (!fileContent.success) {
      return { success: false, error: `Failed to read file: ${fileContent.error}` }
    }

    const result = await this.generateCode({
      type: 'fix',
      language: this.detectLanguage(filePath),
      context: `Fix bug in ${filePath}: ${bugDescription}`,
      file: filePath,
      existingCode: fileContent.content
    })

    if (result.success && result.code) {
      const writeResult = await realExecutor.writeFile(filePath, result.code)
      if (!writeResult.success) {
        return { success: false, error: `Failed to write fixed file: ${writeResult.error}` }
      }
      
      result.files = [{ path: filePath, content: result.code }]
      result.changes = [{ file: filePath, action: 'modified', lines: result.code.split('\n').length }]
    }

    return result
  }

  /**
   * Analyze code for bugs
   */
  async analyzeCode(filePath: string): Promise<BugAnalysis> {
    await this.ensureInit()

    const fileContent = await realExecutor.readFile(filePath)
    if (!fileContent.success) {
      return { found: false, bugs: [], summary: 'Could not read file' }
    }

    try {
      const completion = await this.zai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a senior code reviewer. Analyze code for bugs, issues, and potential problems.
Output your response as JSON with this structure:
{
  "found": boolean,
  "bugs": [
    {
      "type": "bug type",
      "severity": "low|medium|high|critical",
      "file": "filename",
      "line": number or null,
      "description": "what's wrong",
      "suggestion": "how to fix",
      "fix": "optional code fix"
    }
  ],
  "summary": "overall assessment"
}`
          },
          {
            role: 'user',
            content: `Analyze this code for bugs:\n\nFile: ${filePath}\n\n\`\`\`\n${fileContent.content}\n\`\`\``
          }
        ],
        temperature: 0.2
      })

      const response = completion.choices[0]?.message?.content || ''
      return this.parseBugAnalysis(response)

    } catch (error) {
      return { found: false, bugs: [], summary: `Analysis failed: ${error}` }
    }
  }

  /**
   * Review code quality
   */
  async reviewCode(filePath: string): Promise<CodeReview> {
    await this.ensureInit()

    const fileContent = await realExecutor.readFile(filePath)
    if (!fileContent.success) {
      return {
        score: 0,
        issues: [{ type: 'error', message: 'Could not read file' }],
        improvements: [],
        securityIssues: []
      }
    }

    try {
      const completion = await this.zai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a senior code reviewer. Review code for quality, best practices, and security.
Output your response as JSON:
{
  "score": 0-100,
  "issues": [
    {
      "type": "error|warning|suggestion",
      "line": number or null,
      "message": "description",
      "suggestion": "how to fix"
    }
  ],
  "improvements": ["list of improvement suggestions"],
  "securityIssues": ["list of security concerns"]
}`
          },
          {
            role: 'user',
            content: `Review this code:\n\nFile: ${filePath}\n\n\`\`\`\n${fileContent.content}\n\`\`\``
          }
        ],
        temperature: 0.2
      })

      const response = completion.choices[0]?.message?.content || ''
      return this.parseCodeReview(response)

    } catch (error) {
      return {
        score: 0,
        issues: [{ type: 'error', message: `Review failed: ${error}` }],
        improvements: [],
        securityIssues: []
      }
    }
  }

  /**
   * Generate tests for a file
   */
  async generateTests(filePath: string): Promise<CodeGenerationResult> {
    const fileContent = await realExecutor.readFile(filePath)
    
    if (!fileContent.success) {
      return { success: false, error: `Failed to read file: ${fileContent.error}` }
    }

    const result = await this.generateCode({
      type: 'test',
      language: this.detectLanguage(filePath),
      context: `Generate tests for ${filePath}`,
      existingCode: fileContent.content
    })

    if (result.success && result.code) {
      // Determine test file path
      const testPath = this.getTestPath(filePath)
      const writeResult = await realExecutor.writeFile(testPath, result.code)
      
      if (!writeResult.success) {
        return { success: false, error: `Failed to write test file: ${writeResult.error}` }
      }
      
      result.files = [{ path: testPath, content: result.code }]
    }

    return result
  }

  /**
   * Generate documentation for a file
   */
  async generateDocs(filePath: string): Promise<CodeGenerationResult> {
    const fileContent = await realExecutor.readFile(filePath)
    
    if (!fileContent.success) {
      return { success: false, error: `Failed to read file: ${fileContent.error}` }
    }

    const result = await this.generateCode({
      type: 'document',
      language: this.detectLanguage(filePath),
      context: `Generate documentation for ${filePath}`,
      existingCode: fileContent.content
    })

    return result
  }

  /**
   * Refactor code
   */
  async refactor(filePath: string, instructions: string): Promise<CodeGenerationResult> {
    const fileContent = await realExecutor.readFile(filePath)
    
    if (!fileContent.success) {
      return { success: false, error: `Failed to read file: ${fileContent.error}` }
    }

    const result = await this.generateCode({
      type: 'refactor',
      language: this.detectLanguage(filePath),
      context: `Refactor ${filePath}: ${instructions}`,
      existingCode: fileContent.content
    })

    if (result.success && result.code) {
      const writeResult = await realExecutor.writeFile(filePath, result.code)
      if (!writeResult.success) {
        return { success: false, error: `Failed to write refactored file: ${writeResult.error}` }
      }
      result.files = [{ path: filePath, content: result.code }]
    }

    return result
  }

  // ============================================================================
  // AUTONOMOUS OPERATIONS
  // ============================================================================

  /**
   * Auto-fix issues in a file
   */
  async autoFix(filePath: string): Promise<{ fixed: number; remaining: number; details: string[] }> {
    const details: string[] = []
    let fixed = 0

    // 1. Analyze for bugs
    const analysis = await this.analyzeCode(filePath)
    
    if (analysis.bugs.length > 0) {
      details.push(`Found ${analysis.bugs.length} issues`)
      
      // Fix critical and high severity bugs first
      const criticalBugs = analysis.bugs.filter(b => b.severity === 'critical' || b.severity === 'high')
      
      for (const bug of criticalBugs) {
        const fixResult = await this.fixBug(filePath, bug.description)
        if (fixResult.success) {
          fixed++
          details.push(`Fixed: ${bug.description}`)
        } else {
          details.push(`Failed to fix: ${bug.description}`)
        }
      }
    }

    // 2. Run linter
    const lintResult = await realExecutor.executeCommand(`bun run lint --fix ${filePath}`)
    if (lintResult.success) {
      details.push('Lint fixes applied')
    }

    return {
      fixed,
      remaining: analysis.bugs.length - fixed,
      details
    }
  }

  /**
   * Create a complete feature
   */
  async createFeature(
    featureName: string, 
    description: string,
    files: string[]
  ): Promise<CodeGenerationResult> {
    await this.ensureInit()

    const prompt = `Create a feature named "${featureName}" with the following description:
${description}

Create the following files:
${files.map(f => `- ${f}`).join('\n')}

For each file, provide the complete implementation.`

    try {
      const completion = await this.zai!.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an expert full-stack developer. Create complete, production-ready code.
Output code in this format:
=== FILE: path/to/file.ts ===
\`\`\`typescript
// code here
\`\`\`
=== END FILE ===

Repeat for each file. Include all imports, types, and error handling.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 8000
      })

      const response = completion.choices[0]?.message?.content || ''
      const createdFiles = this.parseMultipleFiles(response)
      
      // Write all files
      for (const file of createdFiles) {
        await realExecutor.writeFile(file.path, file.content)
      }

      return {
        success: true,
        files: createdFiles,
        explanation: `Created ${createdFiles.length} files for ${featureName}`
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getSystemPrompt(type: CodeGenerationRequest['type'], language: CodeGenerationRequest['language']): string {
    const basePrompts: Record<string, string> = {
      create: `You are an expert ${language} developer. Generate clean, well-documented, production-ready code.
Follow best practices, include proper error handling, and add comments where necessary.
Output ONLY the code, no explanations outside code blocks.`,
      
      fix: `You are an expert debugger. Fix the bug while maintaining code style and functionality.
Output the complete fixed code, not just the changes.`,
      
      refactor: `You are an expert code refactoring specialist. Improve code quality while maintaining functionality.
Apply design patterns, improve readability, and optimize performance.`,
      
      test: `You are an expert test engineer. Generate comprehensive tests using appropriate testing frameworks.
Include edge cases, error scenarios, and integration tests.`,
      
      document: `You are an expert technical writer. Generate clear, comprehensive documentation.
Include descriptions, parameters, return values, and examples.`,
      
      optimize: `You are an expert performance engineer. Optimize code for speed and memory efficiency.
Maintain functionality while improving performance.`
    }

    return basePrompts[type] || basePrompts.create
  }

  private buildPrompt(request: CodeGenerationRequest): string {
    let prompt = request.context

    if (request.requirements && request.requirements.length > 0) {
      prompt += `\n\nRequirements:\n${request.requirements.map(r => `- ${r}`).join('\n')}`
    }

    if (request.file) {
      prompt += `\n\nFile: ${request.file}`
    }

    if (request.existingCode) {
      prompt += `\n\nExisting code:\n\`\`\`\n${request.existingCode}\n\`\`\``
    }

    return prompt
  }

  private parseCodeResponse(response: string, request: CodeGenerationRequest): CodeGenerationResult {
    // Extract code from markdown code blocks
    const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/)
    const code = codeBlockMatch ? codeBlockMatch[1].trim() : response

    // Extract explanation (text outside code blocks)
    const explanation = response
      .replace(/```[\s\S]*?```/g, '')
      .trim()

    return {
      success: true,
      code,
      explanation
    }
  }

  private parseMultipleFiles(response: string): { path: string; content: string }[] {
    const files: { path: string; content: string }[] = []
    const fileRegex = /=== FILE: (.+?) ===\n```[\w]*\n([\s\S]*?)```\n=== END FILE ===/g

    let match
    while ((match = fileRegex.exec(response)) !== null) {
      files.push({
        path: match[1].trim(),
        content: match[2].trim()
      })
    }

    return files
  }

  private parseBugAnalysis(response: string): BugAnalysis {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // If parsing fails, return default
    }

    return { found: false, bugs: [], summary: 'Could not parse analysis' }
  }

  private parseCodeReview(response: string): CodeReview {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // If parsing fails, return default
    }

    return {
      score: 50,
      issues: [],
      improvements: [],
      securityIssues: []
    }
  }

  private detectLanguage(filePath: string): CodeGenerationRequest['language'] {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const langMap: Record<string, CodeGenerationRequest['language']> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      sh: 'bash',
      sql: 'sql',
      css: 'css',
      html: 'html'
    }
    return langMap[ext || ''] || 'typescript'
  }

  private getTestPath(filePath: string): string {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    const name = filePath.substring(filePath.lastIndexOf('/') + 1)
    const ext = name.split('.').pop()
    const baseName = name.replace(`.${ext}`, '')
    
    return `${dir}/__tests__/${baseName}.test.${ext}`
  }

  private async logGeneration(request: CodeGenerationRequest, result: CodeGenerationResult): Promise<void> {
    try {
      await db.log.create({
        data: {
          level: result.success ? 'INFO' : 'ERROR',
          message: `AI Code Generation: ${request.type}`,
          source: 'ai-coder',
          metadata: JSON.stringify({
            type: request.type,
            language: request.language,
            success: result.success,
            filesCreated: result.files?.length || 0
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

export const aiCoder = AICoder.getInstance()
export default AICoder
