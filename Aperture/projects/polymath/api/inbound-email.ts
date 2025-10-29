/**
 * Inbound Email Handler
 * Receives forwarded newsletters/emails and adds them to reading queue
 * Uses SendGrid Inbound Parse webhook
 *
 * Setup:
 * 1. Go to SendGrid → Settings → Inbound Parse
 * 2. Add domain: clandestined.vercel.app
 * 3. Set webhook URL: https://clandestined.vercel.app/api/inbound-email
 * 4. Forward emails to: read@clandestined.vercel.app
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import { htmlToText } from 'html-to-text'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb' // Single-user app

function extractDomain(email: string): string {
  try {
    const match = email.match(/@(.+)$/)
    return match ? match[1] : 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Clean HTML content for better readability
 */
function cleanHtmlContent(html: string): string {
  try {
    // Convert HTML to clean text
    const text = htmlToText(html, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        { selector: 'a', options: { ignoreHref: false } },
        { selector: 'img', format: 'skip' },
        { selector: 'table', format: 'dataTable' }
      ]
    })

    return text
  } catch (error) {
    console.error('[Email] HTML cleaning error:', error)
    return html
  }
}

/**
 * Extract main content from email
 * Tries to find the actual newsletter content vs headers/footers
 */
function extractMainContent(html: string, text: string): { content: string; excerpt: string } {
  try {
    // Use text version for excerpt (first 200 chars)
    const plainText = text || cleanHtmlContent(html)
    const excerpt = plainText.substring(0, 200).trim()

    // For content, prefer HTML but clean it up
    let content = html || plainText

    // Remove common newsletter footers/unsubscribe sections
    content = content.replace(/unsubscribe|opt[- ]out|manage preferences/gi, '')

    return {
      content: content.trim(),
      excerpt: excerpt
    }
  } catch (error) {
    console.error('[Email] Content extraction error:', error)
    return {
      content: text || html || '',
      excerpt: (text || html || '').substring(0, 200)
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST from SendGrid
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('[Email] Received inbound email webhook')

    // Parse multipart form data from SendGrid
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFields: 50,
    })

    const [fields, files] = await form.parse(req)

    // Extract email data from SendGrid fields
    const from = Array.isArray(fields.from) ? fields.from[0] : fields.from || 'unknown'
    const subject = Array.isArray(fields.subject) ? fields.subject[0] : fields.subject || 'Untitled'
    const html = Array.isArray(fields.html) ? fields.html[0] : fields.html || ''
    const text = Array.isArray(fields.text) ? fields.text[0] : fields.text || ''
    const to = Array.isArray(fields.to) ? fields.to[0] : fields.to || ''

    console.log('[Email] From:', from, '| Subject:', subject)

    // Extract main content
    const { content, excerpt } = extractMainContent(html, text)

    // Calculate reading time
    const wordCount = content.split(/\s+/).length
    const readTimeMinutes = Math.ceil(wordCount / 225)

    // Determine source
    const sourceDomain = extractDomain(from)

    // Create article record
    const articleData = {
      user_id: USER_ID,
      url: `mailto:${from}`, // Use mailto as URL for email-based articles
      title: subject,
      author: from,
      content,
      excerpt,
      published_date: new Date().toISOString(),
      thumbnail_url: null,
      favicon_url: null,
      source: sourceDomain,
      read_time_minutes: readTimeMinutes,
      word_count: wordCount,
      status: 'unread',
      tags: ['email', 'newsletter', 'auto-imported'],
      created_at: new Date().toISOString(),
    }

    // Check if article already exists (by subject + author)
    const { data: existing } = await supabase
      .from('reading_queue')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('title', subject)
      .eq('author', from)
      .single()

    if (existing) {
      console.log('[Email] Article already exists:', subject)
      return res.status(200).json({
        success: true,
        message: 'Article already in queue',
        duplicate: true
      })
    }

    // Save to reading queue
    const { data, error } = await supabase
      .from('reading_queue')
      .insert([articleData])
      .select()
      .single()

    if (error) {
      console.error('[Email] Failed to save article:', error)
      throw error
    }

    console.log('[Email] Successfully saved article:', data.id)

    return res.status(200).json({
      success: true,
      message: 'Article added to reading queue',
      articleId: data.id
    })
  } catch (error) {
    console.error('[Email] Processing error:', error)

    // Return 200 to SendGrid so it doesn't retry
    // Log error but don't fail the webhook
    return res.status(200).json({
      success: false,
      error: 'Failed to process email',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Disable body parser for formidable
export const config = {
  api: {
    bodyParser: false,
  },
}
