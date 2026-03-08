/**
 * CLAWDEV Agent Control API
 * 
 * Endpoints for complete control over the autonomous agent:
 * - Start/Stop/Pause/Resume/Restart
 * - Configuration management
 * - Action queue management
 * - Status and health monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { agentController, AgentMode } from '@/lib/agent/controller'
import { learningEngine } from '@/lib/agent/learning'

// Authorization check
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  // Accept the configured password or environment variable
  const validToken = process.env.AGENT_API_TOKEN || 'Clawdev2024!'
  return token === validToken
}

// ============================================================================
// GET - Status and Config
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          status: agentController.getStatus()
        })

      case 'config':
        return NextResponse.json({
          success: true,
          config: agentController.getConfig()
        })

      case 'health':
        const status = agentController.getStatus()
        return NextResponse.json({
          success: true,
          health: {
            isHealthy: agentController.isHealthy(),
            healthScore: status.healthScore,
            isRunning: status.isRunning,
            isPaused: status.isPaused,
            consecutiveErrors: status.consecutiveErrors,
            lastError: status.lastError,
            uptime: status.uptime
          }
        })

      case 'learning':
        const context = searchParams.get('context') || 'general'
        const learnings = await learningEngine.getRelevantLearnings(context, 20)
        return NextResponse.json({
          success: true,
          learnings,
          config: learningEngine.getConfig()
        })

      case 'performance':
        const performance = await learningEngine.analyzePerformance()
        return NextResponse.json({
          success: true,
          performance
        })

      case 'patterns':
        return NextResponse.json({
          success: true,
          patterns: learningEngine.getPatterns()
        })

      default:
        return NextResponse.json({
          success: true,
          status: agentController.getStatus(),
          config: agentController.getConfig(),
          learning: {
            config: learningEngine.getConfig(),
            patternsCount: learningEngine.getPatterns().length
          }
        })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ============================================================================
// POST - Control Actions
// ============================================================================

export async function POST(request: NextRequest) {
  // Check authorization for sensitive operations
  const body = await request.json().catch(() => ({}))
  const { action, config, learning, auth } = body

  // Require auth for control operations
  const requiresAuth = ['start', 'stop', 'restart', 'update_config'].includes(action)
  if (requiresAuth && !isAuthorized(request) && auth !== 'Clawdev2024!') {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    switch (action) {
      // ============================================
      // AGENT CONTROL
      // ============================================
      
      case 'start': {
        const result = await agentController.start()
        return NextResponse.json(result)
      }

      case 'stop': {
        const result = await agentController.stop()
        return NextResponse.json(result)
      }

      case 'pause': {
        const result = await agentController.pause()
        return NextResponse.json(result)
      }

      case 'resume': {
        const result = await agentController.resume()
        return NextResponse.json(result)
      }

      case 'restart': {
        const result = await agentController.restart()
        return NextResponse.json(result)
      }

      // ============================================
      // CONFIGURATION
      // ============================================

      case 'update_config': {
        if (!config) {
          return NextResponse.json({
            success: false,
            error: 'Config is required'
          }, { status: 400 })
        }

        const result = await agentController.updateConfig(config)
        return NextResponse.json(result)
      }

      case 'set_mode': {
        const mode = body.mode as AgentMode
        if (!['autonomous', 'supervised', 'manual'].includes(mode)) {
          return NextResponse.json({
            success: false,
            error: 'Invalid mode'
          }, { status: 400 })
        }

        const result = await agentController.updateConfig({ mode })
        return NextResponse.json(result)
      }

      case 'set_interval': {
        const interval = body.interval
        if (typeof interval !== 'number' || interval < 1000) {
          return NextResponse.json({
            success: false,
            error: 'Interval must be >= 1000ms'
          }, { status: 400 })
        }

        const result = await agentController.updateConfig({ loopIntervalMs: interval })
        return NextResponse.json(result)
      }

      case 'toggle_auto_recover': {
        const enabled = body.enabled
        const result = await agentController.updateConfig({ autoRecover: enabled })
        return NextResponse.json(result)
      }

      case 'toggle_auto_improve': {
        const enabled = body.enabled
        const result = await agentController.updateConfig({ autoImprove: enabled })
        return NextResponse.json(result)
      }

      case 'toggle_learning': {
        const enabled = body.enabled
        const result = await agentController.updateConfig({ learningEnabled: enabled })
        return NextResponse.json(result)
      }

      // ============================================
      // LEARNING
      // ============================================

      case 'learn': {
        const { context, observation, action: act, result: res, category } = body
        if (!context || !observation) {
          return NextResponse.json({
            success: false,
            error: 'Context and observation are required'
          }, { status: 400 })
        }

        const entry = await learningEngine.learn({
          context,
          observation,
          action: act || '',
          result: res || '',
          category: category || 'general'
        })

        return NextResponse.json({
          success: true,
          learning: entry
        })
      }

      case 'update_learning_config': {
        if (!learning) {
          return NextResponse.json({
            success: false,
            error: 'Learning config is required'
          }, { status: 400 })
        }

        learningEngine.updateConfig(learning)
        return NextResponse.json({
          success: true,
          config: learningEngine.getConfig()
        })
      }

      case 'detect_patterns': {
        const patterns = await learningEngine.detectPatterns()
        return NextResponse.json({
          success: true,
          patterns,
          count: patterns.length
        })
      }

      case 'cleanup_learnings': {
        const removed = await learningEngine.cleanup()
        return NextResponse.json({
          success: true,
          removed
        })
      }

      // ============================================
      // GOALS
      // ============================================

      case 'add_goal': {
        const { type, description, priority, enabled } = body
        const currentConfig = agentController.getConfig()
        
        if (!currentConfig) {
          return NextResponse.json({
            success: false,
            error: 'Agent not initialized'
          }, { status: 400 })
        }

        const newGoal = {
          id: `goal-${Date.now()}`,
          type: type || 'custom',
          description: description || '',
          priority: priority || 5,
          enabled: enabled !== false,
          successCount: 0,
          failureCount: 0
        }

        const result = await agentController.updateConfig({
          goals: [...currentConfig.goals, newGoal]
        })

        return NextResponse.json({
          success: result.success,
          goal: newGoal
        })
      }

      case 'remove_goal': {
        const goalId = body.goalId
        const currentConfig = agentController.getConfig()
        
        if (!currentConfig) {
          return NextResponse.json({
            success: false,
            error: 'Agent not initialized'
          }, { status: 400 })
        }

        const result = await agentController.updateConfig({
          goals: currentConfig.goals.filter(g => g.id !== goalId)
        })

        return NextResponse.json(result)
      }

      case 'toggle_goal': {
        const { goalId, enabled } = body
        const currentConfig = agentController.getConfig()
        
        if (!currentConfig) {
          return NextResponse.json({
            success: false,
            error: 'Agent not initialized'
          }, { status: 400 })
        }

        const result = await agentController.updateConfig({
          goals: currentConfig.goals.map(g => 
            g.id === goalId ? { ...g, enabled } : g
          )
        })

        return NextResponse.json(result)
      }

      // ============================================
      // INITIALIZATION
      // ============================================

      case 'initialize': {
        const result = await agentController.initialize()
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action',
          availableActions: [
            'start', 'stop', 'pause', 'resume', 'restart',
            'update_config', 'set_mode', 'set_interval',
            'toggle_auto_recover', 'toggle_auto_improve', 'toggle_learning',
            'learn', 'update_learning_config', 'detect_patterns', 'cleanup_learnings',
            'add_goal', 'remove_goal', 'toggle_goal',
            'initialize'
          ]
        }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
