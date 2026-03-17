/**
 * useBodyEditor — shared hook for the memory body textarea
 *
 * Auto-grow, smart bullet continuation, and toolbar formatting for
 * CreateMemoryDialog and EditMemoryDialog.
 *
 *   Enter         → auto-continue bullet / numbered list
 *   Shift+Enter   → plain newline (no list continuation)
 */

import { useState, useRef } from 'react'

type FormatType = 'bold' | 'italic' | 'bullet'

interface UseBodyEditorOptions {
  minHeight?: number
}

export function useBodyEditor({ minHeight = 120 }: UseBodyEditorOptions = {}) {
  const [body, setBody] = useState('')
  const [bodyFocused, setBodyFocused] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0

  function resize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.max(minHeight, el.scrollHeight) + 'px'
  }

  function initHeight() {
    requestAnimationFrame(() => {
      const el = bodyRef.current
      if (el) resize(el)
    })
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value)
    const el = e.target
    requestAnimationFrame(() => resize(el))
  }

  function applyFormat(type: FormatType) {
    const el = bodyRef.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    const selected = body.slice(start, end)

    if (type === 'bullet') {
      const lineStart = body.lastIndexOf('\n', start - 1) + 1
      const hasBullet = body.slice(lineStart).startsWith('- ')
      const newBody = hasBullet
        ? body.slice(0, lineStart) + body.slice(lineStart + 2)
        : body.slice(0, lineStart) + '- ' + body.slice(lineStart)
      setBody(newBody)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + (hasBullet ? -2 : 2)
        resize(el)
        el.focus()
      })
      return
    }

    const wrap = type === 'bold' ? '**' : '*'
    const insertion = selected ? `${wrap}${selected}${wrap}` : `${wrap}${wrap}`
    const newBody = body.slice(0, start) + insertion + body.slice(end)
    setBody(newBody)
    requestAnimationFrame(() => {
      const cursor = selected ? start + insertion.length : start + wrap.length
      el.selectionStart = el.selectionEnd = cursor
      resize(el)
      el.focus()
    })
  }

  // Auto-continue bullet / numbered lists on Enter (Shift+Enter = plain newline)
  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return

    const el = e.currentTarget
    const { selectionStart } = el
    const lines = body.slice(0, selectionStart).split('\n')
    const currentLine = lines[lines.length - 1]
    const bulletMatch = currentLine.match(/^(\s*)([-*]|\[\s?\]|\[x\]|\d+\.)\s/)
    if (!bulletMatch) return

    const [, indent, bullet] = bulletMatch
    const contentAfterBullet = currentLine.slice(bulletMatch[0].length).trim()

    if (!contentAfterBullet) {
      // Empty bullet — remove it and add a plain newline
      e.preventDefault()
      const lineStart = body.lastIndexOf('\n', selectionStart - 1) + 1
      const newBody = body.slice(0, lineStart) + '\n' + body.slice(selectionStart)
      setBody(newBody)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = lineStart + 1
        resize(el)
      })
      return
    }

    e.preventDefault()
    let nextBullet = bullet
    const numMatch = bullet.match(/^(\d+)\./)
    if (numMatch) nextBullet = `${parseInt(numMatch[1]) + 1}.`
    if (bullet === '[x]') nextBullet = '[]'

    const insertion = `\n${indent}${nextBullet} `
    const newBody = body.slice(0, selectionStart) + insertion + body.slice(selectionStart)
    setBody(newBody)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + insertion.length
      resize(el)
    })
  }

  return {
    body,
    setBody,
    bodyRef,
    bodyFocused,
    setBodyFocused,
    wordCount,
    handleBodyChange,
    handleBodyKeyDown,
    applyFormat,
    initHeight,
  }
}
