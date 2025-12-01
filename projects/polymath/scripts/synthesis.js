/**
 * Synthesis Engine
 * Generates novel project suggestions by combining capabilities + interests
 * Implements point allocation, diversity injection, and suggestion storage
 */
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
// Synthesis configuration
const CONFIG = {
    SUGGESTIONS_PER_RUN: 10,
    WILDCARD_FREQUENCY: 4, // Every 4th suggestion is a wildcard
    NOVELTY_WEIGHT: 0.3,
    FEASIBILITY_WEIGHT: 0.4,
    INTEREST_WEIGHT: 0.3,
    MIN_INTEREST_MENTIONS: 3, // Entity mentioned this many times = interest
    RECENT_DAYS: 30, // Look back this far for interests
};
/**
 * Generate embedding for text
 */
async function generateEmbedding(text) {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return response.data[0].embedding;
}
/**
 * Extract interests from recent MemoryOS memories
 */
async function extractInterests() {
    console.log('🧠 Extracting interests from MemoryOS...');
    // Get entities that appear frequently
    const { data: entities, error } = await supabase
        .from('entities')
        .select('id, name, type')
        .gte('created_at', new Date(Date.now() - CONFIG.RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString());
    if (error)
        throw error;
    // Count entity occurrences
    const entityCounts = entities.reduce((acc, entity) => {
        const key = `${entity.name}::${entity.type}`;
        if (!acc[key]) {
            acc[key] = { entity, count: 0 };
        }
        acc[key].count++;
        return acc;
    }, {});
    // Filter to interests (mentioned multiple times)
    const interests = Object.values(entityCounts)
        .filter(({ count }) => count >= CONFIG.MIN_INTEREST_MENTIONS)
        .map(({ entity, count }) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        strength: count / 10, // Simple strength calculation
        mentions: count,
    }))
        .sort((a, b) => b.strength - a.strength);
    console.log(`  Found ${interests.length} interests (${CONFIG.MIN_INTEREST_MENTIONS}+ mentions)`);
    for (const interest of interests.slice(0, 5)) {
        console.log(`    • ${interest.name} (${interest.mentions} mentions, strength: ${interest.strength.toFixed(1)})`);
    }
    // Update entities table with interest markers
    for (const interest of interests) {
        await supabase
            .from('entities')
            .update({
            is_interest: true,
            interest_strength: interest.strength,
        })
            .eq('id', interest.id);
    }
    return interests;
}
/**
 * Get all capabilities from database
 */
async function getCapabilities() {
    console.log('🔧 Loading capabilities...');
    const { data, error } = await supabase
        .from('capabilities')
        .select('id, name, description, strength, source_project')
        .order('strength', { ascending: false });
    if (error)
        throw error;
    console.log(`  Loaded ${data.length} capabilities`);
    return data;
}
/**
 * Calculate novelty score for capability combination
 */
async function calculateNovelty(capabilityIds) {
    const sortedIds = [...capabilityIds].sort();
    // Check if this combination has been suggested before
    const { data, error } = await supabase
        .from('capability_combinations')
        .select('times_suggested')
        .eq('capability_ids', sortedIds)
        .single();
    if (error && error.code !== 'PGRST116')
        throw error; // Ignore "not found" error
    const timesSuggested = data?.times_suggested || 0;
    // Get total suggestions to date
    const { count } = await supabase
        .from('project_suggestions')
        .select('id', { count: 'exact', head: true });
    const totalSuggestions = count || 1;
    return 1 - (timesSuggested / totalSuggestions);
}
/**
 * Calculate feasibility score for capability combination
 */
function calculateFeasibility(capabilities) {
    // Simple heuristic: average strength + bonus for same project
    const avgStrength = capabilities.reduce((sum, c) => sum + c.strength, 0) / capabilities.length;
    const normalizedStrength = Math.min(avgStrength / 10, 1); // Normalize to 0-1
    // Bonus if capabilities are from the same project (easy integration)
    const projects = new Set(capabilities.map(c => c.source_project));
    const integrationBonus = projects.size === 1 ? 0.3 : 0;
    // Penalty for complexity (more capabilities = more complex)
    const complexityPenalty = Math.min((capabilities.length - 2) * 0.1, 0.3);
    return Math.max(0, Math.min(1, (normalizedStrength * 0.5) +
        integrationBonus +
        (1 - complexityPenalty) * 0.2));
}
/**
 * Calculate interest alignment score
 */
