import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

// Email configuration
const getEmailConfig = () => ({
  user: process.env.GMAIL_USER || 'clawdevagenteai@gmail.com',
  pass: process.env.GMAIL_PASS || ''
})

// Create SMTP transporter
const createTransporter = () => {
  const config = getEmailConfig()
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: config.user,
      pass: config.pass
    }
  })
}

// GET - Check inbox using IMAP-like functionality via Gmail API simulation
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action') || 'inbox'
    
    // For now, return status - real implementation would use Gmail API
    // with OAuth2 for full email reading capability
    
    return NextResponse.json({
      success: true,
      email: getEmailConfig().user,
      message: 'Email API ready. For full inbox access, Gmail API with OAuth2 is recommended.',
      alternatives: [
        'Use Gmail API with OAuth2 for full inbox access',
        'Use IMAP with App Password (requires 2FA enabled)',
        'Use a temporary email service for testing'
      ],
      note: 'To read emails, enable 2FA on Gmail and create an App Password, or use Gmail API with OAuth2'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Send email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, text, html, from } = body
    
    if (!to || !subject) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: to, subject'
      }, { status: 400 })
    }
    
    const config = getEmailConfig()
    
    if (!config.pass) {
      return NextResponse.json({
        success: false,
        error: 'Email not configured. Set GMAIL_PASS in environment variables.',
        note: 'For Gmail: Enable 2FA and create an App Password at https://myaccount.google.com/apppasswords'
      }, { status: 400 })
    }
    
    const transporter = createTransporter()
    
    const mailOptions = {
      from: from || `"CLAWDEV AI Agent" <${config.user}>`,
      to,
      subject,
      text: text || '',
      html: html || text || ''
    }
    
    const info = await transporter.sendMail(mailOptions)
    
    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully',
      from: config.user,
      to
    })
    
  } catch (error: any) {
    console.error('Email send error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code
    }, { status: 500 })
  }
}
