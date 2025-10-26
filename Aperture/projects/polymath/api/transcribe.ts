/**
 * Audio Transcription Endpoint
 * Uses Google Gemini API to transcribe audio from native recordings
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { File as FormidableFile } from 'formidable'
import formidable from 'formidable'
import fs from 'fs'

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Disable default body parser to handle multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parse multipart form data
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB max
    })

    const { files } = await new Promise<{ files: formidable.Files }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ files })
      })
    })

    // Get audio file
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    const file = audioFile as FormidableFile

    // Read audio file as base64
    const audioData = fs.readFileSync(file.filepath)
    const base64Audio = audioData.toString('base64')

    // Use Gemini 1.5 Flash for audio transcription
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: file.mimetype || 'audio/aac',
          data: base64Audio
        }
      },
      'Transcribe this audio recording. Return only the transcribed text, nothing else.'
    ])

    const response = await result.response
    const text = response.text().trim()

    // Clean up temp file
    fs.unlinkSync(file.filepath)

    return res.status(200).json({
      success: true,
      text: text,
    })

  } catch (error) {
    console.error('[api/transcribe] Error:', error)
    return res.status(500).json({
      error: 'Transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
