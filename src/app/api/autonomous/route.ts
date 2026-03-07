import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { executeBrowserActions, analyzePage, BrowserAction } from '@/lib/browser/automation'

interface AutonomousTask {
  task: string
  context?: string
  priority?: 'low' | 'medium' | 'high'
  maxSteps?: number
}

// System prompt for autonomous agent
const AUTONOMOUS_SYSTEM_PROMPT = `You are CLAWDEV, an autonomous AI agent capable of browsing websites, creating accounts, filling forms, and performing complex web tasks.

Your capabilities:
1. Navigate to any website
2. Click elements, fill forms, submit data
3. Take screenshots and analyze UI
4. Extract content from pages
5. Create accounts on websites
6. Verify emails (if email service is configured)
7. Execute JavaScript on pages

When given a task, you must:
1. ANALYZE the task and break it into steps
2. PLAN the browser actions needed
3. EXECUTE the actions
4. VERIFY the results
5. REPORT back with findings

Always respond in JSON format:
{
  "analysis": "What you understand about the task",
  "plan": ["step1", "step2", ...],
  "actions": [
    {"type": "navigate", "value": "url"},
    {"type": "fill", "selector": "input[name='email']", "value": "email"},
    ...
  ],
  "expectedOutcome": "What should happen",
  "confidence": 0.0-1.0
}

Available action types:
- navigate: Go to URL (value: URL)
- click: Click element (selector: CSS selector)
- type/fill: Type text (selector, value)
- screenshot: Capture page
- extract: Get page content
- wait: Wait for element or time (selector or value in ms)
- scroll: Scroll page
- submit: Submit form (selector)
- evaluate: Run JavaScript (value: code)

Use CSS selectors like:
- input[name='email'], #email, .email-input
- button[type='submit'], .submit-btn
- a[href*='register']`

export async function POST(request: NextRequest) {
  try {
    const body: AutonomousTask = await request.json()
    const { task, context, maxSteps = 10 } = body
    
    if (!task) {
      return NextResponse.json({
        success: false,
        error: 'Task description required'
      }, { status: 400 })
    }
    
    // Initialize Z.AI
    const zai = await ZAI.create()
    
    // Ask AI to plan the task
    const planResponse = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: AUTONOMOUS_SYSTEM_PROMPT },
        { role: 'user', content: `Task: ${task}\n\nContext: ${context || 'No additional context'}\n\nPlan and provide actions to complete this task. Respond ONLY with valid JSON.` }
      ],
      temperature: 0.3
    })
    
    const planText = planResponse.choices[0]?.message?.content || ''
    
    // Parse the AI response
    let plan: {
      analysis: string
      plan: string[]
      actions: BrowserAction[]
      expectedOutcome: string
      confidence: number
    }
    
    try {
      // Extract JSON from response
      const jsonMatch = planText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI plan',
        rawResponse: planText
      }, { status: 500 })
    }
    
    // Execute the planned actions
    let executionResults = null
    let success = false
    
    if (plan.actions && plan.actions.length > 0) {
      const limitedActions = plan.actions.slice(0, maxSteps)
      executionResults = await executeBrowserActions(limitedActions)
      success = executionResults.every((r: any) => r.success)
      
      // If we have screenshots, analyze them with VLM
      const screenshotResult = executionResults.find((r: any) => r.screenshot)
      if (screenshotResult?.screenshot) {
        try {
          const vlmResponse = await zai.chat.completions.create({
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: `Analyze this screenshot. The task was: "${task}". Did we succeed? What do you see?` },
                  { 
                    type: 'image_url', 
                    image_url: { 
                      url: `data:image/png;base64,${screenshotResult.screenshot}` 
                    } 
                  }
                ]
              }
            ]
          })
          
          executionResults.forEach((r: any) => {
            if (r.screenshot) {
              r.vlmAnalysis = vlmResponse.choices[0]?.message?.content
            }
          })
        } catch (vlmError) {
          console.error('VLM analysis failed:', vlmError)
        }
      }
    }
    
    return NextResponse.json({
      success,
      task,
      plan: plan.plan,
      analysis: plan.analysis,
      expectedOutcome: plan.expectedOutcome,
      confidence: plan.confidence,
      executedActions: plan.actions?.length || 0,
      results: executionResults,
      message: success 
        ? 'Task completed successfully' 
        : 'Task execution had issues - check results'
    })
    
  } catch (error: any) {
    console.error('Autonomous task error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// GET - Task templates
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'CLAWDEV Autonomous Agent API',
    taskTemplates: {
      register: {
        task: 'Create an account on example.com',
        context: 'Email: clawdevagenteai@gmail.com, Name: CLAWDEV AI',
        actions: [
          { type: 'navigate', value: 'https://example.com/register' },
          { type: 'extract' },
          { type: 'fill', selector: 'input[name="email"]', value: '${email}' },
          { type: 'fill', selector: 'input[name="password"]', value: '${password}' },
          { type: 'click', selector: 'button[type="submit"]' }
        ]
      },
      analyze: {
        task: 'Analyze the UI/UX of a website',
        actions: [
          { type: 'navigate', value: '${url}' },
          { type: 'screenshot', value: 'full' },
          { type: 'extract' }
        ]
      },
      test: {
        task: 'Test a website form',
        actions: [
          { type: 'navigate', value: '${url}' },
          { type: 'extract' },
          { type: 'fill', selector: '${formSelector}', value: '${testData}' },
          { type: 'submit', selector: '${submitSelector}' },
          { type: 'screenshot' }
        ]
      }
    },
    capabilities: [
      'Autonomous web navigation',
      'Form filling and submission',
      'Account creation',
      'UI/UX analysis with VLM',
      'Content extraction',
      'Screenshot capture',
      'JavaScript execution'
    ]
  })
}
