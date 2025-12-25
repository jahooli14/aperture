/**
 * Test endpoint to diagnose list enrichment issues
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { enrichListItem } from './_lib/list-enrichment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Test enrichment with a simple item
    const testContent = req.query.item as string || "The Shawshank Redemption"
    
    try {
        console.log('[Test] Starting enrichment test for:', testContent)
        console.log('[Test] GEMINI_API_KEY configured:', !!process.env.GEMINI_API_KEY)
        console.log('[Test] GEMINI_API_KEY length:', process.env.GEMINI_API_KEY?.length || 0)
        
        // Create fake test data
        const result = await enrichListItem(
            'test-user',
            'test-list',
            'test-item',
            testContent,
            'film'
        )
        
        return res.status(200).json({
            success: true,
            content: testContent,
            result
        })
    } catch (error: any) {
        console.error('[Test] Enrichment failed:', error)
        return res.status(500).json({
            success: false,
            error: error.message,
            errorType: error.name,
            stack: error.stack?.split('\n').slice(0, 5),
            env: {
                hasGeminiKey: !!process.env.GEMINI_API_KEY,
                keyLength: process.env.GEMINI_API_KEY?.length || 0
            }
        })
    }
}
