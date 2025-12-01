/**
 * Clear all project suggestions
 */
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
const supabase = createClient(url, key);
async function clearSuggestions() {
    console.log('🗑️  Deleting all project suggestions...');
    const { error } = await supabase
        .from('project_suggestions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
    console.log('✅ All suggestions deleted!');
    console.log('🗑️  Clearing capability combinations...');
    const { error: comboError } = await supabase
        .from('capability_combinations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    if (comboError) {
        console.error('❌ Error clearing combinations:', comboError);
    }
    else {
        console.log('✅ Capability combinations cleared!');
    }
}
clearSuggestions();
