/**
 * Knowledge Map Door Suggestions Logic
 * Generates glowing door suggestions based on map state
 */
import { getSupabaseClient } from './supabase.js';
/**
 * Generate door suggestions for the knowledge map
 */
export async function generateDoorSuggestions(userId, currentMap) {
    const supabase = getSupabaseClient();
    const doors = [];
    console.log('[map-suggestions] Generating door suggestions for user:', userId);
    console.log('[map-suggestions] Current map:', {
        cities: currentMap.cities?.length || 0,
        roads: currentMap.roads?.length || 0
    });
    // SUGGESTION TYPE 1: New Connection (bridge two cities)
    // Find cities with shared items but no road
    for (let i = 0; i < currentMap.cities.length; i++) {
        for (let j = i + 1; j < currentMap.cities.length; j++) {
            const cityA = currentMap.cities[i];
            const cityB = currentMap.cities[j];
            // Check if road already exists
            const roadExists = currentMap.roads.some((r) => (r.fromCityId === cityA.id && r.toCityId === cityB.id) ||
                (r.fromCityId === cityB.id && r.toCityId === cityA.id));
            if (roadExists)
                continue;
            // Check for potential connection (shared items)
            const sharedItems = cityA.itemIds.filter((id) => cityB.itemIds.includes(id));
            if (sharedItems.length >= 2) {
                // Position door midway between cities
                doors.push({
                    id: `door-connect-${i}-${j}`,
                    position: {
                        x: (cityA.position.x + cityB.position.x) / 2,
                        y: (cityA.position.y + cityB.position.y) / 2
                    },
                    type: 'new_connection',
                    suggestionData: {
                        cityAId: cityA.id,
                        cityBId: cityB.id,
                        cityAName: cityA.name,
                        cityBName: cityB.name,
                        reason: `You have ${sharedItems.length} items that connect ${cityA.name} and ${cityB.name}. Building a road would strengthen this relationship.`,
                        sharedItems
                    },
                    glowIntensity: 0.8,
                    created: new Date().toISOString(),
                    dismissed: false
                });
            }
        }
    }
    // SUGGESTION TYPE 2: New Topic (cluster of unassigned items)
    // Find items that don't belong to any city but share topics
    const allAssignedIds = new Set(currentMap.cities.flatMap((c) => c.itemIds));
    const [{ data: memories }, { data: projects }, { data: articles }] = await Promise.all([
        // NOTE: memories table doesn't have user_id column (single-user app)
        // Only suggest items WITH embeddings (otherwise they won't cluster properly)
        supabase.from('memories').select('*').not('embedding', 'is', null).limit(1000),
        supabase.from('projects').select('*').eq('user_id', userId).not('embedding', 'is', null),
        supabase.from('reading_queue').select('*').eq('user_id', userId).not('embedding', 'is', null)
    ]);
    const unassignedItems = [
        ...(memories || []).filter(m => !allAssignedIds.has(m.id)),
        ...(projects || []).filter(p => !allAssignedIds.has(p.id)),
        ...(articles || []).filter(a => !allAssignedIds.has(a.id))
    ];
    console.log('[map-suggestions] Unassigned items:', unassignedItems.length);
    // Cluster by shared topics
    const topicClusters = new Map();
    unassignedItems.forEach(item => {
        const topics = item.entities?.topics || item.metadata?.capabilities?.map((c) => typeof c === 'string' ? c : c.name) || item.tags || [];
        topics.forEach((topic) => {
            if (!topicClusters.has(topic)) {
                topicClusters.set(topic, []);
            }
            topicClusters.get(topic).push(item);
        });
    });
    console.log('[map-suggestions] Topic clusters found:', topicClusters.size);
    // Suggest new cities for clusters of 3+ items
    topicClusters.forEach((items, topic) => {
        if (items.length >= 3 && !currentMap.cities.some((c) => c.name === topic)) {
            // Position in open space (offset from center of map)
            const avgX = currentMap.cities.reduce((sum, c) => sum + c.position.x, 0) / currentMap.cities.length || 500;
            const avgY = currentMap.cities.reduce((sum, c) => sum + c.position.y, 0) / currentMap.cities.length || 500;
            doors.push({
                id: `door-topic-${topic}`,
                position: {
                    x: avgX + (Math.random() - 0.5) * 400,
                    y: avgY + (Math.random() - 0.5) * 400
                },
                type: 'new_topic',
                suggestionData: {
                    topicName: topic,
                    itemCount: items.length,
                    items: items.map(i => ({ id: i.id, title: i.title || i.body?.slice(0, 50) })),
                    reason: `You have ${items.length} items about ${topic}. This could become a new village on your map.`
                },
                glowIntensity: 1.0,
                created: new Date().toISOString(),
                dismissed: false
            });
        }
    });
    // SUGGESTION TYPE 3: Project Idea (based on city combinations)
    // Find two cities with high populations that aren't connected
    const largeCities = currentMap.cities.filter((c) => c.population >= 10);
    for (let i = 0; i < largeCities.length; i++) {
        for (let j = i + 1; j < largeCities.length; j++) {
            const cityA = largeCities[i];
            const cityB = largeCities[j];
            const roadExists = currentMap.roads.some((r) => (r.fromCityId === cityA.id && r.toCityId === cityB.id) ||
                (r.fromCityId === cityB.id && r.toCityId === cityA.id));
            if (!roadExists && doors.length < 5) {
                // Position door between cities with some randomness
                doors.push({
                    id: `door-project-${i}-${j}`,
                    position: {
                        x: (cityA.position.x + cityB.position.x) / 2 + (Math.random() - 0.5) * 100,
                        y: (cityA.position.y + cityB.position.y) / 2 + (Math.random() - 0.5) * 100
                    },
                    type: 'project_idea',
                    suggestionData: {
                        cityAName: cityA.name,
                        cityBName: cityB.name,
                        reason: `Your expertise in ${cityA.name} and ${cityB.name} could combine into a unique project. What if you built something at the intersection?`,
                        suggestion: `A project combining ${cityA.name} and ${cityB.name}`
                    },
                    glowIntensity: 0.9,
                    created: new Date().toISOString(),
                    dismissed: false
                });
            }
        }
    }
    // Limit to 5 doors max (don't overwhelm)
    const finalDoors = doors.slice(0, 5);
    console.log('[map-suggestions] Generated', finalDoors.length, 'doors');
    return finalDoors;
}
