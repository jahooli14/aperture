/**
 * Project Scaffold Generator
 * Generates repo structure and README for project suggestions
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiConfig } from './env'

const { apiKey } = getGeminiConfig()
const genAI = new GoogleGenerativeAI(apiKey)

interface ProjectScaffold {
  readme: string
  techStack: string[]
  fileStructure: Record<string, string> // file path → description
  mvpFeatures: string[]
  setupInstructions: string[]
}

/**
 * Generate complete project scaffold for a suggestion
 */
export async function generateProjectScaffold(
  title: string,
  description: string,
  capabilities: string[]
): Promise<ProjectScaffold> {
  const prompt = `You are a project scaffolding expert. Generate a complete, production-ready project structure and README.

Project Title: ${title}
Description: ${description}
Technologies: ${capabilities.join(', ')}

Generate a comprehensive project scaffold including:

1. **README.md** - Full markdown README with:
   - Project title and one-line description
   - Problem statement (what pain point does this solve?)
   - Key features (3-5 bullet points)
   - Tech stack
   - Quick start guide
   - MVP scope (what to build first)
   - Future enhancements
   - Contributing guide

2. **File Structure** - Key files/directories with descriptions:
   - src/
   - tests/
   - docs/
   - Configuration files
   - Entry points

3. **Tech Stack** - Specific technologies, frameworks, libraries

4. **MVP Features** - Ordered list of features to build first (3-5 items)

5. **Setup Instructions** - Step-by-step commands to get started

Make it **specific and actionable** - someone should be able to clone this repo and start building immediately.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "readme": "# Full README content here...",
  "techStack": ["React", "TypeScript", ...],
  "fileStructure": {
    "src/index.ts": "Main entry point",
    "src/components/": "React components",
    ...
  },
  "mvpFeatures": ["Feature 1", "Feature 2", ...],
  "setupInstructions": ["npm install", "npm run dev", ...]
}`

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  })

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in AI response')

  return JSON.parse(jsonMatch[0])
}

/**
 * Generate simplified scaffold for creative (non-tech) projects
 */
export async function generateCreativeScaffold(
  title: string,
  description: string
): Promise<ProjectScaffold> {
  const prompt = `You are a creative project planner. Generate a project plan for a creative (non-technical) project.

Project Title: ${title}
Description: ${description}

Generate a project plan including:

1. **Project Brief** - Full description with:
   - Project title and vision
   - Creative goals
   - Materials needed
   - Process/workflow
   - Timeline estimate
   - Success criteria

2. **Materials/Resources** - What's needed to complete this

3. **Process Steps** - Step-by-step guide (like MVP features but for creative work)

4. **File Structure** - How to organize your work:
   - sketches/
   - drafts/
   - final/
   - references/

Make it **inspiring and actionable** - someone should feel excited to start creating.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "readme": "# Full project brief here...",
  "techStack": ["Materials", "Tools", "Resources"],
  "fileStructure": {
    "sketches/": "Initial ideas and drafts",
    "references/": "Inspiration and resources",
    ...
  },
  "mvpFeatures": ["First milestone", "Second milestone", ...],
  "setupInstructions": ["Gather materials", "Set up workspace", ...]
}`

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 2048,
    }
  })

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in AI response')

  return JSON.parse(jsonMatch[0])
}
