/**
 * Capability Scanner
 * Scans Aperture codebase to extract technical capabilities
 * Generates embeddings and populates capabilities table
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
// Load environment variables from .env.local
config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Project definitions - what to scan and what capabilities to extract
const APERTURE_PROJECTS = [
    {
        name: 'memory-os',
        path: '../memory-os',
        capabilities: [
            {
                name: 'voice-processing',
                description: 'Voice note capture and processing via Audiopen webhook integration. Converts spoken thoughts into structured text.',
                codeRefs: [
                    { file: 'api/capture.ts', function: 'handler', line: 14 },
                    { file: 'src/types.ts', type: 'AudiopenWebhook' }
                ]
            },
            {
                name: 'embeddings',
                description: 'Vector embeddings for semantic search using OpenAI API. Enables finding similar memories by meaning, not just keywords.',
                codeRefs: [
                    { file: 'src/lib/process.ts', function: 'processMemory' }
                ]
            },
            {
                name: 'knowledge-graph',
                description: 'Entity extraction and relationship mapping. Builds a graph of people, places, topics, and their connections.',
                codeRefs: [
                    { file: 'src/lib/bridges.ts', function: 'findBridges' },
                    { file: 'src/lib/gemini.ts', function: 'extractEntities' }
                ]
            },
            {
                name: 'pgvector-search',
                description: 'PostgreSQL vector similarity search with pgvector. Fast semantic search at database level.',
                codeRefs: [
                    { file: 'migrations.sql', function: 'search_similar_memories' }
                ]
            },
            {
                name: 'bridge-finding',
                description: 'Multi-signal bridge detection: entity matching, semantic similarity, and temporal proximity. Surfaces unexpected connections.',
                codeRefs: [
                    { file: 'src/lib/bridges.ts', function: 'findBridges' }
                ]
            },
            {
                name: 'async-processing',
                description: 'Background job processing for memory analysis. Non-blocking webhook response with async entity extraction.',
                codeRefs: [
                    { file: 'api/capture.ts', line: 62 },
                    { file: 'api/process.ts', function: 'handler' }
                ]
            }
        ]
    },
    {
        name: 'wizard-of-oz',
        path: '../wizard-of-oz',
        capabilities: [
            {
                name: 'face-alignment',
                description: 'Face detection and alignment for baby photos. Ensures faces are centered and properly positioned.',
                codeRefs: [
                    { file: 'api/align.ts' }
                ]
            },
            {
                name: 'image-processing',
                description: 'Image manipulation, optimization, and transformation. Resize, crop, format conversion.',
                codeRefs: [
                    { file: 'src/lib/images.ts' }
                ]
            },
            {
                name: 'supabase-storage',
                description: 'Supabase storage integration for photo uploads and retrieval. Secure cloud storage with CDN.',
                codeRefs: [
                    { file: 'src/lib/storage.ts' }
                ]
            }
        ]
    },
    {
        name: 'autonomous-docs',
        path: '../../scripts/autonomous-docs',
        capabilities: [
            {
                name: 'documentation-generation',
                description: 'AI-powered documentation creation and optimization. Uses Claude to write clear, concise docs.',
                codeRefs: [
                    { file: 'update.ts' }
                ]
            },
            {
                name: 'knowledge-updates',
                description: 'Automated knowledge base updates from web sources. Fetches latest best practices and replaces outdated content.',
                codeRefs: [
                    { file: 'update.ts', function: 'updateKnowledge' }
                ]
            },
            {
                name: 'web-scraping',
                description: 'Fetch and parse web content for documentation updates. Extract text from Anthropic docs, blog posts, etc.',
                codeRefs: [
                    { file: 'update.ts' }
                ]
            }
        ]
    },
    {
        name: 'self-healing-tests',
        path: '../../scripts/self-healing-tests',
        capabilities: [
            {
                name: 'test-repair',
                description: 'Automated test repair system. Detects failures and applies fixes autonomously.',
                codeRefs: [
                    { file: 'repair.ts' }
                ]
            },
            {
                name: 'test-analysis',
                description: 'Test failure analysis and root cause detection. Identifies patterns in test failures.',
                codeRefs: [
                    { file: 'analyze.ts' }
                ]
            }
        ]
    },
    {
        name: 'polymath',
        path: '../polymath',
        capabilities: [
            {
                name: 'creative-synthesis',
                description: 'AI-powered project idea generation from capability combinations. Discovers novel Venn diagram overlaps.',
                codeRefs: [
                    { file: 'scripts/synthesis.ts' }
                ]
            },
            {
                name: 'point-allocation',
                description: 'Multi-factor scoring algorithm: novelty + feasibility + interest. Ranks suggestions intelligently.',
                codeRefs: [
                    { file: 'scripts/synthesis.ts', function: 'allocatePoints' }
                ]
            },
            {
                name: 'diversity-injection',
                description: 'Anti-echo-chamber wild card suggestions. Prevents creative narrowing by surfacing unpopular ideas.',
                codeRefs: [
                    { file: 'scripts/synthesis.ts', function: 'getWildcard' }
                ]
            }
        ]
    }
];
// Core capabilities shared across projects
const SHARED_CAPABILITIES = [
    {
        name: 'react-typescript',
        description: 'React + TypeScript frontend development. Type-safe component architecture.',
        source_project: 'shared',
        codeRefs: []
    },
    {
        name: 'vite',
        description: 'Vite build tool for fast development and optimized production builds.',
        source_project: 'shared',
        codeRefs: []
    },
    {
        name: 'supabase-postgres',
        description: 'Supabase PostgreSQL database with Row Level Security. Managed backend database.',
        source_project: 'shared',
        codeRefs: []
    },
    {
        name: 'vercel-deployment',
        description: 'Vercel serverless deployment with automatic builds and previews.',
        source_project: 'shared',
        codeRefs: []
    },
    {
        name: 'gemini-ai',
        description: 'Google Gemini 2.0 Flash for fast AI processing and synthesis. Multimodal model with excellent quality and low cost.',
        source_project: 'shared',
        codeRefs: []
    },
    {
        name: 'gemini-embeddings',
        description: 'Gemini text-embedding-004 for vector representations. 768-dimensional embeddings for semantic search.',
        source_project: 'shared',
        codeRefs: []
    }
];
/**
 * Generate embedding for capability description
 */
