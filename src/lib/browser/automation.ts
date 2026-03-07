import { chromium, Browser, Page, BrowserContext } from 'playwright'
import * as cheerio from 'cheerio'

// Browser instance manager
let browser: Browser | null = null
let context: BrowserContext | null = null

// Get or create browser instance
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    })
  }
  return browser
}

// Create a new browser context with optional credentials
async function createContext(options: {
  userAgent?: string
  viewport?: { width: number; height: number }
  storageState?: string
} = {}): Promise<BrowserContext> {
  const b = await getBrowser()
  
  context = await b.newContext({
    userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: options.viewport || { width: 1920, height: 1080 },
    storageState: options.storageState,
    // Bypass certain restrictions
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  })
  
  return context
}

// Browser actions interface
export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'wait' | 'scroll' | 'fill' | 'submit' | 'evaluate' | 'close'
  selector?: string
  value?: string
  timeout?: number
  waitFor?: 'load' | 'domcontentloaded' | 'networkidle'
}

export interface BrowserResult {
  success: boolean
  data?: any
  screenshot?: string
  error?: string
  url?: string
  title?: string
}

// Execute a series of browser actions
export async function executeBrowserActions(
  actions: BrowserAction[],
  options: {
    keepOpen?: boolean
    storageState?: string
  } = {}
): Promise<BrowserResult[]> {
  const results: BrowserResult[] = []
  let page: Page | null = null
  
  try {
    const ctx = await createContext({ storageState: options.storageState })
    page = await ctx.newPage()
    
    for (const action of actions) {
      try {
        const result = await executeAction(page, action)
        results.push(result)
        
        if (!result.success) {
          break
        }
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message
        })
        break
      }
    }
    
    // Get final state
    if (page) {
      const finalResult = results[results.length - 1]
      if (finalResult) {
        finalResult.url = page.url()
        finalResult.title = await page.title()
      }
    }
    
  } catch (error: any) {
    results.push({
      success: false,
      error: error.message
    })
  } finally {
    if (!options.keepOpen && page) {
      await page.close()
    }
    if (!options.keepOpen && context) {
      await context.close()
      context = null
    }
  }
  
  return results
}

