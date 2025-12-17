#!/usr/bin/env tsx
/**
 * Test map generation to see what will be created
 */

// Load environment variables
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

// Import after env is loaded
import { generateInitialMap } from './api/_lib/map-generation.js'

async function main() {
  console.log('='.repeat(60))
  console.log('🧪 Testing Map Generation')
  console.log('='.repeat(60))

  try {
    const userId = process.env.USER_ID || 'default-user'
    console.log(`\nGenerating map for user: ${userId}`)

    const mapData = await generateInitialMap(userId)

    console.log('\n📊 Generated Map:')
    console.log(`  Cities: ${mapData.cities.length}`)
    console.log(`  Roads: ${mapData.roads.length}`)
    console.log(`  Regions: ${mapData.regions.length}`)

    if (mapData.cities.length > 0) {
      console.log('\n🏙️  Cities:')
      mapData.cities.forEach((city, i) => {
        console.log(`  ${i + 1}. ${city.name} (${city.size}) - ${city.population} items`)
      })
    }

    if (mapData.roads.length > 0) {
      console.log('\n🛣️  Roads:')
      mapData.roads.slice(0, 10).forEach((road, i) => {
        const from = mapData.cities.find(c => c.id === road.fromCityId)
        const to = mapData.cities.find(c => c.id === road.toCityId)
        console.log(`  ${i + 1}. ${from?.name} → ${to?.name} (${road.type})`)
      })
      if (mapData.roads.length > 10) {
        console.log(`  ... and ${mapData.roads.length - 10} more roads`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Map generation test complete')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main()
