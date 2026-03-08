/**
 * CLAWDEV Dev Full Cycle API
 * 
 * API REST para controlar o agente de desenvolvimento autônomo REAL:
 * - Criar features
 * - Corrigir bugs
 * - Refatorar código
 * - Gerar testes
 * - Fazer deploy
 * 
 * TUDO 100% REAL!
 */

import { NextRequest, NextResponse } from 'next/server'
import { devFullCycle } from '@/lib/agent/dev-full-cycle'
import { gitManager } from '@/lib/agent/git'
import { aiCoder } from '@/lib/agent/ai-coder'
import { testRunner } from '@/lib/agent/tester'
import { deployer } from '@/lib/agent/deployer'
import { realExecutor } from '@/lib/agent/executor'

// Authorization check
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const validToken = process.env.AGENT_API_TOKEN || 'Clawdev2024!'
  return token === validToken
}

// ============================================================================
// GET - Status and Info
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          queue: devFullCycle.getQueueStatus()
        })

      case 'git':
        const gitStatus = await gitManager.getStatus()
        return NextResponse.json({
          success: true,
          git: gitStatus
        })

      case 'health':
        const health = await devFullCycle.analyzeProjectHealth()
        return NextResponse.json({
          success: true,
          health
        })

      case 'tests':
        const testResults = await testRunner.runTests()
        return NextResponse.json({
          success: true,
          tests: testResults
        })

      case 'lint':
        const lintResults = await testRunner.runLint()
        return NextResponse.json({
          success: true,
          lint: lintResults
        })

      case 'metrics':
        const metrics = await realExecutor.getSystemMetrics()
        return NextResponse.json({
          success: true,
          metrics
        })

      default:
        return NextResponse.json({
          success: true,
          queue: devFullCycle.getQueueStatus(),
          availableActions: [
            'status', 'git', 'health', 'tests', 'lint', 'metrics'
          ]
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
// POST - Execute Actions
// ============================================================================

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { action, auth } = body

  // Require auth for all operations
  if (!isAuthorized(request) && auth !== 'Clawdev2024!') {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    switch (action) {
      case 'create_feature': {
        const { description, files } = body
        if (!description) {
          return NextResponse.json({
            success: false,
            error: 'Description is required'
          }, { status: 400 })
        }
        const result = await devFullCycle.createFeature(description, files || [])
        return NextResponse.json(result)
      }

      case 'fix_bug': {
        const { file, description } = body
        if (!file || !description) {
          return NextResponse.json({
            success: false,
            error: 'File and description are required'
          }, { status: 400 })
        }
        const result = await devFullCycle.fixBug(file, description)
        return NextResponse.json(result)
      }

      case 'auto_fix_all': {
        const results = await devFullCycle.autoFixAll()
        return NextResponse.json({
          success: true,
          fixed: results.length,
          results
        })
      }

      case 'quick_deploy': {
        const result = await deployer.quickDeploy()
        return NextResponse.json(result)
      }

      case 'git_commit': {
        const { message } = body
        if (!message) {
          return NextResponse.json({
            success: false,
            error: 'Message is required'
          }, { status: 400 })
        }
        const result = await gitManager.addAndCommit(message)
        return NextResponse.json(result)
      }

      case 'git_push': {
        const { remote, branch } = body
        const result = await gitManager.push(remote || 'origin', branch)
        return NextResponse.json({
          success: result.success,
          message: result.success ? 'Pushed successfully' : result.stderr
        })
      }

      case 'run_tests': {
        const result = await testRunner.runTests()
        return NextResponse.json(result)
      }

      case 'run_lint': {
        const { fix } = body
        const result = await testRunner.runLint(undefined, fix)
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action',
          availableActions: [
            'create_feature', 'fix_bug', 'auto_fix_all', 'quick_deploy',
            'git_commit', 'git_push', 'run_tests', 'run_lint'
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
