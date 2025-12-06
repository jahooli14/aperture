/**
 * Task Energy Level Analyzer
 * Uses Gemini Flash to analyze tasks and assign appropriate energy levels
 */

import { generateText } from './gemini-chat.js'

export type EnergyLevel = 'low' | 'moderate' | 'high'

interface TaskAnalysisResult {
  energy_level: EnergyLevel
  reasoning: string
}

/**
 * Analyze a single task and assign an energy level
 */
export async function analyzeTaskEnergy(
  taskText: string,
  projectTitle: string,
  projectDescription?: string
): Promise<TaskAnalysisResult> {
  const prompt = `You are analyzing a task to determine what energy level it requires.

Task: "${taskText}"
Project: "${projectTitle}"
${projectDescription ? `Project Description: "${projectDescription}"` : ''}

Based on the task description, determine if this task requires:
- "low" energy (routine, repetitive, administrative, brainstorming, creative flow)
- "moderate" energy (standard implementation, testing, problem-solving)
- "high" energy (complex debugging, critical decisions, challenging conversations, performance optimization)

Consider factors like:
- Complexity and cognitive load
- Physical or mental effort required
- Whether it requires deep focus vs. quick execution
- Whether it's creative/exploratory vs. structured/routine

Respond with ONLY a JSON object, no markdown:
{
  "energy_level": "low" | "moderate" | "high",
  "reasoning": "Brief explanation of why this energy level was chosen"
}`

  try {
    const response = await generateText(prompt, {
      responseFormat: 'json',
      temperature: 0.3 // Low temperature for consistent analysis
    })

    const result = JSON.parse(response) as TaskAnalysisResult

    // Validate the response
    if (!['low', 'moderate', 'high'].includes(result.energy_level)) {
      console.warn('[task-energy] Invalid energy level returned:', result.energy_level)
      return {
        energy_level: 'moderate',
        reasoning: 'Default to moderate due to invalid analysis response'
      }
    }

    return result
  } catch (error) {
    console.error('[task-energy] Analysis failed:', error)
    // Return default on error
    return {
      energy_level: 'moderate',
      reasoning: 'Default to moderate due to analysis error'
    }
  }
}

/**
 * Batch analyze multiple tasks (useful for project import or bulk updates)
 */
export async function analyzeTasksEnergyBatch(
  tasks: Array<{ text: string; id?: string }>,
  projectTitle: string,
  projectDescription?: string
): Promise<Array<TaskAnalysisResult & { id?: string }>> {
  const results = await Promise.all(
    tasks.map(async (task) => {
      const analysis = await analyzeTaskEnergy(task.text, projectTitle, projectDescription)
      return {
        ...analysis,
        id: task.id
      }
    })
  )

  return results
}
