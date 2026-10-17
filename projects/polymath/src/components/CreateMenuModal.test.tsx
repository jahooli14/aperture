import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CreateMenuModal } from './CreateMenuModal'

describe('CreateMenuModal', () => {
  it('says what the plus is for anywhere else', () => {
    render(<CreateMenuModal isOpen onClose={vi.fn()} onAction={vi.fn()} />)
    expect(screen.getByText('pick one')).toBeTruthy()
    expect(screen.getByText('Starts recording now')).toBeTruthy()
  })

  it('on a project page, says Say it and Write it are kept on that project', () => {
    render(<CreateMenuModal isOpen onClose={vi.fn()} onAction={vi.fn()} projectTitle="Going Analogue" />)
    expect(screen.getByText(/Say it and write it are kept on Going Analogue/)).toBeTruthy()
    expect(screen.getAllByText('Kept on Going Analogue')).toHaveLength(2)
    // The rest are not about the project.
    expect(screen.getByText('Something you want to make')).toBeTruthy()
  })
})