async function generateEmbedding(text) {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
}
/**
 * Scan codebase and populate capabilities table
 */
export async function scanCapabilities() {
    console.log('🔍 Starting capability scan...\n');
    const allCapabilities = [];
    // Scan project-specific capabilities
    for (const project of APERTURE_PROJECTS) {
        console.log(`📁 Scanning ${project.name}...`);
        for (const cap of project.capabilities) {
            console.log(`  ✓ ${cap.name}`);
            // Generate embedding
            const embedding = await generateEmbedding(`${cap.name}: ${cap.description}`);
            allCapabilities.push({
                name: cap.name,
                description: cap.description,
                source_project: project.name,
                code_references: cap.codeRefs,
                embedding,
                strength: 1.0,
            });
        }
    }
    // Add shared capabilities
    console.log('\n📦 Adding shared capabilities...');
    for (const cap of SHARED_CAPABILITIES) {
        console.log(`  ✓ ${cap.name}`);
        const embedding = await generateEmbedding(`${cap.name}: ${cap.description}`);
        allCapabilities.push({
            name: cap.name,
            description: cap.description,
            source_project: cap.source_project,
            code_references: cap.codeRefs,
            embedding,
            strength: 1.0,
        });
    }
    // Insert into database
    console.log(`\n💾 Inserting ${allCapabilities.length} capabilities into database...`);
    const { data, error } = await supabase
        .from('capabilities')
        .upsert(allCapabilities, {
        onConflict: 'name',
        ignoreDuplicates: false,
    })
        .select();
    if (error) {
        console.error('❌ Error inserting capabilities:', error);
        throw error;
    }
    console.log(`✅ Successfully populated ${data?.length || 0} capabilities\n`);
    // Print summary
    console.log('📊 Capability Summary:');
    const byProject = allCapabilities.reduce((acc, cap) => {
        const proj = cap.source_project || 'shared';
        acc[proj] = (acc[proj] || 0) + 1;
        return acc;
    }, {});
    for (const [project, count] of Object.entries(byProject)) {
        console.log(`  ${project}: ${count} capabilities`);
    }
    return data;
}
/**
 * Update capability strength based on usage
 */
export async function updateCapabilityStrength(capabilityName, increment) {
    const { data: capability } = await supabase
        .from('capabilities')
        .select('id, strength')
        .eq('name', capabilityName)
        .single();
    if (!capability) {
        console.warn(`Capability not found: ${capabilityName}`);
        return;
    }
    const newStrength = capability.strength + increment;
    const { error } = await supabase
        .from('capabilities')
        .update({
        strength: newStrength,
        last_used: new Date().toISOString(),
    })
        .eq('id', capability.id);
    if (error) {
        console.error('Error updating capability strength:', error);
        throw error;
    }
    console.log(`Updated ${capabilityName} strength: ${capability.strength} → ${newStrength}`);
}
/**
 * Get strongest capabilities
 */
export async function getStrongestCapabilities(limit = 10) {
    const { data, error } = await supabase
        .from('capabilities')
        .select('name, description, strength, source_project')
        .order('strength', { ascending: false })
        .limit(limit);
    if (error) {
        console.error('Error fetching capabilities:', error);
        throw error;
    }
    return data;
}
/**
 * Find similar capabilities by embedding
 */
export async function findSimilarCapabilities(queryText, threshold = 0.7, limit = 5) {
    const embedding = await generateEmbedding(queryText);
    const { data, error } = await supabase.rpc('search_similar_capabilities', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
    });
    if (error) {
        console.error('Error searching capabilities:', error);
        throw error;
    }
    return data;
}
// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    scanCapabilities()
        .then(() => {
        console.log('\n✨ Capability scan complete!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('\n❌ Capability scan failed:', error);
        process.exit(1);
    });
}
