
import Parser from 'rss-parser';

const parser = new Parser();

async function checkFeed() {
    try {
        const feed = await parser.parseURL('https://tldr.tech/rss');
        console.log('Feed Title:', feed.title);

        if (feed.items.length > 0) {
            const item = feed.items[0];
            console.log('--- First Item Keys ---');
            console.log(Object.keys(item));

            console.log('link:', item.link);
            console.log('--- Content Fields ---');
            console.log('content:', item.content ? item.content.substring(0, 100) : 'MISSING');
            console.log('content:encoded:', item['content:encoded'] ? item['content:encoded'].substring(0, 100) : 'MISSING');
            console.log('description:', item.description ? item.description.substring(0, 100) : 'MISSING');
            console.log('summary:', item.summary ? item.summary.substring(0, 100) : 'MISSING');
        } else {
            console.log('No items found');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

checkFeed();