// Execute single action
async function executeAction(page: Page, action: BrowserAction): Promise<BrowserResult> {
  const timeout = action.timeout || 30000
  
  switch (action.type) {
    case 'navigate':
      if (!action.value) {
        return { success: false, error: 'URL required for navigate action' }
      }
      await page.goto(action.value, {
        waitUntil: action.waitFor || 'networkidle',
        timeout
      })
      return { success: true, url: page.url(), title: await page.title() }
      
    case 'click':
      if (!action.selector) {
        return { success: false, error: 'Selector required for click action' }
      }
      await page.click(action.selector, { timeout })
      return { success: true, data: 'Clicked' }
      
    case 'type':
      if (!action.selector || !action.value) {
        return { success: false, error: 'Selector and value required for type action' }
      }
      await page.fill(action.selector, action.value, { timeout })
      return { success: true, data: `Typed: ${action.value}` }
      
    case 'fill':
      if (!action.selector || !action.value) {
        return { success: false, error: 'Selector and value required for fill action' }
      }
      await page.fill(action.selector, action.value, { timeout })
      return { success: true, data: `Filled: ${action.value}` }
      
    case 'screenshot':
      const screenshot = await page.screenshot({
        fullPage: action.value === 'full',
        type: 'png'
      })
      return {
        success: true,
        screenshot: screenshot.toString('base64'),
        data: 'Screenshot captured'
      }
      
    case 'extract':
      const content = await page.content()
      if (action.selector) {
        const elements = await page.$$(action.selector)
        const extracted = await Promise.all(
          elements.map(async el => ({
            text: await el.textContent(),
            html: await el.innerHTML()
          }))
        )
        return { success: true, data: extracted }
      }
      
      // Parse with cheerio for structured extraction
      const $ = cheerio.load(content)
      const extractedData = {
        title: $('title').text(),
        h1: $('h1').map((_, el) => $(el).text()).get(),
        links: $('a[href]').map((_, el) => ({
          text: $(el).text(),
          href: $(el).attr('href')
        })).get().slice(0, 20),
        forms: $('form').map((_, el) => ({
          action: $(el).attr('action'),
          method: $(el).attr('method'),
          inputs: $(el).find('input, textarea, select').map((_, inp) => ({
            name: $(inp).attr('name'),
            type: $(inp).attr('type'),
            id: $(inp).attr('id'),
            placeholder: $(inp).attr('placeholder')
          })).get()
        })).get(),
        buttons: $('button, input[type="submit"]').map((_, el) => ({
          text: $(el).text() || $(el).attr('value'),
          type: $(el).attr('type')
        })).get()
      }
      return { success: true, data: extractedData }
      
    case 'wait':
      if (action.selector) {
        await page.waitForSelector(action.selector, { timeout })
        return { success: true, data: `Waited for: ${action.selector}` }
      }
      await page.waitForTimeout(action.value ? parseInt(action.value) : 1000)
      return { success: true, data: `Waited ${action.value || 1000}ms` }
      
    case 'scroll':
      if (action.selector) {
        await page.locator(action.selector).scrollIntoViewIfNeeded()
      } else {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      }
      return { success: true, data: 'Scrolled' }
      
    case 'submit':
      if (!action.selector) {
        return { success: false, error: 'Selector required for submit action' }
      }
      await page.$eval(action.selector, (form: any) => form.submit())
      return { success: true, data: 'Form submitted' }
      
    case 'evaluate':
      if (!action.value) {
        return { success: false, error: 'JavaScript code required for evaluate action' }
      }
      const result = await page.evaluate(action.value)
      return { success: true, data: result }
      
    case 'close':
      await page.close()
      return { success: true, data: 'Page closed' }
      
    default:
      return { success: false, error: `Unknown action type: ${action.type}` }
  }
}

// Close browser completely
export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close()
    context = null
  }
  if (browser) {
    await browser.close()
    browser = null
  }
}

// Get page content and analyze forms
export async function analyzePage(url: string): Promise<{
  success: boolean
  forms?: any[]
  links?: any[]
  title?: string
  screenshot?: string
  error?: string
}> {
  try {
    const results = await executeBrowserActions([
      { type: 'navigate', value: url },
      { type: 'extract' },
      { type: 'screenshot' }
    ])
    
    const extractResult = results[1]
    const screenshotResult = results[2]
    
    return {
      success: true,
      forms: extractResult.data?.forms,
      links: extractResult.data?.links,
      title: extractResult.data?.title,
      screenshot: screenshotResult.screenshot
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}

// Register on a website
export async function registerOnSite(
  url: string,
  data: {
    email?: string
    name?: string
    password?: string
    username?: string
    customFields?: Record<string, string>
  }
): Promise<BrowserResult> {
  try {
    const results = await executeBrowserActions([
      { type: 'navigate', value: url },
      { type: 'extract' },
      { type: 'screenshot' }
    ])
    
    const pageData = results[1].data
    
    // Find registration form
    const forms = pageData?.forms || []
    const registrationForm = forms.find((f: any) => 
      f.inputs?.some((i: any) => 
        i.type === 'email' || 
        i.name?.includes('email') ||
        i.name?.includes('password') ||
        i.name?.includes('register') ||
        i.name?.includes('signup')
      )
    )
    
    if (!registrationForm) {
      return {
        success: false,
        error: 'Could not find registration form',
        data: { forms, links: pageData?.links }
      }
    }
    
    // Return form info for AI to decide how to fill
    return {
      success: true,
      data: {
        form: registrationForm,
        detectedFields: registrationForm.inputs,
        suggestedData: data
      },
      screenshot: results[2].screenshot
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}
