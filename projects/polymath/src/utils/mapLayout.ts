/**
 * ForceLayout Engine
 * Calculates organic positions for cities using d3-force
 */

import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, SimulationNodeDatum, SimulationLinkDatum, Simulation } from 'd3-force'
import type { City, Road } from './mapTypes'
import { logger } from '../lib/logger'

interface SimulationNode extends SimulationNodeDatum {
    id: string
    r: number
    originalCity: City
    x?: number
    y?: number
}

interface SimulationLink extends SimulationLinkDatum<SimulationNode> {
    source: string | SimulationNode
    target: string | SimulationNode
    strength: number
}

export class ForceLayout {
    private simulation: Simulation<SimulationNode, SimulationLink>

    constructor() {
        this.simulation = forceSimulation<SimulationNode, SimulationLink>()
            .stop() // We'll run it manually
    }

    /**
     * Calculate positions for cities based on their connections (roads)
     * @param cities List of cities
     * @param roads List of roads connecting cities
     * @param width Width of the simulation area
     * @param height Height of the simulation area
     * @returns Updated cities with new positions
     */
    public calculateLayout(cities: City[], roads: Road[], width: number = 4000, height: number = 3000): City[] {
        logger.info('[ForceLayout] Starting layout calculation', { cities: cities.length, roads: roads.length })

        // 1. Prepare nodes
        const nodes: SimulationNode[] = cities.map(city => ({
            id: city.id,
            x: city.position.x || width / 2 + (Math.random() - 0.5) * 500, // Start near center if no position
            y: city.position.y || height / 2 + (Math.random() - 0.5) * 500,
            r: this.getCityRadius(city.size),
            originalCity: city
        }))

        // 2. Prepare links
        const links: SimulationLink[] = roads.map(road => ({
            source: road.fromCityId,
            target: road.toCityId,
            strength: road.strength
        }))

        // 3. Configure simulation
        this.simulation = forceSimulation(nodes)
            .force('link', forceLink(links).id((d: any) => d.id).distance(200).strength(0.5))
            .force('charge', forceManyBody().strength(-800)) // Repel cities
            .force('collide', forceCollide().radius((d: any) => d.r * 1.5).iterations(2)) // Prevent overlap
            .force('center', forceCenter(width / 2, height / 2).strength(0.05)) // Gentle pull to center
            .force('x', forceX(width / 2).strength(0.01))
            .force('y', forceY(height / 2).strength(0.01))
            .stop()

        // 4. Run simulation
        // Run enough ticks to stabilize
        const ticks = 300
        for (let i = 0; i < ticks; ++i) {
            this.simulation.tick()
        }

        // 5. Map back to cities
        const updatedCities = cities.map(city => {
            const node = nodes.find(n => n.id === city.id)
            if (node) {
                return {
                    ...city,
                    position: {
                        x: node.x || 0,
                        y: node.y || 0
                    }
                }
            }
            return city
        })

        logger.info('[ForceLayout] Layout calculation complete')
        return updatedCities
    }

    private getCityRadius(size: string): number {
        switch (size) {
            case 'metropolis': return 100
            case 'city': return 70
            case 'town': return 50
            case 'village': return 35
            default: return 20
        }
    }
}

export const forceLayout = new ForceLayout()
