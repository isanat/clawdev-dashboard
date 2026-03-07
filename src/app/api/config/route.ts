import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { updateConfig, getStatus } from '@/lib/agent/loop'

// Default configuration values
const defaultConfig = {
  mode: 'local',
  autoFix: true,
  loopInterval: 10,
  supervisedMode: false,
  zaiApiKey: process.env.ZAI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  coolifyApiUrl: '',
  coolifyApiToken: '',
  coolifyAppUuid: '',
  projectPath: '/home/z/my-project'
}

// Initialize config in database
async function initializeConfig() {
  for (const [key, value] of Object.entries(defaultConfig)) {
    const existing = await db.agentConfig.findUnique({
      where: { key }
    })
    
    if (!existing) {
      await db.agentConfig.create({
        data: {
          key,
          value: String(value),
          description: `Configuration for ${key}`
        }
      })
    }
  }
}

// Get all config from database
async function getConfigFromDB() {
  await initializeConfig()
  
  const configs = await db.agentConfig.findMany()
  const configMap: Record<string, string> = {}
  
  for (const config of configs) {
    configMap[config.key] = config.value
  }
  
  return {
    mode: configMap.mode || defaultConfig.mode,
    autoFix: configMap.autoFix === 'true',
    loopInterval: parseInt(configMap.loopInterval) || defaultConfig.loopInterval,
    supervisedMode: configMap.supervisedMode === 'true',
    zaiApiKey: configMap.zaiApiKey ? `${configMap.zaiApiKey.slice(0, 8)}...${configMap.zaiApiKey.slice(-4)}` : '',
    groqApiKey: configMap.groqApiKey ? `${configMap.groqApiKey.slice(0, 8)}...${configMap.groqApiKey.slice(-4)}` : '',
    coolifyApiUrl: configMap.coolifyApiUrl || '',
    coolifyApiToken: configMap.coolifyApiToken ? '••••••••' : '',
    coolifyAppUuid: configMap.coolifyAppUuid || '',
    projectPath: configMap.projectPath || defaultConfig.projectPath
  }
}

// GET - Return configuration
export async function GET() {
  try {
    const config = await getConfigFromDB()
    const status = getStatus()
    
    return NextResponse.json({
      success: true,
      data: {
        ...config,
        isRunning: status.isRunning,
        cycleCount: status.cycleCount
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get config'
    }, { status: 500 })
  }
}

// POST - Update configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Update database
    for (const [key, value] of Object.entries(body)) {
      if (key in defaultConfig) {
        await db.agentConfig.upsert({
          where: { key },
          create: {
            key,
            value: String(value),
            description: `Configuration for ${key}`
          },
          update: {
            value: String(value)
          }
        })
      }
    }
    
    // Update agent configuration
    if (body.autoFix !== undefined || body.mode !== undefined || body.loopInterval !== undefined) {
      updateConfig({
        autoFixEnabled: body.autoFix,
        mode: body.mode,
        loopInterval: body.loopInterval
      })
    }
    
    const config = await getConfigFromDB()
    
    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      data: config
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update config'
    }, { status: 500 })
  }
}
