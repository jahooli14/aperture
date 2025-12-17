
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
        const { fileName, fileType } = req.body

        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'Missing required fields: fileName, fileType' })
        }

        console.log('[upload-image] Generating signed URL for:', { fileName, fileType })

        // Create a Signed Upload URL
        // Tries to upload to 'thought-images' bucket
        // The token allows uploading a specific file for a limited time (e.g. 60s)
        const { data, error } = await supabase.storage
            .from('thought-images')
            .createSignedUploadUrl(fileName)

        if (error) {
            console.error('[upload-image] Failed to create signed URL:', error)
            throw error
        }

        // Return the signed URL for the frontend to PUT the file to
        // And the public URL for reference after upload
        const { data: publicUrlData } = supabase.storage
            .from('thought-images')
            .getPublicUrl(fileName)

        return res.status(200).json({
            success: true,
            signedUrl: data.signedUrl,
            path: data.path, // Internal storage path
            token: data.token, // Upload token if needed manually
            publicUrl: publicUrlData.publicUrl
        })

    } catch (error) {
        console.error('Upload preparation failed:', error)
        return res.status(500).json({
            error: 'Upload preparation failed',
            details: error instanceof Error ? error.message : String(error)
        })
    }
}
