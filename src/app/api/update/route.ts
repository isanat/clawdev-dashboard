import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação simples via header
    const authHeader = request.headers.get('authorization')
    const expectedAuth = 'Bearer Clawdev2024!'

    if (authHeader !== expectedAuth) {
      return NextResponse.json({
        success: false,
        error: 'Não autorizado'
      }, { status: 401 })
    }

    console.log('[UPDATE] Iniciando atualização...')

    // Git stash to save local changes
    console.log('[UPDATE] Fazendo stash das alterações locais...')
    try {
      await execAsync('git stash', {
        cwd: '/root/clawdev-dashboard',
        timeout: 30000
      })
    } catch (e) {
      console.log('[UPDATE] Nenhum stash necessário')
    }

    // Git pull
    console.log('[UPDATE] Executando git pull...')
    const pullResult = await execAsync('git pull origin main', {
      cwd: '/root/clawdev-dashboard',
      timeout: 60000
    })
    console.log('[UPDATE] Git pull:', pullResult.stdout)

    // Bun install
    console.log('[UPDATE] Instalando dependências...')
    const installResult = await execAsync('bun install', {
      cwd: '/root/clawdev-dashboard',
      timeout: 120000
    })
    console.log('[UPDATE] Bun install:', installResult.stdout)

    // Build
    console.log('[UPDATE] Compilando projeto...')
    const buildResult = await execAsync('bun run build', {
      cwd: '/root/clawdev-dashboard',
      timeout: 180000
    })
    console.log('[UPDATE] Build:', buildResult.stdout?.slice(-500))

    // PM2 restart
    console.log('[UPDATE] Reiniciando PM2...')
    const restartResult = await execAsync('pm2 restart clawdev', {
      cwd: '/root/clawdev-dashboard',
      timeout: 30000
    })
    console.log('[UPDATE] PM2 restart:', restartResult.stdout)

    // PM2 status
    const statusResult = await execAsync('pm2 status clawdev', {
      cwd: '/root/clawdev-dashboard',
      timeout: 10000
    })

    return NextResponse.json({
      success: true,
      message: 'CLAWDEV atualizado com sucesso!',
      results: {
        pull: pullResult.stdout || pullResult.stderr,
        install: installResult.stdout || installResult.stderr,
        build: (buildResult.stdout || buildResult.stderr)?.slice(-500),
        restart: restartResult.stdout || restartResult.stderr,
        status: statusResult.stdout || statusResult.stderr
      }
    })

  } catch (error: any) {
    console.error('[UPDATE] Erro:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stderr: error.stderr || null
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Endpoint de atualização do CLAWDEV',
    usage: 'POST /api/update com header Authorization: Bearer Clawdev2024!'
  })
}
