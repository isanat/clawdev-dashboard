import { db } from '@/lib/db'
import type { Skill, SkillExecution } from '@/types'

// Default skills configuration
const defaultSkills: Omit<Skill, 'id' | 'usageCount' | 'lastUsed'>[] = [
  {
    name: 'Code Scanner',
    description: 'Scans codebase for issues, vulnerabilities, and code smells',
    enabled: true,
    category: 'scanner',
    status: 'idle',
    icon: '🔍'
  },
  {
    name: 'Log Analyzer',
    description: 'Analyzes system logs to detect patterns and anomalies',
    enabled: true,
    category: 'analyzer',
    status: 'idle',
    icon: '📊'
  },
  {
    name: 'Security Auditor',
    description: 'Performs security audits and vulnerability assessments',
    enabled: true,
    category: 'security',
    status: 'idle',
    icon: '🛡️'
  },
  {
    name: 'Auto-Fix Engine',
    description: 'Automatically detects and fixes common issues',
    enabled: true,
    category: 'automation',
    status: 'idle',
    icon: '🔧'
  },
  {
    name: 'API Profiler',
    description: 'Monitors and profiles API performance and health',
    enabled: true,
    category: 'analyzer',
    status: 'idle',
    icon: '📡'
  },
  {
    name: 'Resource Monitor',
    description: 'Monitors system resources and triggers alerts',
    enabled: true,
    category: 'analyzer',
    status: 'active',
    icon: '💻'
  },
  {
    name: 'Deployment Watcher',
    description: 'Monitors deployment status and health checks',
    enabled: false,
    category: 'automation',
    status: 'idle',
    icon: '🚀'
  },
  {
    name: 'Error Tracker',
    description: 'Tracks and categorizes errors for analysis',
    enabled: true,
    category: 'analyzer',
    status: 'active',
    icon: '🐛'
  }
]

// Initialize default skills in database
export async function initializeSkills(): Promise<void> {
  for (const skill of defaultSkills) {
    const existing = await db.skill.findUnique({
      where: { name: skill.name }
    })
    
    if (!existing) {
      await db.skill.create({
        data: {
          name: skill.name,
          description: skill.description,
          enabled: skill.enabled,
          category: skill.category,
          usageCount: 0
        }
      })
    }
  }
}

// Get all skills
export async function getSkills(): Promise<Skill[]> {
  await initializeSkills()
  
  const skills = await db.skill.findMany({
    orderBy: { name: 'asc' }
  })
  
  return skills.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    enabled: s.enabled,
    usageCount: s.usageCount,
    lastUsed: s.lastUsed?.toISOString(),
    category: s.category as 'scanner' | 'analyzer' | 'security' | 'automation',
    status: s.enabled ? 'idle' : 'idle' as const,
    icon: defaultSkills.find(ds => ds.name === s.name)?.icon || '⚙️'
  }))
}

// Toggle skill enabled status
export async function toggleSkill(skillId: string): Promise<Skill | null> {
  const skill = await db.skill.findUnique({
    where: { id: skillId }
  })
  
  if (!skill) return null
  
  const updated = await db.skill.update({
    where: { id: skillId },
    data: { enabled: !skill.enabled }
  })
  
  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    enabled: updated.enabled,
    usageCount: updated.usageCount,
    lastUsed: updated.lastUsed?.toISOString(),
    category: updated.category as 'scanner' | 'analyzer' | 'security' | 'automation',
    status: updated.enabled ? 'idle' : 'idle' as const,
    icon: defaultSkills.find(ds => ds.name === updated.name)?.icon || '⚙️'
  }
}

// Execute a skill (simulation)
export async function executeSkill(skillId: string): Promise<SkillExecution> {
  const skill = await db.skill.findUnique({
    where: { id: skillId }
  })
  
  if (!skill) {
    return {
      skillId,
      result: 'Skill not found',
      success: false,
      duration: 0
    }
  }
  
  if (!skill.enabled) {
    return {
      skillId,
      result: 'Skill is disabled',
      success: false,
      duration: 0
    }
  }
  
  const startTime = Date.now()
  
  // Simulate skill execution based on category
  let result = ''
  let success = true
  
  switch (skill.category) {
    case 'scanner':
      result = await simulateScan(skill.name)
      break
    case 'analyzer':
      result = await simulateAnalysis(skill.name)
      break
    case 'security':
      result = await simulateSecurityAudit(skill.name)
      break
    case 'automation':
      result = await simulateAutomation(skill.name)
      break
    default:
      result = 'Unknown skill category'
      success = false
  }
  
  const duration = Date.now() - startTime
  
  // Update skill usage
  await db.skill.update({
    where: { id: skillId },
    data: {
      usageCount: { increment: 1 },
      lastUsed: new Date()
    }
  })
  
  // Log execution
  await db.log.create({
    data: {
      level: success ? 'INFO' : 'ERROR',
      message: `Skill "${skill.name}" executed: ${result}`,
      source: 'skill',
      metadata: JSON.stringify({ skillId, duration, success })
    }
  })
  
  return {
    skillId,
    result,
    success,
    duration
  }
}

// Simulation functions
async function simulateScan(skillName: string): Promise<string> {
  await new Promise(r => setTimeout(r, Math.random() * 1000 + 500))
  const issuesFound = Math.floor(Math.random() * 10)
  return `${skillName} completed. Found ${issuesFound} potential issues.`
}

async function simulateAnalysis(skillName: string): Promise<string> {
  await new Promise(r => setTimeout(r, Math.random() * 800 + 300))
  const patternsFound = Math.floor(Math.random() * 5)
  return `${skillName} completed. Detected ${patternsFound} patterns.`
}

async function simulateSecurityAudit(skillName: string): Promise<string> {
  await new Promise(r => setTimeout(r, Math.random() * 1500 + 500))
  const vulnerabilities = Math.floor(Math.random() * 3)
  if (vulnerabilities > 0) {
    return `${skillName} completed. Found ${vulnerabilities} security recommendations.`
  }
  return `${skillName} completed. No critical vulnerabilities detected.`
}

async function simulateAutomation(skillName: string): Promise<string> {
  await new Promise(r => setTimeout(r, Math.random() * 600 + 200))
  return `${skillName} completed. Automated task executed successfully.`
}

// Get skill statistics
export async function getSkillStats(): Promise<{
  total: number
  enabled: number
  totalUsage: number
  byCategory: Record<string, number>
}> {
  const skills = await db.skill.findMany()
  
  const enabled = skills.filter(s => s.enabled).length
  const totalUsage = skills.reduce((sum, s) => sum + s.usageCount, 0)
  
  const byCategory: Record<string, number> = {}
  for (const skill of skills) {
    byCategory[skill.category] = (byCategory[skill.category] || 0) + 1
  }
  
  return {
    total: skills.length,
    enabled,
    totalUsage,
    byCategory
  }
}
