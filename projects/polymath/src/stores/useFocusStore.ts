import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FocusTask {
    id: string
    text: string
    completed: boolean
    originalIndex: number // To map back to project tasks
}

interface FocusSessionState {
    status: 'idle' | 'focusing' | 'summary'
    tasks: FocusTask[]
    currentTaskIndex: number
    startTime: number | null
    endTime: number | null
    elapsedSeconds: number
    projectId: string | null

    // Actions
    startSession: (projectId: string, tasks: { id: string, text: string }[]) => void
    completeTask: (taskId: string) => void
    skipTask: () => void // Just moves to next without completing
    endSession: () => void
    reset: () => void
    tick: () => void // Called by timer
}

export const useFocusStore = create<FocusSessionState>()(
    persist(
        (set, get) => ({
            status: 'idle',
            tasks: [],
            currentTaskIndex: 0,
            startTime: null,
            endTime: null,
            elapsedSeconds: 0,
            projectId: null,

            startSession: (projectId, initialTasks) => {
                set({
                    status: 'focusing',
                    projectId,
                    tasks: initialTasks.map((t, i) => ({
                        id: t.id,
                        text: t.text,
                        completed: false,
                        originalIndex: i
                    })),
                    currentTaskIndex: 0,
                    startTime: Date.now(),
                    elapsedSeconds: 0,
                    endTime: null
                })
            },

            completeTask: (taskId) => {
                const { tasks, currentTaskIndex } = get()

                const newTasks = tasks.map(t =>
                    t.id === taskId ? { ...t, completed: true } : t
                )

                // Find next incomplete task
                let nextIndex = currentTaskIndex + 1
                if (nextIndex >= tasks.length) {
                    // If we're at the end, just stay there? Or cycle?
                    // For now, let's just allow sitting at the end or auto-end?
                    // User might want to review.
                    // Let's just increment index to indicate "done with list"
                }

                set({
                    tasks: newTasks,
                    currentTaskIndex: nextIndex
                })
            },

            skipTask: () => {
                // Just move to next task without marking complete
                // Useful if user wants to do tasks out of order or come back later
                set(state => ({
                    currentTaskIndex: state.currentTaskIndex + 1
                }))
            },

            endSession: () => {
                set({
                    status: 'summary',
                    endTime: Date.now()
                })
            },

            reset: () => {
                set({
                    status: 'idle',
                    tasks: [],
                    currentTaskIndex: 0,
                    startTime: null,
                    endTime: null,
                    elapsedSeconds: 0,
                    projectId: null
                })
            },

            tick: () => {
                if (get().status === 'focusing') {
                    set(state => ({ elapsedSeconds: state.elapsedSeconds + 1 }))
                }
            }
        }),
        {
            name: 'aperture-focus-store',
            // We persist so a refresh doesn't kill the session
        }
    )
)
