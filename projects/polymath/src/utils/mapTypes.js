/**
 * Knowledge Map Type Definitions
 */
// Size thresholds
export const SIZE_THRESHOLDS = {
    homestead: 1, // 1-2 items
    village: 3, // 3-9 items
    town: 10, // 10-19 items
    city: 20, // 20-49 items
    metropolis: 50 // 50+ items
};
// Road type based on strength
export const ROAD_TYPES = {
    trail: 1, // 1-2 connections
    country: 3, // 3-5 connections
    main: 6, // 6-10 connections
    highway: 11 // 11+ connections
};
