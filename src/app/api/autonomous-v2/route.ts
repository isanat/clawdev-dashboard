import { NextRequest, NextResponse } from 'next/server'
import { chromium, Browser, Page } from 'playwright'
import * as cheerio from 'cheerio'

interface Thought {
  step: number
  thinking: string
  action: string
  result?: string
  success: boolean
}

// System prompt for PROACTIVE agent
const PROACTIVE_SYSTEM_PROMPT = `Você é o CLAWDEV, um agente de IA PROATIVO e AUTÔNOMO. Você NÃO apenas segue instruções - você PENSA, ANALISA, e RESOLVE problemas.

Sua filosofia:
1. ANÁLISE PRÉVIA: Antes de agir, entenda completamente o contexto
2. DETECÇÃO DE PROBLEMAS: Identifique obstáculos ANTES de falhar
3. AUTO-CORREÇÃO: Se algo falhar, tente alternativas automaticamente
4. RACIOCÍNIO: Explique seu pensamento a cada passo
5. APRENDIZADO: Lembre de padrões que funcionaram

Quando encontrar um problema:
- NÃO desista imediatamente
- Analise POR QUE falhou
- Tente 2-3 alternativas diferentes
- Reporte o que aprendeu

Para criação de contas:
1. Primeiro, navegue e ANALISE a página
2. Identifique se está na página de LOGIN ou REGISTRO
3. Se for login, PROCURE ativamente o link de registro
4. Use seletores robustos (por texto, não apenas IDs dinâmicos)
5. Após cada ação, verifique se funcionou
6. Se falhar, tente alternativa

Sempre responda em JSON:
{
  "thinking": "Seu raciocínio sobre a situação atual",
  "analysis": "O que você descobriu analisando a página",
  "problem": "Problema identificado (se houver)",
  "solution": "Como você vai resolver",
  "action": {"type": "...", "selector": "...", "value": "..."},
  "expectedResult": "O que você espera que aconteça",
  "fallbackPlan": "Plano B se falhar"
}

Tipos de ação disponíveis:
- navigate: {"type": "navigate", "value": "url"}
- click: {"type": "click", "selector": "text=Texto do Botão"} 
- fill: {"type": "fill", "selector": "input[type='email']", "value": "email"}
- wait: {"type": "wait", "value": "2000"}
- extract: {"type": "extract"}
- screenshot: {"type": "screenshot"}

Seletores robustos para React/MUI:
- text=Texto Exato
- button:has-text("Texto")
- input[type="email"]
- input[placeholder*="email"]`

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const thoughts: Thought[] = []
  let browser: Browser | null = null
  let page: Page | null = null
  
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

    // Helper function to call AI
    async function think(situation: string, pageData?: any): Promise<any> {
      const messages = [
        { role: 'system', content: PROACTIVE_SYSTEM_PROMPT },
        { role: 'user', content: `Tarefa: ${task}\nContexto: ${context || 'Nenhum'}\n\nSituação atual:\n${situation}\n\n${pageData ? `Dados da página:\n${JSON.stringify(pageData, null, 2)}` : ''}\n\nO que você pensa e qual sua próxima ação? Responda em JSON.` }
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
            max_tokens: 1000
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

    // Helper to extract page data
    async function extractPageData(): Promise<any> {
      if (!page) return {}
      
      const content = await page.content()
      const $ = cheerio.load(content)
      
      return {
        url: page.url(),
        title: await page.title(),
        forms: $('form').map((_, el) => ({
          action: $(el).attr('action'),
          inputs: $(el).find('input, textarea, select').map((_, inp) => ({
            type: $(inp).attr('type'),
            name: $(inp).attr('name'),
            id: $(inp).attr('id'),
            placeholder: $(inp).attr('placeholder'),
            required: $(inp).attr('required') !== undefined
          })).get()
        })).get(),
        buttons: $('button, input[type="submit"], a[role="button"]').map((_, el) => ({
          text: ($(el).text() || $(el).attr('value') || '').trim().slice(0, 50),
          type: $(el).attr('type') || 'button'
        })).get().filter((b: any) => b.text),
        links: $('a[href]').map((_, el) => ({
          text: $(el).text().trim().slice(0, 50),
          href: $(el).attr('href')
        })).get().filter((l: any) => 
          l.text && (
            l.text.toLowerCase().includes('regist') || 
            l.text.toLowerCase().includes('sign') || 
            l.text.toLowerCase().includes('criar') || 
            l.text.toLowerCase().includes('conta') ||
            l.text.toLowerCase().includes('cadastre')
          )
        )
      }
    }

    // Execute action with multiple fallback strategies
    async function executeAction(action: any): Promise<{ success: boolean; result: string; data?: any }> {
      if (!page) return { success: false, result: 'Página não disponível' }
      
      try {
        switch (action.type) {
          case 'navigate':
            await page.goto(action.value, { waitUntil: 'networkidle', timeout: 30000 })
            return { success: true, result: `Navegou para ${action.value}` }
            
          case 'click':
            // Try multiple selector strategies
            const selectors = [action.selector]
            
            // Extract text from selector
            if (action.selector) {
              const textMatch = action.selector.match(/text[=:]?\s*["']?([^"')]+)["']?/i)
              if (textMatch) {
                const text = textMatch[1]
                selectors.push(`text=${text}`)
                selectors.push(`button:visible >> text="${text}"`)
                selectors.push(`a:visible >> text="${text}"`)
                selectors.push(`[role="button"]:visible >> text="${text}"`)
              }
            }
            
            for (const selector of selectors) {
              try {
                await page.click(selector, { timeout: 5000 })
                return { success: true, result: `Clicou em "${selector}"` }
              } catch (e) {
                continue
              }
            }
            return { success: false, result: `Não encontrou elemento para clicar` }
            
          case 'fill':
            const fillSelectors = [
              action.selector,
              'input[type="email"]',
              'input[type="password"]',
              'input[type="text"]',
              `input[placeholder*="${action.value?.includes('@') ? 'email' : 'senha'}" i]`
            ]
            
            for (const selector of fillSelectors) {
              try {
                if (action.selector && !selector.includes(action.selector) && action.selector !== selector) continue
                await page.fill(selector, action.value, { timeout: 5000 })
                return { success: true, result: `Preencheu campo` }
              } catch (e) {
                continue
              }
            }
            return { success: false, result: `Não encontrou campo` }
            
          case 'wait':
            await page.waitForTimeout(parseInt(action.value) || 2000)
            return { success: true, result: `Aguardou ${action.value}ms` }
            
          case 'screenshot':
            const screenshot = await page.screenshot({ type: 'png' })
            return { success: true, result: screenshot.toString('base64'), data: { isScreenshot: true } }
            
          case 'extract':
            const data = await extractPageData()
            return { success: true, result: JSON.stringify(data), data }
            
          default:
            return { success: false, result: `Ação desconhecida: ${action.type}` }
        }
      } catch (error: any) {
        return { success: false, result: error.message }
      }
    }

    // Main autonomous loop - PROACTIVE thinking
    let currentStep = 0
    let lastPageData: any = null
    let consecutiveFailures = 0
    const screenshots: string[] = []
    
    while (currentStep < maxSteps && consecutiveFailures < 3) {
      currentStep++
      
      // Get current page state
      const pageData = await extractPageData()
      lastPageData = pageData
      
      // Build situation description
      const situation = currentStep === 1 
        ? `Iniciando tarefa. URL atual: ${pageData.url}. Botões visíveis: ${JSON.stringify(pageData.buttons?.slice(0, 3))}`
        : `Passo ${currentStep}. URL: ${pageData.url}\nTítulo: ${pageData.title}\nBotões: ${JSON.stringify(pageData.buttons?.slice(0, 5))}\nLinks relevantes: ${JSON.stringify(pageData.links?.slice(0, 3))}`
      
      // Ask AI what to do
      const thoughtResult = await think(situation, pageData)
      
      if (!thoughtResult || !thoughtResult.action) {
        consecutiveFailures++
        thoughts.push({
          step: currentStep,
          thinking: 'Analisando situação... Não consegui determinar próxima ação',
          action: 'waiting',
          success: false
        })
        continue
      }
      
      // Execute the action
      const execResult = await executeAction(thoughtResult.action)
      
      // Handle screenshot
      if (execResult.data?.isScreenshot && execResult.result) {
        screenshots.push(execResult.result)
      }
      
      // Handle extract
      if (execResult.data && !execResult.data.isScreenshot) {
        lastPageData = execResult.data
      }
      
      // Record thought
      thoughts.push({
        step: currentStep,
        thinking: thoughtResult.thinking || thoughtResult.analysis || '',
        action: `${thoughtResult.action.type}: ${thoughtResult.action.selector || thoughtResult.action.value || ''}`,
        result: execResult.result?.slice(0, 200),
        success: execResult.success
      })
      
      // Reset or increment failure counter
      consecutiveFailures = execResult.success ? 0 : consecutiveFailures + 1
      
      // Check if task might be complete
      const url = lastPageData?.url || ''
      const title = lastPageData?.title || ''
      if (url.includes('dashboard') || url.includes('home') || 
          title.toLowerCase().includes('sucesso') || title.toLowerCase().includes('bem-vindo')) {
        break
      }
      
      // Small delay between actions
      await page.waitForTimeout(500)
    }

    // Final screenshot
    if (page) {
      try {
        const finalScreenshot = await page.screenshot({ type: 'png' })
        screenshots.push(finalScreenshot.toString('base64'))
      } catch (e) {}
    }

    // Close browser
    await browser.close()

    const success = consecutiveFailures < 3 && thoughts.filter(t => t.success).length > thoughts.filter(t => !t.success).length
    
    return NextResponse.json({
      success,
      task,
      thoughts,
      totalSteps: currentStep,
      finalUrl: lastPageData?.url,
      pageTitle: lastPageData?.title,
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
    message: 'CLAWDEV Proactive Autonomous Agent v2.0',
    features: [
      '🧠 Raciocínio em cada passo',
      '🔄 Auto-correção automática',
      '🎯 Múltiplas tentativas com estratégias diferentes',
      '🔍 Análise prévia da página',
      '🛡️ Seletores robustos para React/MUI',
      '📸 Screenshots automáticos'
    ],
    usage: 'POST /api/autonomous-v2 com {task: "descrição da tarefa", context: "contexto opcional"}'
  })
}
