import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedAuth = 'Bearer Clawdev2024!'

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    console.log('[UPDATE-DEV] Iniciando atualização...')

    // Git stash
    try {
      await execAsync('git stash', { cwd: '/root/clawdev-dashboard', timeout: 30000 })
    } catch (e) {}

    // Git pull
    const pullResult = await execAsync('git pull origin main', { cwd: '/root/clawdev-dashboard', timeout: 60000 })

    // Bun install
    const installResult = await execAsync('bun install', { cwd: '/root/clawdev-dashboard', timeout: 120000 })

    // Kill any process on port 3000
    try {
      await execAsync('fuser -k 3000/tcp 2>/dev/null || true', { timeout: 10000 })
    } catch (e) {}

    // Start in dev mode (no build needed)
    await execAsync('pm2 delete clawdev 2>/dev/null || true', { timeout: 10000 })
    await execAsync('pm2 start bun --name clawdev -- run dev -- -p 3000', { cwd: '/root/clawdev-dashboard', timeout: 30000 })
    await execAsync('pm2 save', { timeout: 10000 })

    // Wait for server to start
    await execAsync('sleep 5', { timeout: 10000 })

    // Check status
    const statusResult = await execAsync('pm2 status', { timeout: 10000 })

    return NextResponse.json({
      success: true,
      message: 'CLAWDEV atualizado e rodando em modo dev!',
      results: {
        pull: pullResult.stdout || pullResult.stderr,
        install: installResult.stdout || installResult.stderr,
        status: statusResult.stdout || statusResult.stderr
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stderr: error.stderr
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'CLAWDEV Quick Update (dev mode)',
    usage: 'POST /api/update-dev com Authorization: Bearer Clawdev2024!'
  })
}