async function calculateInterestScore(projectDescription, interests) {
    if (interests.length === 0)
        return 0.5; // Neutral if no interests
    // Generate embedding for project description
    const projectEmbedding = await generateEmbedding(projectDescription);
    // Find best matching interest (by name similarity for now)
    // TODO: Use actual embeddings when interests have embeddings
    const interestNames = interests.map(i => i.name.toLowerCase());
    const descLower = projectDescription.toLowerCase();
    let maxScore = 0;
    for (const interest of interests) {
        if (descLower.includes(interest.name.toLowerCase())) {
            maxScore = Math.max(maxScore, interest.strength / 10);
        }
    }
    return Math.min(maxScore, 1);
}
/**
 * Generate project idea using Claude
 */
async function generateProjectIdea(capabilities, interests) {
    const capabilityList = capabilities.map(c => `- ${c.name}: ${c.description}`).join('\n');
    const interestList = interests.slice(0, 5).map(i => `- ${i.name} (${i.type}, ${i.mentions} mentions)`).join('\n');
    const prompt = `You are a creative synthesis engine that generates novel project ideas.

Given these technical capabilities:
${capabilityList}

And these user interests (from MemoryOS):
${interestList}

Generate ONE novel project idea that combines these capabilities in a unique way, aligned with the user's interests.

Requirements:
- Must use ALL listed capabilities
- Should feel energizing, not like work
- Title should be catchy and clear
- Description should be 2-3 sentences, focusing on WHY this is interesting
- Reasoning should explain the Venn diagram overlap (why this combination is special)

Return JSON:
{
  "title": "...",
  "description": "...",
  "reasoning": "..."
}`;
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
                role: 'user',
                content: prompt
            }]
    });
    const content = response.content[0];
    if (content.type !== 'text')
        throw new Error('Unexpected response type');
    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]);
}
/**
 * Generate wildcard suggestion (anti-echo-chamber)
 */
async function generateWildcard(capabilities, interests, iteration) {
    console.log('  🎲 Generating wildcard suggestion...');
    // Rotate through strategies
    const strategies = ['unpopular', 'novel-combo', 'inverted', 'random'];
    const strategy = strategies[iteration % strategies.length];
    let selectedCapabilities;
    switch (strategy) {
        case 'unpopular':
            // Use least-used capabilities
            selectedCapabilities = capabilities
                .sort((a, b) => a.strength - b.strength)
                .slice(0, 2);
            break;
        case 'novel-combo':
            // Find capability pair never suggested together
            // For MVP, just pick random weak capabilities
            selectedCapabilities = capabilities
                .filter(c => c.strength < 3)
                .sort(() => Math.random() - 0.5)
                .slice(0, 2);
            break;
        case 'inverted':
            // High novelty, low interest alignment
            selectedCapabilities = capabilities
                .sort(() => Math.random() - 0.5)
                .slice(0, 2);
            break;
        case 'random':
        default:
            // Pure randomness
            selectedCapabilities = capabilities
                .sort(() => Math.random() - 0.5)
                .slice(0, 2);
    }
    // Generate idea
    const idea = await generateProjectIdea(selectedCapabilities, interests);
    // Calculate scores (will be lower than normal suggestions)
    const noveltyScore = await calculateNovelty(selectedCapabilities.map(c => c.id));
    const feasibilityScore = calculateFeasibility(selectedCapabilities);
    const interestScore = await calculateInterestScore(idea.description, interests);
    const totalPoints = Math.round((noveltyScore * CONFIG.NOVELTY_WEIGHT +
        feasibilityScore * CONFIG.FEASIBILITY_WEIGHT +
        interestScore * CONFIG.INTEREST_WEIGHT) * 100);
    return {
        title: idea.title,
        description: idea.description,
        reasoning: idea.reasoning,
        capabilityIds: selectedCapabilities.map(c => c.id),
        memoryIds: [], // TODO: Link to inspiring memories
        noveltyScore,
        feasibilityScore,
        interestScore,
        totalPoints,
        isWildcard: true,
    };
}
/**
 * Generate normal suggestion
 */
