import fetch from 'node-fetch';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

async function checkScrape() {
    const url = 'https://tldr.tech/tech/2025-12-31';

    console.log('--- TEST 1: Direct Fetch + Readability ---');
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log('Status:', response.status);
        if (response.ok) {
            const html = await response.text();
            const { document } = parseHTML(html);
            const reader = new Readability(document as any);
            const article = reader.parse();
            console.log('Readability Title:', article?.title);
            console.log('Readability Content Length:', article?.content?.length);
            console.log('Preview:', article?.content?.substring(0, 200));
        }
    } catch (e) {
        console.error('Test 1 Failed:', e);
    }

    console.log('\n--- TEST 2: Jina ---');
    const jinaUrl = `https://r.jina.ai/${url}`;

    console.log(`Fetching ${jinaUrl}...`);

    try {
        const response = await fetch(jinaUrl, {
            headers: {
                'Accept': 'application/json',
                'X-Return-Format': 'markdown'
            }
        });

        if (!response.ok) {
            console.error('Jina failed:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response:', text);
            return;
        }

        const data = await response.json();
        console.log('--- Scrape Result ---');
        console.log('Title:', data.title);
        console.log('Content Length:', data.content ? data.content.length : 0);
        console.log('Preview:', data.content ? data.content.substring(0, 500) : 'NO CONTENT');

    } catch (err) {
        console.error('Error:', err);
    }
}

checkScrape();
