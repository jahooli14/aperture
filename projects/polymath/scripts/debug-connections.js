/**
 * Debug script to check why connections aren't being created
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function debugConnections() {
    console.log('\n=== DEBUGGING CONNECTIONS ===\n');
    // 1. Check memories
    const { data: memories, error: memError } = await supabase
        .from('memories')
        .select('id, title, processed, embedding')
        .order('created_at', { ascending: false })
        .limit(10);
    if (memError) {
        console.error('Error fetching memories:', memError);
        return;
    }
    console.log('📝 Recent Memories:');
    console.log(`Total fetched: ${memories?.length || 0}`);
    memories?.forEach(m => {
        console.log(`  - ${m.title?.substring(0, 50)}`);
        console.log(`    Processed: ${m.processed}, Has embedding: ${!!m.embedding}`);
    });
    const withEmbeddings = memories?.filter(m => m.embedding).length || 0;
    console.log(`\n✓ Memories with embeddings: ${withEmbeddings}/${memories?.length || 0}`);
    // 2. Check projects
    const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('id, title, embedding')
        .limit(10);
    if (projError) {
        console.error('Error fetching projects:', projError);
    }
    else {
        const projWithEmbeddings = projects?.filter(p => p.embedding).length || 0;
        console.log(`📁 Projects with embeddings: ${projWithEmbeddings}/${projects?.length || 0}`);
    }
    // 3. Check articles
    const { data: articles, error: artError } = await supabase
        .from('reading_queue')
        .select('id, title, embedding')
        .limit(10);
    if (artError) {
        console.error('Error fetching articles:', artError);
    }
    else {
        const artWithEmbeddings = articles?.filter(a => a.embedding).length || 0;
        console.log(`📰 Articles with embeddings: ${artWithEmbeddings}/${articles?.length || 0}`);
    }
    // 4. Check connections
    const { data: connections, error: connError } = await supabase
        .from('connections')
        .select('*');
    if (connError) {
        console.error('Error fetching connections:', connError);
    }
    else {
        console.log(`\n🔗 Total connections: ${connections?.length || 0}`);
        if (connections && connections.length > 0) {
            console.log('Sample connections:');
            connections.slice(0, 5).forEach(c => {
                console.log(`  ${c.source_type}:${c.source_id} → ${c.target_type}:${c.target_id} (${c.created_by})`);
            });
        }
    }
    // 5. Check connection suggestions
    const { data: suggestions, error: suggError } = await supabase
        .from('connection_suggestions')
        .select('*')
        .eq('status', 'pending');
    if (suggError) {
        console.error('Error fetching suggestions:', suggError);
    }
    else {
        console.log(`💡 Pending suggestions: ${suggestions?.length || 0}`);
        if (suggestions && suggestions.length > 0) {
            console.log('Sample suggestions:');
            suggestions.slice(0, 5).forEach(s => {
                console.log(`  ${s.from_item_type}:${s.from_item_id} → ${s.to_item_type}:${s.to_item_id}`);
                console.log(`    Confidence: ${s.confidence}, Reasoning: ${s.reasoning}`);
            });
        }
    }
    // 6. Check for unprocessed memories
    const { data: unprocessed } = await supabase
        .from('memories')
        .select('id, title, processed, error')
        .eq('processed', false);
    console.log(`\n⏳ Unprocessed memories: ${unprocessed?.length || 0}`);
    if (unprocessed && unprocessed.length > 0) {
        console.log('Unprocessed items:');
        unprocessed.forEach(m => {
            console.log(`  - ${m.title?.substring(0, 50)}`);
            if (m.error)
                console.log(`    Error: ${m.error}`);
        });
    }
    console.log('\n=== DIAGNOSIS ===');
    if (withEmbeddings === 0) {
        console.log('❌ No memories have embeddings - processing may have failed');
        console.log('   Check logs for embedding generation errors');
    }
    const totalItemsWithEmbeddings = withEmbeddings + (projWithEmbeddings || 0) + (artWithEmbeddings || 0);
    if (totalItemsWithEmbeddings < 2) {
        console.log('⚠️  Not enough items with embeddings to create connections');
        console.log('   Need at least 2 items (thoughts/projects/articles) with embeddings');
    }
    if ((connections?.length || 0) === 0 && (suggestions?.length || 0) === 0 && withEmbeddings > 1) {
        console.log('❌ Items have embeddings but no connections/suggestions created');
        console.log('   Connection discovery may not be running');
    }
    console.log('\n');
}
debugConnections().catch(console.error);
