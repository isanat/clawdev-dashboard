import { db } from '@/lib/db'
import type { Learning } from '@/types'

// Store a new learning
export async function storeLearning(
  insight: string,
  category: 'error' | 'optimization' | 'pattern' | 'security',
  context?: string,
  actionTaken?: string,
  success: boolean = true
): Promise<Learning> {
  const learning = await db.learning.create({
    data: {
      insight,
      category,
      context,
      actionTaken,
      success
    }
  })
  
  return {
    id: learning.id,
    insight: learning.insight,
    category: learning.category as 'error' | 'optimization' | 'pattern' | 'security',
    context: learning.context || undefined,
    actionTaken: learning.actionTaken || undefined,
    success: learning.success,
    createdAt: learning.createdAt.toISOString()
  }
}

// Get all learnings
export async function getLearnings(limit: number = 50, category?: string): Promise<Learning[]> {
  const where = category ? { category } : {}
  
  const learnings = await db.learning.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' }
  })
  
  return learnings.map(l => ({
    id: l.id,
    insight: l.insight,
    category: l.category as 'error' | 'optimization' | 'pattern' | 'security',
    context: l.context || undefined,
    actionTaken: l.actionTaken || undefined,
    success: l.success,
    createdAt: l.createdAt.toISOString()
  }))
}

// Get learning by ID
export async function getLearningById(id: string): Promise<Learning | null> {
  const learning = await db.learning.findUnique({
    where: { id }
  })
  
  if (!learning) return null
  
  return {
    id: learning.id,
    insight: learning.insight,
    category: learning.category as 'error' | 'optimization' | 'pattern' | 'security',
    context: learning.context || undefined,
    actionTaken: learning.actionTaken || undefined,
    success: learning.success,
    createdAt: learning.createdAt.toISOString()
  }
}

// Search learnings by insight text
export async function searchLearnings(query: string, limit: number = 20): Promise<Learning[]> {
  const learnings = await db.learning.findMany({
    where: {
      insight: {
        contains: query
      }
    },
    take: limit,
    orderBy: { createdAt: 'desc' }
  })
  
  return learnings.map(l => ({
    id: l.id,
    insight: l.insight,
    category: l.category as 'error' | 'optimization' | 'pattern' | 'security',
    context: l.context || undefined,
    actionTaken: l.actionTaken || undefined,
    success: l.success,
    createdAt: l.createdAt.toISOString()
  }))
}

// Get learnings statistics
export async function getLearningStats(): Promise<{
  total: number
  byCategory: Record<string, number>
  successRate: number
}> {
  const total = await db.learning.count()
  
  const categories = await db.learning.groupBy({
    by: ['category'],
    _count: true
  })
  
  const successful = await db.learning.count({
    where: { success: true }
  })
  
  const byCategory: Record<string, number> = {}
  for (const cat of categories) {
    byCategory[cat.category] = cat._count
  }
  
  return {
    total,
    byCategory,
    successRate: total > 0 ? (successful / total) * 100 : 0
  }
}

// Delete old learnings (cleanup)
export async function cleanupOldLearnings(keepLast: number = 100): Promise<number> {
  const learnings = await db.learning.findMany({
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    skip: keepLast
  })
  
  if (learnings.length === 0) return 0
  
  const idsToDelete = learnings.map(l => l.id)
  
  await db.learning.deleteMany({
    where: {
      id: { in: idsToDelete }
    }
  })
  
  return idsToDelete.length
}

// Store chat message
export async function storeChatMessage(
  role: 'user' | 'assistant',
  content: string,
  provider?: 'zai' | 'groq' | 'local'
): Promise<void> {
  await db.chatMessage.create({
    data: {
      role,
      content,
      provider
    }
  })
}

// Get chat history
export async function getChatHistory(limit: number = 50): Promise<{
  role: string
  content: string
}[]> {
  const messages = await db.chatMessage.findMany({
    take: limit,
    orderBy: { timestamp: 'desc' }
  })
  
  return messages.reverse().map(m => ({
    role: m.role,
    content: m.content
  }))
}

// Clear chat history
export async function clearChatHistory(): Promise<void> {
  await db.chatMessage.deleteMany()
}
