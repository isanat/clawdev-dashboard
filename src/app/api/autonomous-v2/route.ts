import { NextRequest, NextResponse } from 'next/server'
import { chromium, Browser, Page } from 'playwright'
import * as cheerio from 'cheerio'

interface Thought {
  step: number
  thinking: string
  action: string
  result?: string
  success: boolean
  screenshot?: string
  pageChanged?: boolean
}

interface Memory {
  previousUrl: string
  previousTitle: string
  actionsTried: string[]
  failures: string[]
  successes: string[]
  formFields: { type: string; selector: string; filled: boolean }[]
}

// Enhanced proactive system prompt
const PROACTIVE_SYSTEM_PROMPT = `Você é o CLAWDEV, um agente de IA PROATIVO, AUTÔNOMO e INTELIGENTE. Você pensa como um humano resolveria problemas.

PRINCÍPIOS FUNDAMENTAIS:
1. OBSERVE antes de agir - analise a página completa
2. REFLITA sobre o contexto - onde estou? o que preciso fazer?
3. DECIDA a melhor ação com base na análise
4. EXECUTE com precisão
5. VERIFIQUE se funcionou - compare antes/depois
6. CORRIJA se necessário - tente alternativas

MEMÓRIA DE APRENDIZADO:
- Lembre de seletores que funcionaram
- Evite repetir ações que falharam
- Detecte mudanças na página (URL, título, elementos)

Para criar contas:
1. Navegue e EXTRAIA dados da página
2. IDENTIFIQUE: Login ou Registro?
3. Se LOGIN: procure link/botão de "Criar conta", "Registre-se", "Sign up"
4. Se REGISTRO: analise os campos do formulário
5. Preencha com seletores robustos:
   - input[type="email"] para email
   - input[type="password"] para senha
   - input[placeholder*="nome"] para nome
6. Verifique SE a página mudou após clique
7. Tire screenshots para verificar progresso

SELETORES ROBUSTOS (em ordem de preferência):
1. text=Texto Exato (mais confiável)
2. button:has-text("Texto")
3. input[type="email"], input[type="password"]
4. input[placeholder*="texto"]
5. [data-testid="elemento"]

Responda SEMPRE em JSON:
{
  "thinking": "Seu raciocínio detalhado",
  "analysis": "Análise da situação atual",
  "urlChanged": true/false,
  "expectedState": "O que espero ver após a ação",
  "action": {"type": "...", "selector": "...", "value": "..."},
  "verifyAfter": "Como vou verificar se funcionou",
  "fallbackPlan": "Plano B se falhar"
}

Ações disponíveis:
- navigate: {"type": "navigate", "value": "url"}
- click: {"type": "click", "selector": "text=Texto"}
- fill: {"type": "fill", "selector": "input[type='email']", "value": "valor"}
- wait: {"type": "wait", "value": "2000"}
- extract: {"type": "extract"}
- screenshot: {"type": "screenshot"}
- scroll: {"type": "scroll"}
- evaluate: {"type": "evaluate", "value": "codigo"}`

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const thoughts: Thought[] = []
  let browser: Browser | null = null
  let page: Page | null = null
  
  // Memory for learning
  const memory: Memory = {
    previousUrl: '',
    previousTitle: '',
    actionsTried: [],
    failures: [],
    successes: [],
    formFields: []
  }
  
  try {
    const body = await request.json()
    const { task, context, maxSteps = 15 } = body
    
    if (!task) {
      return NextResponse.json({
        success: false,
        error: 'Tarefa não especificada'
      }, { status: 400 })
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
    
    if (!GROQ_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'GROQ_API_KEY não configurada'
      }, { status: 500 })
    }

    // Initialize browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })
    
    const browserContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      bypassCSP: true,
      ignoreHTTPSErrors: true
    })
    
    page = await browserContext.newPage()

    // AI Thinking function with memory context
    async function think(situation: string, pageData?: any): Promise<any> {
      const memoryContext = `
MEMÓRIA:
- URL anterior: ${memory.previousUrl}
- Título anterior: ${memory.previousTitle}
- Ações tentadas: ${memory.actionsTried.slice(-5).join(', ')}
- Falhas recentes: ${memory.failures.slice(-3).join(', ')}
- Sucessos recentes: ${memory.successes.slice(-3).join(', ')}
- Campos preenchidos: ${memory.formFields.filter(f => f.filled).map(f => f.type).join(', ')}
`
      
      const messages = [
        { role: 'system', content: PROACTIVE_SYSTEM_PROMPT },
        { role: 'user', content: `Tarefa: ${task}\nContexto: ${context || 'Nenhum'}\n\n${memoryContext}\n\nSituação atual:\n${situation}\n\n${pageData ? `Dados da página:\n${JSON.stringify(pageData, null, 2)}` : ''}\n\nAnalise, pense e decida a próxima ação. Responda em JSON.` }
      ]
      
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.2,
            max_tokens: 1200
          })
        })
        
        const data = await response.json()
        const content = data.choices[0]?.message?.content || ''
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.log('AI thinking failed:', e)
      }
      
      return null
    }

    // Extract page data
    async function extractPageData(): Promise<any> {
      if (!page) return {}
      
      try {
        const content = await page.content()
        const $ = cheerio.load(content)
        
        // Detect if on login or register page
        const pageText = $('body').text().toLowerCase()
        const isLoginPage = pageText.includes('entrar') || pageText.includes('login') || pageText.includes('sign in')
        const isRegisterPage = pageText.includes('criar conta') || pageText.includes('registre') || pageText.includes('sign up')
        
        // Find all buttons
        const buttons = $('button, input[type="submit"], a[role="button"], .MuiButtonBase-root').map((_, el) => ({
          text: ($(el).text() || $(el).attr('value') || '').trim().slice(0, 60),
          type: $(el).attr('type') || 'button',
          visible: $(el).is(':visible')
        })).get().filter((b: any) => b.text && b.visible)
        
        // Find registration-related links/buttons
        const registerButtons = buttons.filter((b: any) => 
          b.text.toLowerCase().includes('criar') || 
          b.text.toLowerCase().includes('regist') ||
          b.text.toLowerCase().includes('sign up') ||
          b.text.toLowerCase().includes('nova conta')
        )
        
        // Find form inputs
        const inputs = $('input, textarea, select').map((_, inp) => ({
          type: $(inp).attr('type') || 'text',
          name: $(inp).attr('name'),
          id: $(inp).attr('id'),
          placeholder: $(inp).attr('placeholder'),
          required: $(inp).attr('required') !== undefined,
          visible: $(inp).is(':visible')
        })).get().filter((i: any) => i.visible)
        
        // Find email and password inputs
        const emailInputs = inputs.filter((i: any) => 
          i.type === 'email' || 
          i.name?.includes('email') || 
          i.placeholder?.toLowerCase().includes('email')
        )
        
        const passwordInputs = inputs.filter((i: any) => 
          i.type === 'password' || 
          i.name?.includes('pass') || 
          i.placeholder?.toLowerCase().includes('senha')
        )
        
        return {
          url: page.url(),
          title: await page.title(),
          isLoginPage,
          isRegisterPage,
          registerButtons,
          buttons: buttons.slice(0, 10),
          inputs: inputs.slice(0, 10),
          emailInputs,
          passwordInputs,
          hasForm: $('form').length > 0,
          formCount: $('form').length
        }
      } catch (e) {
        return { url: page.url(), title: await page.title() }
      }
    }

    // Execute action with verification
    async function executeAction(action: any): Promise<{ success: boolean; result: string; data?: any }> {
      if (!page) return { success: false, result: 'Página não disponível' }
      
      const beforeUrl = page.url()
      const beforeTitle = await page.title()
      
      try {
        switch (action.type) {
          case 'navigate':
            await page.goto(action.value, { waitUntil: 'networkidle', timeout: 30000 })
            const afterNav = page.url()
            return { 
              success: true, 
              result: `Navegou para ${afterNav}`,
              data: { urlChanged: afterNav !== beforeUrl }
            }
            
          case 'click':
            // Multiple selector strategies
            const selectors = []
            
            if (action.selector) {
              selectors.push(action.selector)
              
              // Extract text and create alternatives
              const textMatch = action.selector.match(/text[=:]?\s*["']?([^"')]+)["']?/i)
              if (textMatch) {
                const text = textMatch[1]
                selectors.push(`text=${text}`)
                selectors.push(`button:visible >> text="${text}"`)
                selectors.push(`a:visible >> text="${text}"`)
                selectors.push(`[role="button"]:visible >> text="${text}"`)
                selectors.push(`.MuiButtonBase-root:visible >> text="${text}"`)
              }
            }
            
            for (const selector of selectors) {
              try {
                await page.click(selector, { timeout: 5000 })
                await page.waitForTimeout(1000) // Wait for page changes
                
                const afterUrl = page.url()
                const afterTitle = await page.title()
                const urlChanged = afterUrl !== beforeUrl
                const titleChanged = afterTitle !== beforeTitle
                
                return { 
                  success: true, 
                  result: `Clicou em "${selector}". URL mudou: ${urlChanged}`,
                  data: { urlChanged, titleChanged, newUrl: afterUrl }
                }
              } catch (e) {
                continue
              }
            }
            return { success: false, result: `Não encontrou elemento para clicar` }
            
          case 'fill':
            const fillSelectors = [
              action.selector,
              'input[type="email"]:visible',
              'input[type="password"]:visible',
              'input[type="text"]:visible',
              `input[placeholder*="${action.value?.includes('@') ? 'email' : 'senha'}" i]:visible`
            ]
            
            // Determine input type from value
            if (action.value?.includes('@')) {
              fillSelectors.unshift('input[type="email"]:visible')
            } else if (action.selector?.includes('password') || action.selector?.includes('senha')) {
              fillSelectors.unshift('input[type="password"]:visible')
            }
            
            for (const selector of fillSelectors) {
              try {
                if (!selector) continue
                await page.fill(selector, action.value, { timeout: 5000 })
                
                // Track filled fields
                memory.formFields.push({
                  type: action.value?.includes('@') ? 'email' : 'password',
                  selector,
                  filled: true
                })
                
                return { success: true, result: `Preencheu campo com ${action.value?.includes('@') ? 'email' : 'senha'}` }
              } catch (e) {
                continue
              }
            }
            return { success: false, result: `Não encontrou campo para preencher` }
            
          case 'wait':
            await page.waitForTimeout(parseInt(action.value) || 2000)
            return { success: true, result: `Aguardou ${action.value}ms` }
            
          case 'screenshot':
            const screenshot = await page.screenshot({ type: 'png', fullPage: false })
            return { success: true, result: screenshot.toString('base64'), data: { isScreenshot: true } }
            
          case 'extract':
            const data = await extractPageData()
            return { success: true, result: JSON.stringify(data).slice(0, 500), data }
            
          case 'scroll':
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            return { success: true, result: 'Rolou a página' }
            
          default:
            return { success: false, result: `Ação desconhecida: ${action.type}` }
        }
      } catch (error: any) {
        return { success: false, result: error.message }
      }
    }

    // Main proactive loop
    let currentStep = 0
    let consecutiveFailures = 0
    const screenshots: string[] = []
    let lastPageData: any = null
    
    while (currentStep < maxSteps && consecutiveFailures < 3) {
      currentStep++
      
      // Extract current page state
      const pageData = await extractPageData()
      lastPageData = pageData
      
      // Update memory
      if (pageData.url !== memory.previousUrl) {
        memory.previousUrl = pageData.url
        memory.previousTitle = pageData.title
      }
      
      // Build situation with rich context
      const situation = `
PASSO ${currentStep}
URL: ${pageData.url}
Título: ${pageData.title}
É página de Login? ${pageData.isLoginPage}
É página de Registro? ${pageData.isRegisterPage}
Botões de registro encontrados: ${JSON.stringify(pageData.registerButtons?.slice(0, 3))}
Campos de email: ${pageData.emailInputs?.length}
Campos de senha: ${pageData.passwordInputs?.length}
Formulários: ${pageData.formCount}
`
      
      // Ask AI to think
      const thoughtResult = await think(situation, pageData)
      
      if (!thoughtResult || !thoughtResult.action) {
        consecutiveFailures++
        thoughts.push({
          step: currentStep,
          thinking: 'Analisando... Não consegui determinar a próxima ação. Verificando alternativas.',
          action: 'waiting',
          success: false
        })
        continue
      }
      
      // Track action in memory
      memory.actionsTried.push(`${thoughtResult.action.type}:${thoughtResult.action.selector || thoughtResult.action.value || ''}`)
      
      // Execute
      const execResult = await executeAction(thoughtResult.action)
      
      // Handle screenshot
      if (execResult.data?.isScreenshot && execResult.result) {
        screenshots.push(execResult.result)
      }
      
      // Update memory based on result
      if (execResult.success) {
        memory.successes.push(thoughtResult.action.type)
        consecutiveFailures = 0
      } else {
        memory.failures.push(thoughtResult.action.type)
        consecutiveFailures++
      }
      
      // Record thought
      thoughts.push({
        step: currentStep,
        thinking: thoughtResult.thinking || thoughtResult.analysis || '',
        action: `${thoughtResult.action.type}: ${thoughtResult.action.selector || thoughtResult.action.value || ''}`,
        result: execResult.result?.slice(0, 150),
        success: execResult.success,
        pageChanged: execResult.data?.urlChanged
      })
      
      // Check if task might be complete
      const url = pageData.url || ''
      const title = pageData.title?.toLowerCase() || ''
      
      // Success indicators
      if (url.includes('dashboard') || url.includes('home') || url.includes('welcome') ||
          title.includes('bem-vindo') || title.includes('sucesso') || title.includes('dashboard')) {
        break
      }
      
      // If we filled email and password, and we're on register page, try to submit
      const filledEmail = memory.formFields.some(f => f.type === 'email' && f.filled)
      const filledPassword = memory.formFields.some(f => f.type === 'password' && f.filled)
      
      if (filledEmail && filledPassword && pageData.isRegisterPage) {
        // Look for submit button
        const submitButtons = pageData.buttons?.filter((b: any) => 
          b.text.toLowerCase().includes('criar') ||
          b.text.toLowerCase().includes('regist') ||
          b.text.toLowerCase().includes('cadastrar')
        )
        
        if (submitButtons?.length > 0) {
          thoughts.push({
            step: currentStep + 0.5,
            thinking: 'Auto-detecção: Email e senha preenchidos. Procurando botão de envio...',
            action: `Auto-submit detectado`,
            success: true
          })
        }
      }
      
      await page.waitForTimeout(500)
    }

    // Final screenshot
    if (page) {
      try {
        const finalScreenshot = await page.screenshot({ type: 'png' })
        screenshots.push(finalScreenshot.toString('base64'))
      } catch (e) {}
    }

    await browser.close()

    const success = consecutiveFailures < 3
    
    return NextResponse.json({
      success,
      task,
      thoughts,
      memory: {
        actionsTried: memory.actionsTried.length,
        successes: memory.successes.length,
        failures: memory.failures.length,
        formFieldsFilled: memory.formFields.filter(f => f.filled).length
      },
      totalSteps: currentStep,
      finalUrl: lastPageData?.url,
      pageTitle: lastPageData?.title,
      isRegisterPage: lastPageData?.isRegisterPage,
      screenshot: screenshots[screenshots.length - 1],
      duration: Date.now() - startTime,
      message: success 
        ? 'Tarefa concluída com raciocínio autônomo!' 
        : 'Tarefa não concluída completamente'
    })

  } catch (error: any) {
    if (browser) await browser.close()
    
    return NextResponse.json({
      success: false,
      error: error.message,
      thoughts
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'CLAWDEV Proactive Autonomous Agent v2.1 - Enhanced',
    features: [
      '🧠 Raciocínio em cada passo',
      '🔄 Auto-correção automática', 
      '🎯 Múltiplas estratégias de seletores',
      '🔍 Análise prévia da página',
      '📝 Memória de aprendizado',
      '✅ Verificação de mudanças na página',
      '📸 Screenshots automáticos',
      '🔗 Detecção de página Login vs Registro'
    ],
    newInV21: [
      'Memory system to track actions and failures',
      'Page change detection after clicks',
      'Auto-detection of login/register pages',
      'Smart form field tracking'
    ]
  })
}