async function generateSuggestion(capabilities, interests) {
    // Pick 2-3 capabilities, weighted by strength
    const numCapabilities = Math.random() > 0.5 ? 2 : 3;
    // Weighted random selection (stronger capabilities more likely)
    const selectedCapabilities = [];
    const weightedCaps = capabilities.flatMap(c => Array(Math.max(1, Math.floor(c.strength))).fill(c));
    for (let i = 0; i < numCapabilities; i++) {
        const randomCap = weightedCaps[Math.floor(Math.random() * weightedCaps.length)];
        if (!selectedCapabilities.find(c => c.id === randomCap.id)) {
            selectedCapabilities.push(randomCap);
        }
    }
    // Ensure we have enough
    while (selectedCapabilities.length < numCapabilities && selectedCapabilities.length < capabilities.length) {
        const remaining = capabilities.filter(c => !selectedCapabilities.find(s => s.id === c.id));
        if (remaining.length === 0)
            break;
        selectedCapabilities.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }
    // Generate idea
    const idea = await generateProjectIdea(selectedCapabilities, interests);
    // Calculate scores
    const noveltyScore = await calculateNovelty(selectedCapabilities.map(c => c.id));
    const feasibilityScore = calculateFeasibility(selectedCapabilities);
    const interestScore = await calculateInterestScore(idea.description, interests);
    const totalPoints = Math.round((noveltyScore * CONFIG.NOVELTY_WEIGHT +
        feasibilityScore * CONFIG.FEASIBILITY_WEIGHT +
        interestScore * CONFIG.INTEREST_WEIGHT) * 100);
    return {
        title: idea.title,
        description: idea.description,
        reasoning: idea.reasoning,
        capabilityIds: selectedCapabilities.map(c => c.id),
        memoryIds: [], // TODO: Link to inspiring memories
        noveltyScore,
        feasibilityScore,
        interestScore,
        totalPoints,
        isWildcard: false,
    };
}
/**
 * Record capability combination
 */
async function recordCombination(capabilityIds) {
    const sortedIds = [...capabilityIds].sort();
    await supabase
        .from('capability_combinations')
        .upsert({
        capability_ids: sortedIds,
        times_suggested: 1,
        last_suggested_at: new Date().toISOString(),
    }, {
        onConflict: 'capability_ids',
        ignoreDuplicates: false,
    });
    // Increment if exists
    const { data } = await supabase
        .from('capability_combinations')
        .select('times_suggested')
        .eq('capability_ids', sortedIds)
        .single();
    if (data && data.times_suggested > 1) {
        await supabase
            .from('capability_combinations')
            .update({
            times_suggested: data.times_suggested + 1,
            last_suggested_at: new Date().toISOString(),
        })
            .eq('capability_ids', sortedIds);
    }
}
/**
 * Main synthesis function
 */
export async function runSynthesis(userId) {
    console.log('🔮 Starting weekly synthesis...\n');
    // 1. Extract interests
    const interests = await extractInterests();
    // 2. Load capabilities
    const capabilities = await getCapabilities();
    if (capabilities.length < 2) {
        console.error('❌ Need at least 2 capabilities to generate suggestions');
        return;
    }
    // 3. Generate suggestions
    console.log(`\n💡 Generating ${CONFIG.SUGGESTIONS_PER_RUN} suggestions...\n`);
    const suggestions = [];
    for (let i = 0; i < CONFIG.SUGGESTIONS_PER_RUN; i++) {
        // Every Nth suggestion is a wildcard
        const isWildcardSlot = (i + 1) % CONFIG.WILDCARD_FREQUENCY === 0;
        try {
            const suggestion = isWildcardSlot
                ? await generateWildcard(capabilities, interests, i)
                : await generateSuggestion(capabilities, interests);
            suggestions.push(suggestion);
            const wildcardBadge = suggestion.isWildcard ? '🎲 ' : '';
            console.log(`  ${i + 1}. ${wildcardBadge}${suggestion.title} (${suggestion.totalPoints}pts)`);
            console.log(`     ${suggestion.description.slice(0, 80)}...`);
            console.log(`     Scores: N=${(suggestion.noveltyScore * 100).toFixed(0)}% F=${(suggestion.feasibilityScore * 100).toFixed(0)}% I=${(suggestion.interestScore * 100).toFixed(0)}%\n`);
            // Record combination
            await recordCombination(suggestion.capabilityIds);
        }
        catch (error) {
            console.error(`     ❌ Error generating suggestion ${i + 1}:`, error);
        }
    }
    // 4. Store suggestions in database
    console.log(`\n💾 Storing ${suggestions.length} suggestions...\n`);
    for (const suggestion of suggestions) {
        const { error } = await supabase
            .from('project_suggestions')
            .insert({
            user_id: userId,
            title: suggestion.title,
            description: suggestion.description,
            synthesis_reasoning: suggestion.reasoning,
            novelty_score: suggestion.noveltyScore,
            feasibility_score: suggestion.feasibilityScore,
            interest_score: suggestion.interestScore,
            total_points: suggestion.totalPoints,
            capability_ids: suggestion.capabilityIds,
            memory_ids: suggestion.memoryIds,
            is_wildcard: suggestion.isWildcard,
            status: 'pending',
        });
        if (error) {
            console.error('❌ Error storing suggestion:', error);
        }
    }
    console.log('✅ Synthesis complete!\n');
    return suggestions;
}
// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const userId = process.env.USER_ID || 'default-user';
    runSynthesis(userId)
        .then(() => {
        console.log('✨ Weekly synthesis complete!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Synthesis failed:', error);
        process.exit(1);
    });
}
