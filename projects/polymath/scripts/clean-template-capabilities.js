/**
 * Clean Template Capabilities
 * Removes all prepopulated codebase capabilities, keeping only user-extracted skills
 */
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function cleanTemplateCapabilities() {
    console.log('🧹 Cleaning template codebase capabilities...\n');
    try {
        // First, show what we're about to delete
        const { data: toDelete, error: fetchError } = await supabase
            .from('capabilities')
            .select('id, name, source_project, strength')
            .neq('source_project', 'user');
        if (fetchError) {
            throw new Error(`Failed to fetch capabilities: ${fetchError.message}`);
        }
        if (!toDelete || toDelete.length === 0) {
            console.log('✅ No template capabilities found. Database is clean!');
            return;
        }
        console.log(`Found ${toDelete.length} template capabilities to delete:`);
        console.log('─'.repeat(60));
        // Group by source_project for clearer output
        const byProject = {};
        for (const cap of toDelete) {
            if (!byProject[cap.source_project]) {
                byProject[cap.source_project] = [];
            }
            byProject[cap.source_project].push(cap.name);
        }
        for (const [project, caps] of Object.entries(byProject)) {
            console.log(`\n${project}:`);
            for (const cap of caps) {
                console.log(`  - ${cap}`);
            }
        }
        console.log('\n' + '─'.repeat(60));
        console.log(`\nDeleting ${toDelete.length} capabilities...\n`);
        // Delete all non-user capabilities
        const { error: deleteError } = await supabase
            .from('capabilities')
            .delete()
            .neq('source_project', 'user');
        if (deleteError) {
            throw new Error(`Failed to delete capabilities: ${deleteError.message}`);
        }
        console.log(`✅ Successfully deleted ${toDelete.length} template capabilities`);
        // Show remaining user capabilities
        const { data: remaining, error: remainingError } = await supabase
            .from('capabilities')
            .select('name, strength, last_used')
            .eq('source_project', 'user')
            .order('strength', { ascending: false });
        if (remainingError) {
            console.log('⚠️ Could not fetch remaining capabilities');
        }
        else if (remaining && remaining.length > 0) {
            console.log(`\n📊 ${remaining.length} user capabilities remain:`);
            console.log('─'.repeat(60));
            for (const cap of remaining) {
                const lastUsed = cap.last_used ? new Date(cap.last_used).toLocaleDateString() : 'Never';
                console.log(`  ${cap.name.padEnd(30)} Strength: ${cap.strength.toFixed(1).padStart(4)}  Last used: ${lastUsed}`);
            }
        }
        else {
            console.log('\n📊 No user capabilities exist yet.');
            console.log('💡 Start extracting skills by:');
            console.log('  1. Capturing voice notes that mention your abilities');
            console.log('  2. Analyzing articles about skills you\'re learning');
            console.log('  3. Creating projects that showcase your expertise');
        }
    }
    catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    cleanTemplateCapabilities()
        .then(() => {
        console.log('\n✨ Cleanup complete!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('\n❌ Cleanup failed:', error);
        process.exit(1);
    });
}
