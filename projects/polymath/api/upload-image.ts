
import { getSupabaseClient } from './_lib/supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const supabase = getSupabaseClient()
        const { fileName, fileType, fileBase64 } = req.body

        if (!fileName || !fileType || !fileBase64) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(fileBase64, 'base64')

        // Upload using the Service Role Key (from getSupabaseClient)
        // This bypasses RLS
        const { data, error } = await supabase.storage
            .from('thought-images')
            .upload(fileName, buffer, {
                contentType: fileType,
                upsert: true
            })

        if (error) throw error

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from('thought-images')
            .getPublicUrl(fileName)

        return res.status(200).json({
            success: true,
            url: publicUrlData.publicUrl
        })

    } catch (error) {
        console.error('Upload failed:', error)
        return res.status(500).json({
            error: 'Upload failed',
            details: error instanceof Error ? error.message : String(error)
        })
    }
}
