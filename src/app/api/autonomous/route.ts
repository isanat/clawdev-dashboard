import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { executeBrowserActions, analyzePage, BrowserAction } from '@/lib/browser/automation'

interface AutonomousTask {
  task: string
  context?: string
  priority?: 'low' | 'medium' | 'high'
  maxSteps?: number
}

interface ExecutionStep {
  step: number
  action: BrowserAction
  status: 'pending' | 'running' | 'success' | 'failed'
  result?: any
  error?: string
  duration?: number
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

IMPORTANT: For account creation tasks:
- First navigate to the URL
- Look for "Sign Up", "Register", "Create Account" links
- Extract the page content to find form fields
- Use appropriate selectors (input[name='email'], #email, input[type='email'], etc.)
- Fill all required fields (name, email, password)
- Take a screenshot to verify
- If form has specific requirements, note them

Always respond in JSON format:
{
  "analysis": "What you understand about the task",
  "plan": ["step1", "step2", ...],
  "actions": [
    {"type": "navigate", "value": "url"},
    {"type": "extract"},
    {"type": "screenshot"},
    {"type": "fill", "selector": "input[name='email']", "value": "email"},
    ...
  ],
  "expectedOutcome": "What should happen",
  "confidence": 0.0-1.0,
  "potentialIssues": ["issue1", "issue2"]
}

Available action types:
- navigate: Go to URL (value: URL)
- click: Click element (selector: CSS selector)
- type/fill: Type text (selector, value)
- screenshot: Capture page
- extract: Get page content (includes forms, inputs, buttons)
- wait: Wait for element or time (selector or value in ms)
- scroll: Scroll page
- submit: Submit form (selector)
- evaluate: Run JavaScript (value: code)

Use CSS selectors like:
- input[name='email'], #email, .email-input, input[type='email']
- input[name='password'], #password, input[type='password']
- button[type='submit'], .submit-btn, .btn-primary
- a[href*='register'], a[href*='signup'], .register-link
- form input, form button

When extracting, the system will return:
- forms: list of forms with their inputs
- buttons: list of buttons
- links: list of links
Use this information to choose the right selectors.`

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const steps: ExecutionStep[] = []
  
  try {
    const body: AutonomousTask = await request.json()
    const { task, context, maxSteps = 10 } = body
    
    if (!task) {
      return NextResponse.json({
        success: false,
        error: 'Task description required',
        details: 'Você precisa descrever a tarefa que deseja executar'
      }, { status: 400 })
    }
    
    // Get API keys from environment
    const ZAI_API_KEY = process.env.ZAI_API_KEY || ''
    const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
    
    if (!ZAI_API_KEY && !GROQ_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Nenhuma API de IA configurada',
        details: 'Configure ZAI_API_KEY ou GROQ_API_KEY nas variáveis de ambiente'
      }, { status: 500 })
    }
    
    // Function to call GROQ API
    async function callGroq(messages: Array<{role: string, content: string}>): Promise<string> {
      if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not configured')
      }
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.3,
          max_tokens: 2000
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GROQ API error (${response.status}): ${errorText}`)
      }
      
      const data = await response.json()
      return data.choices[0]?.message?.content || ''
    }
    
    // Function to call Z.AI API (uses SDK or direct API)
    async function callZAI(messages: Array<{role: string, content: string}>): Promise<string> {
      if (!ZAI_API_KEY) {
        throw new Error('ZAI_API_KEY not configured')
      }
      
      // Try using Z.AI SDK
      try {
        const zai = await ZAI.create({ apiKey: ZAI_API_KEY })
        const response = await zai.chat.completions.create({
          messages,
          temperature: 0.3
        })
        return response.choices[0]?.message?.content || ''
      } catch (sdkError: any) {
        console.log('Z.AI SDK failed, trying direct API:', sdkError.message)
        
        const response = await fetch('https://api.z.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ZAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'glm-4-plus',
            messages,
            temperature: 0.3,
            max_tokens: 2000
          })
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Z.AI API error (${response.status}): ${errorText}`)
        }
        
        const data = await response.json()
        return data.choices[0]?.message?.content || ''
      }
    }
    
    // Ask AI to plan the task - try Z.AI first, then GROQ
    let planText = ''
    let usedProvider = ''
    
    try {
      planText = await callZAI([
        { role: 'system', content: AUTONOMOUS_SYSTEM_PROMPT },
        { role: 'user', content: `Task: ${task}\n\nContext: ${context || 'No additional context'}\n\nPlan and provide actions to complete this task. Respond ONLY with valid JSON.` }
      ])
      usedProvider = 'Z.AI'
      console.log('Used Z.AI for planning')
    } catch (zaiError: any) {
      console.log('Z.AI failed, using GROQ:', zaiError.message)
      try {
        planText = await callGroq([
          { role: 'system', content: AUTONOMOUS_SYSTEM_PROMPT },
          { role: 'user', content: `Task: ${task}\n\nContext: ${context || 'No additional context'}\n\nPlan and provide actions to complete this task. Respond ONLY with valid JSON.` }
        ])
        usedProvider = 'GROQ'
      } catch (groqError: any) {
        return NextResponse.json({
          success: false,
          error: 'Falha ao conectar com APIs de IA',
          details: `Z.AI: ${zaiError.message}\nGROQ: ${groqError.message}`,
          suggestion: 'Verifique as chaves de API nas configurações'
        }, { status: 500 })
      }
    }
    
    // Parse the AI response
    let plan: {
      analysis: string
      plan: string[]
      actions: BrowserAction[]
      expectedOutcome: string
      confidence: number
      potentialIssues?: string[]
    }
    
    try {
      // Extract JSON from response
      const jsonMatch = planText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        error: 'Falha ao interpretar plano da IA',
        details: 'A resposta da IA não estava no formato esperado',
        rawResponse: planText,
        provider: usedProvider
      }, { status: 500 })
    }
    
    // Validate actions
    if (!plan.actions || plan.actions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhuma ação planejada',
        details: 'A IA não conseguiu criar um plano de ações para esta tarefa',
        analysis: plan.analysis,
        provider: usedProvider
      }, { status: 400 })
    }
    
    // Initialize step tracking
    const limitedActions = plan.actions.slice(0, maxSteps)
    limitedActions.forEach((action, index) => {
      steps.push({
        step: index + 1,
        action,
        status: 'pending'
      })
    })
    
    // Execute actions one by one with detailed tracking
    let executionResults = []
    let lastSuccessfulStep = 0
    let failedStep: ExecutionStep | null = null
    
    for (let i = 0; i < limitedActions.length; i++) {
      const step = steps[i]
      step.status = 'running'
      const stepStartTime = Date.now()
      
      try {
        // Execute single action
        const result = await executeBrowserActions([step.action])
        step.duration = Date.now() - stepStartTime
        
        if (result[0]?.success) {
          step.status = 'success'
          step.result = result[0]
          lastSuccessfulStep = i + 1
          executionResults.push(result[0])
          
          // If this was an extract action, analyze the forms for registration tasks
          if (step.action.type === 'extract' && result[0]?.data?.forms) {
            const forms = result[0].data.forms
            step.detectedForms = forms.length
            step.detectedInputs = forms.flatMap((f: any) => f.inputs || []).length
          }
        } else {
          step.status = 'failed'
          step.error = result[0]?.error || 'Unknown error'
          failedStep = step
          executionResults.push(result[0])
          break // Stop on first failure
        }
      } catch (error: any) {
        step.status = 'failed'
        step.error = error.message
        step.duration = Date.now() - stepStartTime
        failedStep = step
        break
      }
    }
    
    // Mark remaining steps as skipped if we failed
    if (failedStep) {
      steps.forEach(s => {
        if (s.status === 'pending') {
          s.status = 'skipped' as any
        }
      })
    }
    
    // Determine overall success
    const success = !failedStep && steps.every(s => s.status === 'success')
    
    // Build detailed error message if failed
    let errorDetails = null
    if (failedStep) {
      errorDetails = {
        failedStep: failedStep.step,
        action: failedStep.action.type,
        error: failedStep.error,
        completedSteps: lastSuccessfulStep,
        totalSteps: steps.length,
        suggestion: getErrorSuggestion(failedStep)
      }
    }
    
    // If we have screenshots, analyze them with VLM (using Z.AI)
    const screenshotResult = executionResults.find((r: any) => r.screenshot)
    let vlmAnalysis = null
    
    if (screenshotResult?.screenshot && ZAI_API_KEY) {
      try {
        const zai = await ZAI.create({ apiKey: ZAI_API_KEY })
        const vlmResponse = await zai.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `Analyze this screenshot. The task was: "${task}". ${success ? 'Did we succeed?' : 'We encountered an error: ' + (failedStep?.error || 'Unknown')}. What do you see? Provide a brief analysis.` },
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
        vlmAnalysis = vlmResponse.choices[0]?.message?.content
      } catch (vlmError: any) {
        console.error('VLM analysis failed:', vlmError)
        // VLM is optional, continue without it
      }
    }
    
    const totalDuration = Date.now() - startTime
    
    return NextResponse.json({
      success,
      task,
      provider: usedProvider,
      analysis: plan.analysis,
      plan: plan.plan,
      expectedOutcome: plan.expectedOutcome,
      confidence: plan.confidence,
      potentialIssues: plan.potentialIssues,
      steps: steps.map(s => ({
        step: s.step,
        action: s.action.type,
        selector: s.action.selector,
        value: s.action.value ? (s.action.type === 'fill' ? '***' : s.action.value) : undefined,
        status: s.status,
        error: s.error,
        duration: s.duration,
        detectedForms: (s as any).detectedForms,
        detectedInputs: (s as any).detectedInputs
      })),
      results: executionResults,
      screenshot: screenshotResult?.screenshot,
      vlmAnalysis,
      errorDetails,
      summary: {
        totalSteps: steps.length,
        completedSteps: lastSuccessfulStep,
        failedStep: failedStep?.step,
        totalDuration,
        finalUrl: executionResults[executionResults.length - 1]?.url,
        pageTitle: executionResults[executionResults.length - 1]?.title
      },
      message: success 
        ? 'Tarefa concluída com sucesso!' 
        : `Falha na etapa ${failedStep?.step}: ${failedStep?.error}`
    })
    
  } catch (error: any) {
    console.error('Autonomous task error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Erro interno do servidor ao executar tarefa autônoma',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

// Helper function to provide suggestions based on the error
function getErrorSuggestion(step: ExecutionStep): string {
  const error = step.error?.toLowerCase() || ''
  const action = step.action.type
  
  if (error.includes('timeout')) {
    return 'A página demorou muito para responder. Tente novamente ou verifique se a URL está correta.'
  }
  
  if (error.includes('selector') || error.includes('not found')) {
    if (action === 'click') {
      return `O elemento "${step.action.selector}" não foi encontrado. A página pode ter mudado ou o seletor está incorreto.`
    }
    if (action === 'fill') {
      return `O campo "${step.action.selector}" não foi encontrado. Verifique se o formulário está visível e use os seletores corretos.`
    }
  }
  
  if (error.includes('navigation') || error.includes('net::')) {
    return 'Erro de navegação. Verifique se a URL está acessível e se há conexão com a internet.'
  }
  
  if (action === 'navigate') {
    return 'Não foi possível navegar para a URL. Verifique se o endereço está correto e acessível.'
  }
  
  return 'Verifique os logs para mais detalhes sobre o erro.'
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
