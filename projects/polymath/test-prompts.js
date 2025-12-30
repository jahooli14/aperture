import fetch from 'node-fetch';

async function testPrompts() {
    const baseUrl = 'http://localhost:3000'; // Adjust as needed

    console.log('--- Fetching Prompts ---');
    const res = await fetch(`${baseUrl}/api/memories?prompts=true`);
    const data = await res.json();

    console.log('Progress:', data.progress);
    console.log('Required Prompts count:', data.required?.length);
    console.log('Completed Required count:', data.required?.filter(p => p.status === 'completed').length);

    if (data.required && data.required.length > 0) {
        const firstPrompt = data.required[0];
        console.log('\n--- Submitting Response for first required prompt ---');
        console.log('Prompt ID:', firstPrompt.id);
        console.log('Prompt Text:', firstPrompt.text);

        const submitRes = await fetch(`${baseUrl}/api/memories?submit_response=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt_id: firstPrompt.id,
                bullets: ['Test response ' + Date.now()]
            })
        });

        const submitData = await submitRes.json();
        console.log('Submit Success:', submitData.success);
        console.log('New Progress:', submitData.progress);
    }
}

testPrompts().catch(console.error);
