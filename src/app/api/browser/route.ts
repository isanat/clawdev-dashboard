import { NextRequest, NextResponse } from 'next/server'
import { 
  executeBrowserActions, 
  analyzePage, 
  closeBrowser,
  BrowserAction 
} from '@/lib/browser/automation'

// GET - Browser status
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')
  const url = searchParams.get('url')
  
  if (action === 'analyze' && url) {
    const result = await analyzePage(url)
    return NextResponse.json(result)
  }
  
  return NextResponse.json({
    success: true,
    message: 'CLAWDEV Browser Automation API',
    capabilities: [
      'navigate - Navigate to URL',
      'click - Click on element',
      'type - Type text into input',
      'fill - Fill form field',
      'screenshot - Capture page screenshot',
      'extract - Extract page content',
      'wait - Wait for element or timeout',
      'scroll - Scroll page',
      'submit - Submit form',
      'evaluate - Execute JavaScript',
      'close - Close browser'
    ],
    endpoints: {
      'GET /api/browser?action=analyze&url=URL': 'Analyze a webpage',
      'POST /api/browser': 'Execute browser actions',
      'DELETE /api/browser': 'Close browser'
    }
  })
}

// POST - Execute browser actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actions, options } = body as { 
      actions: BrowserAction[], 
      options?: { keepOpen?: boolean } 
    }
    
    if (!actions || !Array.isArray(actions)) {
      return NextResponse.json({
        success: false,
        error: 'Actions array required'
      }, { status: 400 })
    }
    
    const results = await executeBrowserActions(actions, options)
    
    return NextResponse.json({
      success: results.every(r => r.success),
      results,
      actionCount: actions.length,
      successCount: results.filter(r => r.success).length
    })
    
  } catch (error: any) {
    console.error('Browser action error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// DELETE - Close browser
export async function DELETE() {
  try {
    await closeBrowser()
    return NextResponse.json({
      success: true,
      message: 'Browser closed'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
