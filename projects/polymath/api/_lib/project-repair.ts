
import { getSupabaseClient } from './supabase.js'
import { generateProjectScaffold, generateCreativeScaffold } from './generate-project-scaffold.js'

/**
 * Ensures a project has tasks by generating a scaffold if empty.
 */
export async function ensureProjectHasTasks(projectId: string, userId: string): Promise<boolean> {
    const supabase = getSupabaseClient()

    // 1. Fetch project
    const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single()

    if (error || !project) return false

    const tasks = project.metadata?.tasks || []
    if (tasks.length >= 3) return true // Already has enough tasks

    console.log(`[Repair] Scaffolding project: ${project.title} (${project.id})`)

    try {
        let scaffold;
        const motivation = project.metadata?.motivation || undefined

        if (project.type === 'Tech' || project.type === 'tech' || project.type === 'technical') {
            scaffold = await generateProjectScaffold(project.title, project.description, [], motivation)
        } else {
            scaffold = await generateCreativeScaffold(project.title, project.description, motivation)
        }

        if (scaffold && scaffold.mvpFeatures) {
            const newTasks = scaffold.mvpFeatures.map((feature: string, i: number) => ({
                id: crypto.randomUUID(),
                text: feature,
                done: false,
                created_at: new Date().toISOString(),
                order: i
            }))

            const { error: updateError } = await supabase
                .from('projects')
                .update({
                    metadata: {
                        ...project.metadata,
                        tasks: newTasks,
                        scaffold: scaffold,
                        repaired_at: new Date().toISOString()
                    }
                })
                .eq('id', project.id)

            if (updateError) throw updateError
            return true
        }
    } catch (err) {
        console.error(`[Repair] Failed to scaffold project ${projectId}:`, err)
    }

    return false
}

/**
 * Repairs all active projects for a user that are missing tasks.
 */
export async function repairAllUserProjects(userId: string) {
    const supabase = getSupabaseClient()

    // Fetch active/upcoming projects with empty metadata or empty tasks
    const { data: projects, error } = await supabase
        .from('projects')
        .select('id, metadata, status')
        .eq('user_id', userId)
        .in('status', ['active', 'upcoming', 'maintaining'])

    if (error || !projects) return

    const emptyProjects = projects.filter(p => !p.metadata?.tasks || p.metadata.tasks.length < 3)

    console.log(`[Repair] Found ${emptyProjects.length} empty projects for user ${userId}`)

    // Process in sequence to avoid hitting AI rate limits too hard if there are many
    for (const project of emptyProjects) {
        await ensureProjectHasTasks(project.id, userId)
    }
}
