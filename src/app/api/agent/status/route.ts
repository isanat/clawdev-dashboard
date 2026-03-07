import { NextResponse } from 'next/server'
import { getStatus, getLoopState, getRecentActions, getRecentLogs } from '@/lib/agent/loop'
import { getLearnings } from '@/lib/agent/memory'

export async function GET() {
  try {
    const status = getStatus()
    const loopState = getLoopState()
    const recentActions = await getRecentActions(5)
    const recentLogs = await getRecentLogs(10)
    const learnings = await getLearnings(5)
    
    return NextResponse.json({
      success: true,
      data: {
        status,
        loopState,
        recentActions,
        recentLogs,
        learnings
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get agent status'
    }, { status: 500 })
  }
}
