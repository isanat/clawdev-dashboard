import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { storeChatMessage, getChatHistory } from '@/lib/agent/memory'
import { addLog } from '@/lib/agent/loop'

// API Keys from environment variables
const ZAI_API_KEY = process.env.ZAI_API_KEY || ''
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// System prompt for CLAWDEV
const SYSTEM_PROMPT = `You are CLAWDEV Autonomous Agent v6.0, an intelligent development assistant.

Your capabilities:
- Automatic code analysis and correction
- Application monitoring via Coolify
- Security scanning and vulnerability detection
- Container deployment and management
- Continuous learning and improvement

You operate in OODA Loop mode:
1. Observe - Collect system data
2. Orient - Analyze and contextualize
3. Decide - Choose the best action
4. Act - Execute the action
5. Verify - Verify results
6. Learn - Learn from the outcome

Respond clearly, technically, and objectively. Be helpful and professional.`

// Z.AI Provider
async function callZAI(message: string, history: { role: string; content: string }[]): Promise<{ response: string; provider: string }> {
  try {
    const zai = await ZAI.create()
    
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content
      })),
      { role: 'user' as const, content: message }
    ]
    
    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 2000
    })
    
    const response = completion.choices?.[0]?.message?.content || ''
    
    if (!response) {
      throw new Error('Empty response from Z.AI')
    }
    
    return { response, provider: 'zai' }
  } catch (error) {
    await addLog('ERROR', `Z.AI provider failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'api')
    throw error
  }
}

// Groq Provider
async function callGroq(message: string, history: { role: string; content: string }[]): Promise<{ response: string; provider: string }> {
  try {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content
      })),
      { role: 'user' as const, content: message }
    ]
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    })
    
    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    if (!content) {
      throw new Error('Empty response from Groq')
    }
    
    return { response: content, provider: 'groq' }
  } catch (error) {
    await addLog('ERROR', `Groq provider failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'api')
    throw error
  }
}

// Local fallback provider
function getLocalResponse(message: string): { response: string; provider: string } {
  const lowerMessage = message.toLowerCase()
  
  // Simple pattern matching for local responses
  if (lowerMessage.includes('status') || lowerMessage.includes('how are you')) {
    return {
      response: `CLAWDEV Status Report:
      
🟢 System: Operational
🔄 OODA Loop: Active
📊 Mode: Local Development
⚡ Auto-Fix: Enabled

I'm currently running in local mode with all core systems operational. My autonomous loop is actively monitoring and learning from system patterns.

Note: AI providers (Z.AI and Groq) are currently unavailable. I'm operating in fallback mode with limited capabilities.`,
      provider: 'local'
    }
  }
  
  if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
    return {
      response: `CLAWDEV Capabilities:

🔍 Code Scanner - Detects issues in your codebase
📊 Log Analyzer - Analyzes system logs for patterns
🛡️ Security Auditor - Performs security assessments  
🔧 Auto-Fix Engine - Automatically resolves common issues
📡 API Profiler - Monitors API health and performance

Commands:
• "status" - Get current system status
• "skills" - List available skills
• "metrics" - View system metrics
• "logs" - View recent logs

Note: Running in fallback mode with limited AI capabilities.`,
      provider: 'local'
    }
  }
  
  if (lowerMessage.includes('skill')) {
    return {
      response: `Available Skills:

1. 🔍 Code Scanner (Active)
   - Scans codebase for issues and vulnerabilities

2. 📊 Log Analyzer (Active)  
   - Analyzes logs for patterns and anomalies

3. 🛡️ Security Auditor (Active)
   - Performs security audits

4. 🔧 Auto-Fix Engine (Active)
   - Automatically fixes common issues

5. 📡 API Profiler (Active)
   - Monitors API performance

Note: Running in fallback mode.`,
      provider: 'local'
    }
  }
  
  // Default response
  return {
    response: `I received your message: "${message}"

I'm currently operating in local fallback mode because the primary AI providers are unavailable. My capabilities are limited in this mode, but I can still:

• Provide system status
• List available skills
• Show basic help information

Please try again later when AI services are restored, or contact your administrator.`,
    provider: 'local'
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json()
    
    if (!message) {
      return NextResponse.json({ 
        success: false,
        error: 'Message is required' 
      }, { status: 400 })
    }
    
    let response = ''
    let provider: 'zai' | 'groq' | 'local' = 'local'
    let fallbackUsed = false
    
    // Try providers in order: Z.AI -> Groq -> Local
    try {
      // Primary: Z.AI
      const zaiResult = await callZAI(message, history || [])
      response = zaiResult.response
      provider = 'zai'
      await addLog('INFO', `Chat response via Z.AI`, 'api')
    } catch (zaiError) {
      // Fallback 1: Groq
      try {
        const groqResult = await callGroq(message, history || [])
        response = groqResult.response
        provider = 'groq'
        fallbackUsed = true
        await addLog('WARN', `Z.AI failed, using Groq fallback`, 'api')
      } catch (groqError) {
        // Fallback 2: Local
        const localResult = getLocalResponse(message)
        response = localResult.response
        provider = 'local'
        fallbackUsed = true
        await addLog('WARN', `Both Z.AI and Groq failed, using local fallback`, 'api')
      }
    }
    
    // Store messages for history
    await storeChatMessage('user', message, provider)
    await storeChatMessage('assistant', response, provider)
    
    return NextResponse.json({
      success: true,
      response,
      provider,
      fallbackUsed,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Chat error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const history = await getChatHistory(50)
    return NextResponse.json({
      success: true,
      history
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get chat history'
    }, { status: 500 })
  }
}
