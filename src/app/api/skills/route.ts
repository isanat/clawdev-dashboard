import { NextRequest, NextResponse } from 'next/server'
import { getSkills, toggleSkill, executeSkill, getSkillStats } from '@/lib/agent/skills'

export async function GET() {
  try {
    const skills = await getSkills()
    const stats = await getSkillStats()
    
    return NextResponse.json({
      success: true,
      data: {
        skills,
        stats
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get skills'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, skillId } = body
    
    if (action === 'toggle' && skillId) {
      const skill = await toggleSkill(skillId)
      
      if (!skill) {
        return NextResponse.json({
          success: false,
          error: 'Skill not found'
        }, { status: 404 })
      }
      
      return NextResponse.json({
        success: true,
        message: `Skill "${skill.name}" ${skill.enabled ? 'enabled' : 'disabled'}`,
        data: skill
      })
    }
    
    if (action === 'execute' && skillId) {
      const result = await executeSkill(skillId)
      
      return NextResponse.json({
        success: result.success,
        message: result.result,
        data: result
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use "toggle" or "execute" with skillId'
    }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process skill action'
    }, { status: 500 })
  }
}
