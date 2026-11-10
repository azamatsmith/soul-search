import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPointRules, putPointRules, type PointRules } from '../lib/api'
import { PointsScreen } from './PointsScreen'

vi.mock('../lib/api', () => ({
  getPointRules: vi.fn(),
  putPointRules: vi.fn(),
}))

const load = vi.mocked(getPointRules)
const save = vi.mocked(putPointRules)

const RULES: PointRules = {
  categories: ['Alien Green', 'Brown paint'],
  false_call: -1,
  regular: 1,
  special: 2,
}

const renderPoints = () => {
  const router = createMemoryRouter(
    [
      { path: '/admin/points', element: <PointsScreen /> },
      { path: '/admin', element: <p>Admin home</p> },
    ],
    { initialEntries: ['/admin/points'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }))

const categoryList = () =>
  screen.getByRole('list', { name: 'Special categories' })

describe('PointsScreen', () => {
  beforeEach(() => {
    load.mockReset()
    save.mockReset()
    load.mockResolvedValue({ ok: true, data: RULES })
  })

  it('saves edited points and categories, then goes back', async () => {
    save.mockResolvedValue({ ok: true, data: RULES })
    const router = renderPoints()
    await screen.findByText('Alien Green')
    click('More for Regular Soul')
    click('Less for False call')
    fireEvent.click(
      within(categoryList()).getAllByRole('button', { name: 'Remove' })[0],
    )
    click('+ Add a category')
    fireEvent.change(screen.getByLabelText('New category'), {
      target: { value: ' Fins ' },
    })
    click('Add')
    click('Save changes')
    expect(save).toHaveBeenCalledWith({
      categories: ['Brown paint', 'Fins'],
      false_call: -2,
      regular: 2,
      special: 2,
    })
    expect(await screen.findByText('Admin home')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
  })

  it.each([
    ['', 'Type a category name.'],
    ['brown PAINT', 'That category is already on the list.'],
    ['x'.repeat(25), 'Keep it to 24 characters or fewer.'],
  ])('explains a bad new category %#', async (name, message) => {
    renderPoints()
    await screen.findByText('Alien Green')
    click('+ Add a category')
    fireEvent.change(screen.getByLabelText('New category'), {
      target: { value: name },
    })
    click('Add')
    expect(screen.getByLabelText('New category')).toHaveAccessibleDescription(
      message,
    )
  })

  it('cancels adding a category', async () => {
    renderPoints()
    await screen.findByText('Alien Green')
    click('+ Add a category')
    click('Cancel')
    expect(screen.queryByLabelText('New category')).not.toBeInTheDocument()
  })

  it('keeps at least one category', async () => {
    load.mockResolvedValue({
      ok: true,
      data: { ...RULES, categories: ['Brown paint'] },
    })
    renderPoints()
    await screen.findByText('Brown paint')
    expect(
      within(categoryList()).queryByRole('button', { name: 'Remove' }),
    ).not.toBeInTheDocument()
  })

  it('stays put and says so when saving fails', async () => {
    save.mockResolvedValue({ ok: false, status: 0, error: 'network' })
    renderPoints()
    await screen.findByText('Alien Green')
    click('Save changes')
    expect(
      await screen.findByText("We couldn't save that."),
    ).toBeInTheDocument()
  })

  it('offers a retry when the rules fail to load', async () => {
    load.mockResolvedValueOnce({ ok: false, status: 0, error: 'network' })
    renderPoints()
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Alien Green')).toBeInTheDocument()
  })
})
