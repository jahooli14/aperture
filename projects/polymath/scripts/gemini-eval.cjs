#!/usr/bin/env node
/**
 * Send one prompt to several Gemini models in parallel and compare them.
 *
 *   node scripts/gemini-eval.cjs --prompt path/to/prompt.txt \
 *     --models gemini-flash-latest,gemini-3.8-flash,gemini-4-hydrogen \
 *     [--effort low] [--json] [--max-tokens 4000] [--runs 1] [--show 600]
 *
 * Run with NODE_USE_ENV_PROXY=1 behind an HTTP proxy (Node's fetch ignores
 * HTTPS_PROXY otherwise).
 *
 * Uses the OpenAI-compatible endpoint (the only one that works where a network
 * proxy injects the key). Elsewhere, set GEMINI_API_KEY and it is sent as a
 * Bearer token. The key is never printed.
 *
 * Prints per model: wall seconds, input / output tokens (output includes
 * thinking, which is how Gemini bills it), $ per call at the prices below, and
 * the answer. Re-run it when a new model ships; edit PRICES (USD per 1M tokens,
 * https://ai.google.dev/gemini-api/docs/pricing) as they change.
 */
const fs = require('fs')

const PRICES = { // [input, output] USD per 1M tokens, Nov 2026
  'gemini-flash-lite-latest': [0.30, 2.50], // assumed = 3.5 Flash-Lite
  'gemini-flash-latest': [0.75, 3.75],      // assumed = a 3.x Flash (intro price to 31 Dec 2026, then 1.50/7.50)
  'gemini-3.5-flash-lite': [0.30, 2.50],
  'gemini-3.1-flash-lite': [0.25, 1.50],
  'gemini-3.5-flash': [0.75, 3.75],
  'gemini-3.6-flash': [0.75, 3.75],
  'gemini-3.7-flash': [0.75, 3.75],
  'gemini-3.8-flash': [0.75, 3.75],
  'gemini-4-hydrogen': [1.50, 7.50],
  'gemini-4-argon': [2.00, 10.00],  // 4.00 / 20.00 from 1 Dec 2026
  'gemini-4-carbon': [2.00, 10.00], // 4.00 / 20.00 from 1 Dec 2026
  'gemini-4-neon': [3.00, 15.00],
  'gemini-pro-latest': [2.00, 12.00],
}

const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name)
  if (i < 0) return dflt
  return args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true
}
const promptFile = opt('prompt')
const models = String(opt('models', 'gemini-flash-lite-latest,gemini-flash-latest')).split(',')
const effort = String(opt('effort', 'low'))
const asJson = !!opt('json', false)
const maxTokens = Number(opt('max-tokens', 4000))
const runs = Number(opt('runs', 1))
const show = Number(opt('show', 800))
const conc = Math.min(8, Number(opt('parallel', 8)))
if (!promptFile || promptFile === true) {
  console.error('usage: --prompt <file> [--models a,b] [--effort low|medium|high|none] [--json] [--runs n]')
  process.exit(1)
}
const prompt = fs.readFileSync(promptFile, 'utf8')
const headers = { 'content-type': 'application/json' }
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'proxy-injected') {
  headers.authorization = `Bearer ${process.env.GEMINI_API_KEY}`
}

async function one(model) {
  const body = { model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens }
  if (effort !== 'none') body.reasoning_effort = effort
  if (asJson) body.response_format = { type: 'json_object' }
  const t0 = Date.now()
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST', headers, body: JSON.stringify(body),
    })
    const j = await r.json()
    const secs = (Date.now() - t0) / 1000
    if (!r.ok) return { model, secs, error: JSON.stringify(j).slice(0, 200) }
    const u = j.usage || {}
    const [pi, po] = PRICES[model] || [0, 0]
    const usd = ((u.prompt_tokens || 0) * pi + (u.completion_tokens || 0) * po) / 1e6
    const choice = j.choices && j.choices[0]
    return {
      model, secs, input: u.prompt_tokens, output: u.completion_tokens,
      thinking: u.completion_tokens_details && u.completion_tokens_details.reasoning_tokens,
      cached: u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens,
      usd, text: (choice && choice.message && choice.message.content) || '', finish: choice && choice.finish_reason,
    }
  } catch (e) {
    return { model, secs: (Date.now() - t0) / 1000, error: String(e).slice(0, 200) }
  }
}

;(async () => {
  const jobs = []
  for (const m of models) for (let i = 0; i < runs; i++) jobs.push(m)
  const out = []
  for (let i = 0; i < jobs.length; i += conc) out.push(...await Promise.all(jobs.slice(i, i + conc).map(one)))
  console.log(`prompt ${prompt.length} chars, effort ${effort}, max_tokens ${maxTokens}`)
  console.log('model'.padEnd(26), 'secs'.padStart(6), 'in'.padStart(7), 'out'.padStart(6), 'think'.padStart(6), 'cached'.padStart(7), '$/call'.padStart(9))
  for (const r of out) {
    if (r.error) { console.log(r.model.padEnd(26), r.secs.toFixed(1).padStart(6), 'ERROR', r.error); continue }
    console.log(
      r.model.padEnd(26), r.secs.toFixed(1).padStart(6), String(r.input).padStart(7), String(r.output).padStart(6),
      String(r.thinking == null ? '-' : r.thinking).padStart(6), String(r.cached == null ? '-' : r.cached).padStart(7), ('$' + r.usd.toFixed(5)).padStart(9),
      r.finish === 'length' ? ' TRUNCATED' : '',
    )
  }
  for (const r of out) {
    if (!r.error) console.log(`\n--- ${r.model} (${r.secs.toFixed(1)}s) ---\n${r.text.slice(0, show)}${r.text.length > show ? ' …' : ''}`)
  }
})()
