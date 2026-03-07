import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial logs
      const initialLogs = await db.log.findMany({
        take: 20,
        orderBy: { timestamp: 'desc' }
      })
      
      for (const log of initialLogs.reverse()) {
        const data = JSON.stringify({
          type: 'log',
          data: {
            id: log.id,
            level: log.level,
            message: log.message,
            source: log.source,
            timestamp: log.timestamp.toISOString()
          }
        })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }
      
      // Keep connection alive and send new logs
      let lastTimestamp = new Date()
      
      const interval = setInterval(async () => {
        try {
          const newLogs = await db.log.findMany({
            where: {
              timestamp: { gt: lastTimestamp }
            },
            orderBy: { timestamp: 'asc' }
          })
          
          for (const log of newLogs) {
            const data = JSON.stringify({
              type: 'log',
              data: {
                id: log.id,
                level: log.level,
                message: log.message,
                source: log.source,
                timestamp: log.timestamp.toISOString()
              }
            })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
          
          if (newLogs.length > 0) {
            lastTimestamp = newLogs[newLogs.length - 1].timestamp
          }
          
          // Send heartbeat
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`))
        } catch (error) {
          console.error('Stream error:', error)
        }
      }, 1000)
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
