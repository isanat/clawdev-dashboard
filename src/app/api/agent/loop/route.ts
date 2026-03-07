import { NextRequest, NextResponse } from 'next/server'
import { startLoop, stopLoop, getStatus, updateConfig } from '@/lib/agent/loop'

export async function GET() {
  try {
    const status = getStatus()
    return NextResponse.json({
      success: true,
      data: status
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get loop status'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, interval, config } = body
    
    if (action === 'start') {
      const result = await startLoop(interval || 10)
      return NextResponse.json({
        success: result.success,
        message: result.message,
        data: getStatus()
      })
    }
    
    if (action === 'stop') {
      const result = await stopLoop()
      return NextResponse.json({
        success: result.success,
        message: result.message,
        data: getStatus()
      })
    }
    
    if (action === 'update') {
      updateConfig(config || {})
      return NextResponse.json({
        success: true,
        message: 'Configuration updated',
        data: getStatus()
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use "start", "stop", or "update"'
    }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to control loop'
    }, { status: 500 })
  }
}
