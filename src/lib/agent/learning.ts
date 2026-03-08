/**
 * CLAWDEV Autonomous Learning System
 * 
 * Sistema de aprendizado autônomo que permite ao agente:
 * - Aprender com cada ação e resultado
 * - Identificar padrões automaticamente
 * - Melhorar própria performance
 * - Compartilhar conhecimento entre skills
 * - Auto-avaliar e auto-corrigir
 */

import { db } from '@/lib/db'
import { agentController } from './controller'

// ============================================================================
// TYPES
// ============================================================================

export interface LearningEntry {
  id: string
  type: 'success' | 'failure' | 'pattern' | 'insight' | 'correction' | 'optimization'
  category: 'code' | 'system' | 'browser' | 'api' | 'security' | 'performance' | 'general'
  context: string
  observation: string
  insight: string
  action: string
  result: string
  confidence: number // 0-100
  applicableTo: string[] // domains/situations where this applies
  relatedLearnings: string[]
  usageCount: number
  lastUsed: Date | null
  createdAt: Date
}

export interface Pattern {
  id: string
  name: string
  description: string
  frequency: number
  lastSeen: Date
  firstSeen: Date
  correlations: string[]
  outcomes: { positive: number; negative: number; neutral: number }
  significance: number // 0-100
  active: boolean
}

export interface Knowledge {
  facts: Map<string, string>
  rules: Map<string, (context: Record<string, unknown>) => boolean>
  patterns: Pattern[]
  confidence: Map<string, number>
}

export interface LearningConfig {
  enabled: boolean
  autoImprove: boolean
  minConfidenceThreshold: number
  maxLearningsPerDay: number
  patternDetectionEnabled: boolean
  crossReferenceEnabled: boolean
  forgettingEnabled: boolean
  forgettingThreshold: number // days
}

// ============================================================================
// LEARNING ENGINE
// ============================================================================

class LearningEngine {
  private static instance: LearningEngine
  private config: LearningConfig
  private knowledge: Knowledge
  private recentObservations: Array<{ context: string; observation: string; timestamp: Date }> = []
  private learningBuffer: LearningEntry[] = []
  private isProcessing: boolean = false

  private constructor() {
    this.config = {
      enabled: true,
      autoImprove: true,
      minConfidenceThreshold: 60,
      maxLearningsPerDay: 100,
      patternDetectionEnabled: true,
      crossReferenceEnabled: true,
      forgettingEnabled: true,
      forgettingThreshold: 30
    }

    this.knowledge = {
      facts: new Map(),
      rules: new Map(),
      patterns: [],
      confidence: new Map()
    }
  }

  static getInstance(): LearningEngine {
    if (!LearningEngine.instance) {
      LearningEngine.instance = new LearningEngine()
    }
    return LearningEngine.instance
  }

  // ============================================================================
  // CORE LEARNING METHODS
  // ============================================================================

