import { test, expect } from '@playwright/test'
import {
  fixedDownPaymentTotal,
  splitDownPayment,
  type DpRow,
} from '../src/app/(app)/(dashboard)/pos/checkout/_utils/down-payment-groups'

// One down payment for several items — the split behind the combined box at
// the till. Pure logic, no browser.

const row = (id: string, amount: number, extra: Partial<DpRow> = {}): DpRow => ({
  lineIds: [id],
  amount,
  fixedPerLine: null,
  ...extra,
})

const sum = (m: Map<string, number>) =>
  Math.round([...m.values()].reduce((s, v) => s + v, 0) * 100) / 100

test.describe('splitDownPayment', () => {
  test('DG-U01: shares the total across rows by sale amount', () => {
    const res = splitDownPayment([row('a', 1000), row('b', 3000)], 400)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.byLine.get('a')).toBe(100)
    expect(res.byLine.get('b')).toBe(300)
  })

  test('DG-U02: the shares add up to the total exactly — the last row takes the remainder', () => {
    const res = splitDownPayment([row('a', 100), row('b', 100), row('c', 100)], 100)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect([...res.byLine.values()]).toEqual([33.33, 33.33, 33.34])
    expect(sum(res.byLine)).toBe(100)
  })

  test('DG-U03: the units of one row share equally, the last unit taking the remainder', () => {
    const res = splitDownPayment(
      [{ lineIds: ['u1', 'u2', 'u3'], amount: 3000, fixedPerLine: null }],
      100
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect([...res.byLine.values()]).toEqual([33.33, 33.33, 33.34])
  })

  test('DG-U04: a rate-card row keeps its fixed figure and the rest is split over the open rows', () => {
    const rows = [row('card', 5000, { fixedPerLine: 500 }), row('a', 2000), row('b', 2000)]
    expect(fixedDownPaymentTotal(rows)).toBe(500)
    const res = splitDownPayment(rows, 900)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // 900 in all, 500 of it the card row's: 400 left for a and b.
    expect(res.byLine.has('card')).toBe(false)
    expect(res.byLine.get('a')).toBe(200)
    expect(res.byLine.get('b')).toBe(200)
  })

  test('DG-U05: a fixed row counts once per unit', () => {
    const rows = [
      { lineIds: ['u1', 'u2'], amount: 6000, fixedPerLine: 300 } as DpRow,
      row('a', 1000),
    ]
    expect(fixedDownPaymentTotal(rows)).toBe(600)
    const res = splitDownPayment(rows, 700)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.byLine.get('a')).toBe(100)
  })

  test('DG-U06: nothing left for the open rows once the card rows are covered is refused', () => {
    const rows = [row('card', 5000, { fixedPerLine: 500 }), row('a', 2000)]
    expect(splitDownPayment(rows, 500)).toEqual({ ok: false, reason: 'too_small' })
    expect(splitDownPayment(rows, 400)).toEqual({ ok: false, reason: 'too_small' })
  })

  test('DG-U07: more than the items cost is refused', () => {
    expect(splitDownPayment([row('a', 1000), row('b', 1000)], 2000.01)).toEqual({
      ok: false,
      reason: 'too_large',
    })
    expect(splitDownPayment([row('a', 1000), row('b', 1000)], 2000).ok).toBe(true)
  })

  test('DG-U08: every line gets at least a centavo — a down payment is never 0', () => {
    expect(splitDownPayment([row('a', 1000), row('b', 1000)], 0.01)).toEqual({
      ok: false,
      reason: 'too_small',
    })
    const ok = splitDownPayment([row('a', 1000), row('b', 1000)], 0.02)
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    expect([...ok.byLine.values()].every((v) => v >= 0.01)).toBe(true)
  })

  test('DG-U09: a group that is all rate card has nothing for the cashier to split', () => {
    const res = splitDownPayment(
      [row('a', 1000, { fixedPerLine: 100 }), row('b', 1000, { fixedPerLine: 200 })],
      999
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.byLine.size).toBe(0)
  })

  test('DG-U10: a row cannot be handed more than it costs', () => {
    // 10 and 990 by weight; 1000 in all is exactly everything, so each row is
    // handed its full amount and no more.
    const res = splitDownPayment([row('a', 10), row('b', 990)], 1000)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.byLine.get('a')).toBe(10)
    expect(res.byLine.get('b')).toBe(990)
  })
})
