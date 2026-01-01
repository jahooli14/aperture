
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
            console.error('[upload-image] Missing required fields:', { fileName, fileType })
            return res.status(400).json({
                error: 'Missing required fields: fileName, fileType',
                details: 'Both fileName and fileType are required'
            })
        }

        // Validate file type
        if (!fileType.startsWith('image/')) {
            console.error('[upload-image] Invalid file type:', fileType)
            return res.status(400).json({
                error: 'Invalid file type',
                details: 'Only image files are allowed'
            })
        }

        console.log('[upload-image] Generating signed URL for:', { fileName, fileType })

        // Create a Signed Upload URL
        // Tries to upload to 'thought-images' bucket
        // The token allows uploading a specific file for a limited time (e.g. 60s)
        const { data, error } = await supabase.storage
            .from('thought-images')
            .createSignedUploadUrl(fileName)

        if (error) {
            console.error('[upload-image] Supabase error creating signed URL:', {
                message: error.message,
                name: error.name
            })
            return res.status(500).json({
                error: 'Failed to create upload URL',
                details: error.message || 'Supabase storage error'
            })
        }

        if (!data || !data.signedUrl) {
            console.error('[upload-image] No signed URL returned from Supabase')
            return res.status(500).json({
                error: 'Failed to create upload URL',
                details: 'No signed URL returned from storage'
            })
        }

        // Return the signed URL for the frontend to PUT the file to
        // And the public URL for reference after upload
        const { data: publicUrlData } = supabase.storage
            .from('thought-images')
            .getPublicUrl(fileName)

        console.log('[upload-image] Successfully generated URLs for:', fileName)

        return res.status(200).json({
            success: true,
            signedUrl: data.signedUrl,
            path: data.path, // Internal storage path
            token: data.token, // Upload token if needed manually
            publicUrl: publicUrlData.publicUrl
        })

    } catch (error) {
        console.error('[upload-image] Unexpected error:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        })
        return res.status(500).json({
            error: 'Upload preparation failed',
            details: error instanceof Error ? error.message : String(error)
        })
    }
}
