export const COST_OPTS = {
    // Synthesis
    SYNTHESIS_DUPLICATE_CHECK_LIMIT: 10, // Max items to check for similarity (saves embeddings)
    SYNTHESIS_SUGGESTIONS_PER_RUN: 6,    // Items to generate per run

    // Embeddings
    MAINTENANCE_BATCH_SIZE: 20,          // Daily embedding limit per type

    // Capabilities
    CAPABILITIES_CONTEXT_LIMIT: 30,      // Projects/Memories to analyze
    CAPABILITIES_MAX_TOKENS: 4000,       // Max output tokens

    // General
    ENABLE_AUTO_FETCH_NEXT_STEPS: false, // Disable expensive auto-fetch on home
}
