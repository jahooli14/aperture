/**
 * Cleanup Tasks Script
 * One-time cleanup to de-duplicate and cap tasks for all projects.
 * Run: npx tsx scripts/polymath/cleanup-tasks.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env
config({ path: '.env' })

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TASK_CAP = 12

// Fuzzy matching logic (same as in api/power-hour.ts)
const isSimilar = (a: string, b: string) => {
    const s1 = a.toLowerCase().trim()
    const s2 = b.toLowerCase().trim()
    if (s1 === s2) return true
    if (s1.includes(s2) || s2.includes(s1)) return true

    // Simple Levenshtein for typos/minor phrasing diffs
    const track = Array(s2.length + 1).fill(null).map(() =>
        Array(s1.length + 1).fill(null))
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1
            track[j][i] = Math.min(
                track[j][i - 1] + 1,
                track[j - 1][i] + 1,
                track[j - 1][i - 1] + indicator,
            )
        }
    }
    const distance = track[s2.length][s1.length]
    const maxLength = Math.max(s1.length, s2.length)
    // If difference is less than 30% of length, call it a duplicate
    return distance < (maxLength * 0.3)
}

async function cleanupTasks() {
    console.log('🧹 Starting one-time task cleanup...\n')

    // 1. Fetch all projects
    const { data: projects, error } = await supabase
        .from('projects')
        .select('id, title, metadata')

    if (error) {
        console.error('❌ Error fetching projects:', error)
        return
    }

    console.log(`Found ${projects.length} projects to check.\n`)

    let totalCleanedGroups = 0
    let totalCappedCount = 0

    for (const project of projects) {
        const tasks = project.metadata?.tasks || []
        if (tasks.length === 0) continue

        console.log(`Checking project: "${project.title}" (${tasks.length} tasks)`)

        const cleanedTasks: any[] = []
        let removedCount = 0

        // A. De-Duplication
        for (const task of tasks) {
            const duplicate = cleanedTasks.some(existing => isSimilar(existing.text, task.text))
            if (duplicate) {
                removedCount++
            } else {
                cleanedTasks.push(task)
            }
        }

        if (removedCount > 0) {
            console.log(`  - Removed ${removedCount} duplicates.`)
            totalCleanedGroups += removedCount
        }

        // B. Capping at 12 (ONLY UNDONE TASKS)
        const doneTasks = cleanedTasks.filter(t => t.done)
        const undoneTasks = cleanedTasks.filter(t => !t.done)

        let finalUndone = undoneTasks
        if (undoneTasks.length > TASK_CAP) {
            const cappedCount = undoneTasks.length - TASK_CAP
            console.log(`  - Capping ${undoneTasks.length} undone tasks down to ${TASK_CAP} (Removed ${cappedCount})`)
            // Keep the earliest 12
            finalUndone = undoneTasks.slice(0, TASK_CAP)
            totalCappedCount += cappedCount
        }

        let finalTasks = [...doneTasks, ...finalUndone]

        // C. Update if changed
        if (finalTasks.length !== tasks.length) {
            const { error: updateError } = await supabase
                .from('projects')
                .update({
                    metadata: {
                        ...project.metadata,
                        tasks: finalTasks
                    }
                })
                .eq('id', project.id)

            if (updateError) {
                console.error(`  ❌ Error updating project ${project.id}:`, updateError)
            } else {
                console.log(`  ✅ Successfully cleaned up project. Now has ${finalTasks.length} tasks.`)
            }
        } else {
            console.log('  ✨ No changes needed.')
        }
        console.log('')
    }

    console.log('✨ Task cleanup complete!')
    console.log(`📊 Summary:`)
    console.log(`  - Total Duplicates Removed: ${totalCleanedGroups}`)
    console.log(`  - Total Tasks Capped: ${totalCappedCount}`)
}

cleanupTasks()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Cleanup failed:', err)
        process.exit(1)
    })
