import { getSupabaseClient } from './api/_lib/supabase.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkProjects() {
    const supabase = getSupabaseClient();
    const { data: projects, error } = await supabase
        .from('projects')
        .select('id, title, status, is_priority');

    if (error) {
        console.error('Error fetching projects:', error);
        return;
    }

    console.log('--- ALL PROJECTS ---');
    console.table(projects);
}

checkProjects();