  /**
   * Learn from an action and its outcome
   */
  async learn(params: {
    context: string
    observation: string
    action: string
    result: string
    category?: LearningEntry['category']
    confidence?: number
  }): Promise<LearningEntry> {
    const { context, observation, action, result, category = 'general', confidence = 70 } = params

    // Determine if this was a success or failure
    const type = this.determineType(result)

    // Generate insight using pattern recognition
    const insight = await this.generateInsight(context, observation, action, result)

    // Calculate confidence
    const calculatedConfidence = this.calculateConfidence(confidence, result)

    // Find related learnings
    const relatedLearnings = await this.findRelatedLearnings(context, observation)

    // Determine applicability
    const applicableTo = this.determineApplicability(context, category)

    // Create learning entry
    const entry: LearningEntry = {
      id: `learn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      category,
      context,
      observation,
      insight,
      action,
      result,
      confidence: calculatedConfidence,
      applicableTo,
      relatedLearnings,
      usageCount: 0,
      lastUsed: null,
      createdAt: new Date()
    }

    // Store in database
    await this.storeLearning(entry)

    // Add to buffer for pattern detection
    this.learningBuffer.push(entry)

    // Trigger pattern detection if buffer is large enough
    if (this.learningBuffer.length >= 10 && this.config.patternDetectionEnabled) {
      this.detectPatterns()
    }

    // Cross-reference with existing knowledge
    if (this.config.crossReferenceEnabled) {
      await this.crossReference(entry)
    }

    return entry
  }

  /**
   * Generate insight from observation and action
   */
  private async generateInsight(
    context: string,
    observation: string,
    action: string,
    result: string
  ): Promise<string> {
    // Check for similar past learnings
    const similarLearnings = await db.learning.findMany({
      where: {
        OR: [
          { insight: { contains: observation.substring(0, 30) } },
          { context: { contains: context.substring(0, 30) } }
        ]
      },
      take: 5
    })

    if (similarLearnings.length > 0) {
      // Build on existing insights
      const baseInsight = similarLearnings[0].insight
      return `${baseInsight} (reinforced: ${action} → ${result.substring(0, 50)})`
    }

    // Generate new insight
    const type = this.determineType(result)
    if (type === 'success') {
      return `SUCCESS: When ${context}, ${action} leads to ${result.substring(0, 100)}`
    } else if (type === 'failure') {
      return `AVOID: When ${context}, ${action} fails with: ${result.substring(0, 100)}`
    } else {
      return `PATTERN: In ${context}, observed ${observation}`
    }
  }

  /**
   * Calculate confidence based on result and history
   */
  private calculateConfidence(initialConfidence: number, result: string): number {
    let confidence = initialConfidence

    // Adjust based on result keywords
    if (result.toLowerCase().includes('success') || result.toLowerCase().includes('completed')) {
      confidence = Math.min(100, confidence + 10)
    }
    if (result.toLowerCase().includes('error') || result.toLowerCase().includes('failed')) {
      confidence = Math.max(0, confidence - 15)
    }
    if (result.toLowerCase().includes('timeout')) {
      confidence = Math.max(0, confidence - 20)
    }

    return confidence
  }

  /**
   * Find related learnings in the database
   */
  private async findRelatedLearnings(context: string, observation: string): Promise<string[]> {
    const keywords = this.extractKeywords(`${context} ${observation}`)

    const related = await db.learning.findMany({
      where: {
        OR: keywords.map(kw => ({
          insight: { contains: kw }
        }))
      },
      take: 5
    })

    return related.map(r => r.id)
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just'])

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10)
  }

  /**
   * Determine applicability domains
   */
  private determineApplicability(context: string, category: LearningEntry['category']): string[] {
    const domains: string[] = [category]

    // Add context-based domains
    if (context.includes('browser') || context.includes('page')) domains.push('browser')
    if (context.includes('api') || context.includes('request')) domains.push('api')
    if (context.includes('error') || context.includes('fail')) domains.push('error-handling')
    if (context.includes('deploy') || context.includes('container')) domains.push('deployment')

    return [...new Set(domains)]
  }

  /**
   * Determine learning type from result
   */
  private determineType(result: string): LearningEntry['type'] {
    const lowerResult = result.toLowerCase()

    if (lowerResult.includes('success') || lowerResult.includes('completed') || lowerResult.includes('fixed')) {
      return 'success'
    }
    if (lowerResult.includes('error') || lowerResult.includes('fail') || lowerResult.includes('unable')) {
      return 'failure'
    }
    if (lowerResult.includes('pattern') || lowerResult.includes('detected')) {
      return 'pattern'
    }
    if (lowerResult.includes('corrected') || lowerResult.includes('adjusted')) {
      return 'correction'
    }
    if (lowerResult.includes('optimized') || lowerResult.includes('improved')) {
      return 'optimization'
    }

    return 'insight'
  }

  // ============================================================================
  // PATTERN DETECTION
  // ============================================================================

  /**
   * Detect patterns from learning buffer
   */
  async detectPatterns(): Promise<Pattern[]> {
    if (this.isProcessing) return []

    this.isProcessing = true
    const detectedPatterns: Pattern[] = []

    try {
      // Group learnings by context similarity
      const contextGroups = this.groupBySimilarity(this.learningBuffer, 'context')

      for (const [contextKey, entries] of contextGroups) {
        if (entries.length < 3) continue

        // Analyze action-result patterns
        const actionResults = new Map<string, { success: number; failure: number }>()

        for (const entry of entries) {
          const key = entry.action.substring(0, 50)
          const current = actionResults.get(key) || { success: 0, failure: 0 }
          if (entry.type === 'success') current.success++
          if (entry.type === 'failure') current.failure++
          actionResults.set(key, current)
        }

        // Find significant patterns
        for (const [action, outcomes] of actionResults) {
          const total = outcomes.success + outcomes.failure
          if (total < 2) continue

          const successRate = (outcomes.success / total) * 100
          const significance = Math.abs(successRate - 50) * 2 // Higher if very good or very bad

          if (significance >= 40) {
            const pattern: Pattern = {
              id: `pattern-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: `Pattern: ${contextKey.substring(0, 30)}`,
              description: `When in context "${contextKey.substring(0, 50)}", action "${action.substring(0, 30)}" has ${successRate.toFixed(0)}% success rate`,
              frequency: total,
              lastSeen: new Date(),
              firstSeen: entries[0].createdAt,
              correlations: [],
              outcomes: {
                positive: outcomes.success,
                negative: outcomes.failure,
                neutral: 0
              },
              significance,
              active: true
            }

            detectedPatterns.push(pattern)
            await this.storePattern(pattern)
          }
        }
      }

      // Clear processed buffer
      this.learningBuffer = []
    } finally {
      this.isProcessing = false
    }

    // Update knowledge
    this.knowledge.patterns = [...this.knowledge.patterns, ...detectedPatterns]

    return detectedPatterns
  }

  /**
   * Group entries by similarity
   */
  private groupBySimilarity(
    entries: LearningEntry[],
    field: 'context' | 'action' | 'observation'
  ): Map<string, LearningEntry[]> {
    const groups = new Map<string, LearningEntry[]>()

    for (const entry of entries) {
      const value = entry[field]
      const keywords = this.extractKeywords(value)
      const key = keywords.slice(0, 3).join('-')

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(entry)
    }

    return groups
  }

  // ============================================================================
  // KNOWLEDGE RETRIEVAL
  // ============================================================================

  /**
   * Get relevant learnings for a context
   */
  async getRelevantLearnings(context: string, limit: number = 10): Promise<LearningEntry[]> {
    const keywords = this.extractKeywords(context)

    const learnings = await db.learning.findMany({
      where: {
        OR: keywords.map(kw => ({
          OR: [
            { insight: { contains: kw } },
            { context: { contains: kw } }
          ]
        }))
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    return learnings.map(l => ({
      id: l.id,
      type: this.determineTypeFromCategory(l.category),
      category: l.category as LearningEntry['category'],
      context: l.context || '',
      observation: l.insight,
      insight: l.insight,
      action: l.actionTaken || '',
      result: l.success ? 'Success' : 'Failure',
      confidence: l.success ? 80 : 50,
      applicableTo: [],
      relatedLearnings: [],
      usageCount: 0,
      lastUsed: null,
      createdAt: l.createdAt
    }))
  }

  /**
   * Get best action for a context
   */
  async getBestAction(context: string): Promise<string | null> {
    const learnings = await this.getRelevantLearnings(context, 20)

    // Filter successful learnings with high confidence
    const successful = learnings
      .filter(l => l.type === 'success' && l.confidence >= this.config.minConfidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)

    if (successful.length > 0) {
      return successful[0].action
    }

    return null
  }

  /**
   * Get actions to avoid for a context
   */
  async getActionsToAvoid(context: string): Promise<string[]> {
    const learnings = await this.getRelevantLearnings(context, 20)

    return learnings
      .filter(l => l.type === 'failure')
      .map(l => l.action)
      .slice(0, 5)
  }

  // ============================================================================
  // SELF-IMPROVEMENT
  // ============================================================================

  /**
   * Analyze own performance and suggest improvements
   */
  async analyzePerformance(): Promise<{
    strengths: string[]
    weaknesses: string[]
    suggestions: string[]
    overallScore: number
  }> {
    // Get recent learnings
    const recentLearnings = await db.learning.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' }
    })

    const successes = recentLearnings.filter(l => l.success).length
    const failures = recentLearnings.filter(l => !l.success).length
    const total = recentLearnings.length

    const successRate = total > 0 ? (successes / total) * 100 : 0

    // Analyze categories
    const categoryStats = new Map<string, { success: number; failure: number }>()
    for (const l of recentLearnings) {
      const cat = l.category || 'general'
      const stats = categoryStats.get(cat) || { success: 0, failure: 0 }
      if (l.success) stats.success++
      else stats.failure++
      categoryStats.set(cat, stats)
    }

    // Identify strengths and weaknesses
    const strengths: string[] = []
    const weaknesses: string[] = []

    for (const [category, stats] of categoryStats) {
      const total = stats.success + stats.failure
      const rate = total > 0 ? (stats.success / total) * 100 : 0

      if (rate >= 80) {
        strengths.push(`${category}: ${rate.toFixed(0)}% success rate`)
      } else if (rate < 50) {
        weaknesses.push(`${category}: only ${rate.toFixed(0)}% success rate`)
      }
    }

    // Generate suggestions
    const suggestions: string[] = []

    if (weaknesses.length > 0) {
      suggestions.push(`Focus on improving: ${weaknesses.join(', ')}`)
    }
    if (successRate < 70) {
      suggestions.push('Consider increasing learning interval for better analysis')
    }
    if (recentLearnings.length < 50) {
      suggestions.push('Need more learning data for accurate analysis')
    }

    // Store performance analysis as a learning
    await this.learn({
      context: 'self-analysis',
      observation: `Performance analyzed: ${successRate.toFixed(0)}% success rate`,
      action: 'analyzePerformance',
      result: `Strengths: ${strengths.length}, Weaknesses: ${weaknesses.length}`,
      category: 'general',
      confidence: 85
    })

    return {
      strengths,
      weaknesses,
      suggestions,
      overallScore: successRate
    }
  }

  /**
   * Clean up old, unused learnings
   */
  async cleanup(): Promise<number> {
    if (!this.config.forgettingEnabled) return 0

    const threshold = new Date()
    threshold.setDate(threshold.getDate() - this.config.forgettingThreshold)

    const result = await db.learning.deleteMany({
      where: {
        createdAt: { lt: threshold },
        // Keep successful learnings longer
        success: false
      }
    })

    return result.count
  }

  // ============================================================================
  // STORAGE
  // ============================================================================

  private async storeLearning(entry: LearningEntry): Promise<void> {
    await db.learning.create({
      data: {
        id: entry.id,
        insight: entry.insight,
        category: entry.category,
        context: entry.context,
        actionTaken: entry.action,
        success: entry.type === 'success' || entry.type === 'optimization'
      }
    })
  }

  private async storePattern(pattern: Pattern): Promise<void> {
    // Patterns are stored in memory and can be persisted to a dedicated table
    // For now, store as a learning entry
    await db.learning.create({
      data: {
        id: pattern.id,
        insight: pattern.description,
        category: 'pattern',
        context: pattern.name,
        success: pattern.outcomes.positive > pattern.outcomes.negative
      }
    })
  }

  private determineTypeFromCategory(category: string): LearningEntry['type'] {
    switch (category) {
      case 'error': return 'failure'
      case 'optimization': return 'optimization'
      case 'pattern': return 'pattern'
      default: return 'insight'
    }
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  updateConfig(updates: Partial<LearningConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  getConfig(): LearningConfig {
    return { ...this.config }
  }

  getPatterns(): Pattern[] {
    return [...this.knowledge.patterns]
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const learningEngine = LearningEngine.getInstance()
export default LearningEngine
