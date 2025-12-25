/**
 * Local test runner for enrichment APIs
 * Run with: node test-enrichment-local.mjs
 */

// Test the Wikipedia API directly without needing full build
async function testWikipediaAPI() {
    console.log('\n=== Testing Wikipedia API ===\n')

    const tests = [
        { name: 'Popular Film', query: 'Inception', shouldSucceed: true },
        { name: 'Popular Book', query: 'Harry Potter', shouldSucceed: true },
        { name: 'Person', query: 'Marie Curie', shouldSucceed: true },
        { name: 'Place', query: 'Tokyo', shouldSucceed: true },
        { name: 'Obscure/Invalid', query: 'xyzabc123notreal999', shouldSucceed: false },
        { name: 'Special Characters', query: 'Amélie', shouldSucceed: true },
        { name: 'Long Title', query: 'The Lord of the Rings: The Fellowship of the Ring', shouldSucceed: true }
    ]

    let passed = 0
    let failed = 0

    for (const test of tests) {
        try {
            const start = Date.now()

            // Search Wikipedia
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(test.query)}&format=json&origin=*`
            const searchRes = await fetch(searchUrl)
            const searchData = await searchRes.json()

            if (!searchData.query?.search?.[0]) {
                if (!test.shouldSucceed) {
                    console.log(`✓ ${test.name}: Correctly returned no results (${Date.now() - start}ms)`)
                    passed++
                    continue
                } else {
                    throw new Error('No search results found')
                }
            }

            const pageTitle = searchData.query.search[0].title

            // Get summary
            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
            const summaryRes = await fetch(summaryUrl)
            const summary = await summaryRes.json()

            // Validate response
            if (!summary.extract && test.shouldSucceed) {
                throw new Error('No extract in summary')
            }

            const duration = Date.now() - start
            console.log(`✓ ${test.name}: Success (${duration}ms)`)
            console.log(`  Title: ${pageTitle}`)
            console.log(`  Has image: ${!!summary.thumbnail?.source}`)
            console.log(`  Has link: ${!!summary.content_urls?.desktop?.page}`)
            passed++

        } catch (error) {
            console.error(`✗ ${test.name}: ${error.message}`)
            failed++
        }
    }

    console.log(`\n=== Summary ===`)
    console.log(`Passed: ${passed}/${tests.length}`)
    console.log(`Failed: ${failed}/${tests.length}`)
    console.log(`Success Rate: ${Math.round((passed / tests.length) * 100)}%`)

    return failed === 0
}

// Test edge cases and error handling
async function testEdgeCases() {
    console.log('\n=== Testing Edge Cases ===\n')

    const edgeCases = [
        { name: 'Empty string', query: '', shouldFail: true },
        { name: 'Just spaces', query: '   ', shouldFail: true },
        { name: 'Numbers only', query: '12345', shouldFail: false },
        { name: 'URL-unsafe chars', query: 'Test&Query?Special=Chars', shouldFail: false },
        { name: 'Very short', query: 'AI', shouldFail: false },
        { name: 'Very long (500 chars)', query: 'A'.repeat(500), shouldFail: true }
    ]

    let passed = 0

    for (const test of edgeCases) {
        try {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(test.query)}&format=json&origin=*`
            const searchRes = await fetch(searchUrl)
            const searchData = await searchRes.json()

            const hasResults = !!searchData.query?.search?.[0]

            if (test.shouldFail && !hasResults) {
                console.log(`✓ ${test.name}: Correctly failed`)
                passed++
            } else if (!test.shouldFail && hasResults) {
                console.log(`✓ ${test.name}: Correctly succeeded`)
                passed++
            } else {
                console.log(`✗ ${test.name}: Unexpected result (hasResults: ${hasResults}, shouldFail: ${test.shouldFail})`)
            }

        } catch (error) {
            if (test.shouldFail) {
                console.log(`✓ ${test.name}: Correctly threw error`)
                passed++
            } else {
                console.error(`✗ ${test.name}: ${error.message}`)
            }
        }
    }

    console.log(`\nEdge Cases: ${passed}/${edgeCases.length} passed`)
    return passed === edgeCases.length
}

// Run all tests
async function runAllTests() {
    console.log('🧪 Running Enrichment API Tests...\n')

    const test1 = await testWikipediaAPI()
    const test2 = await testEdgeCases()

    console.log('\n' + '='.repeat(50))
    if (test1 && test2) {
        console.log('✅ ALL TESTS PASSED - System is robust!')
        console.log('='.repeat(50))
        process.exit(0)
    } else {
        console.log('❌ SOME TESTS FAILED - Fix before deploying')
        console.log('='.repeat(50))
        process.exit(1)
    }
}

runAllTests().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
