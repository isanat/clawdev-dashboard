import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface TestResult {
  name: string;
  status: 'success' | 'error';
  message: string;
  latency?: number;
  details?: Record<string, unknown>;
}

export async function GET() {
  const results: TestResult[] = [];

  // 1. Testar Coolify
  const coolifyStart = Date.now();
  try {
    const coolifyUrl = process.env.COOLIFY_API_URL;
    const coolifyToken = process.env.COOLIFY_API_TOKEN;
    const coolifyUuid = process.env.COOLIFY_APP_UUID;
    
    if (!coolifyUrl || !coolifyToken) {
      results.push({
        name: 'Coolify',
        status: 'error',
        message: 'Credenciais não configuradas'
      });
    } else {
      const response = await fetch(`${coolifyUrl}/api/v1/applications/${coolifyUuid}`, {
        headers: {
          'Authorization': `Bearer ${coolifyToken}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        results.push({
          name: 'Coolify',
          status: 'success',
          message: 'Conexão bem sucedida',
          latency: Date.now() - coolifyStart,
          details: {
            url: coolifyUrl,
            app_name: data?.name || 'N/A',
            status: data?.status || 'unknown'
          }
        });
      } else {
        results.push({
          name: 'Coolify',
          status: 'error',
          message: `Erro HTTP ${response.status}: ${response.statusText}`,
          latency: Date.now() - coolifyStart
        });
      }
    }
  } catch (error) {
    results.push({
      name: 'Coolify',
      status: 'error',
      message: `Falha na conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      latency: Date.now() - coolifyStart
    });
  }

  // 2. Testar Z.AI (GLM)
  const zaiStart = Date.now();
  try {
    const apiKey = process.env.ZAI_API_KEY;
    
    if (!apiKey) {
      results.push({
        name: 'Z.AI (GLM)',
        status: 'error',
        message: 'API Key não configurada'
      });
    } else {
      const zai = await ZAI.create();
      
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'user', content: 'Teste de conexão. Responda apenas: OK' }
        ],
        max_tokens: 10
      });
      
      if (completion.choices?.[0]?.message?.content) {
        results.push({
          name: 'Z.AI (GLM)',
          status: 'success',
          message: 'API funcionando corretamente',
          latency: Date.now() - zaiStart,
          details: {
            response: completion.choices[0].message.content,
            model: 'glm'
          }
        });
      } else {
        results.push({
          name: 'Z.AI (GLM)',
          status: 'error',
          message: 'Resposta vazia da API',
          latency: Date.now() - zaiStart
        });
      }
    }
  } catch (error) {
    results.push({
      name: 'Z.AI (GLM)',
      status: 'error',
      message: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      latency: Date.now() - zaiStart
    });
  }

  // 3. Testar Gemini
  const geminiStart = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      results.push({
        name: 'Google Gemini',
        status: 'error',
        message: 'API Key não configurada'
      });
    } else {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responda apenas: OK' }] }]
          }),
          signal: AbortSignal.timeout(10000)
        }
      );
      
      if (response.ok) {
        results.push({
          name: 'Google Gemini',
          status: 'success',
          message: 'API funcionando corretamente',
          latency: Date.now() - geminiStart,
          details: {
            model: 'gemini-pro'
          }
        });
      } else {
        results.push({
          name: 'Google Gemini',
          status: 'error',
          message: `Erro HTTP ${response.status}`,
          latency: Date.now() - geminiStart
        });
      }
    }
  } catch (error) {
    results.push({
      name: 'Google Gemini',
      status: 'error',
      message: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      latency: Date.now() - geminiStart
    });
  }

  // 4. Testar Groq
  const groqStart = Date.now();
  try {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      results.push({
        name: 'Groq',
        status: 'error',
        message: 'API Key não configurada'
      });
    } else {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'Responda apenas: OK' }],
          max_tokens: 10
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        results.push({
          name: 'Groq',
          status: 'success',
          message: 'API funcionando corretamente',
          latency: Date.now() - groqStart,
          details: {
            model: 'llama-3.1-8b-instant'
          }
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        results.push({
          name: 'Groq',
          status: 'error',
          message: `Erro ${response.status}: ${errorData?.error?.message || response.statusText}`,
          latency: Date.now() - groqStart
        });
      }
    }
  } catch (error) {
    results.push({
      name: 'Groq',
      status: 'error',
      message: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      latency: Date.now() - groqStart
    });
  }

  // Resumo
  const summary = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    error: results.filter(r => r.status === 'error').length,
    timestamp: new Date().toISOString()
  };

  return NextResponse.json({ results, summary });
}
