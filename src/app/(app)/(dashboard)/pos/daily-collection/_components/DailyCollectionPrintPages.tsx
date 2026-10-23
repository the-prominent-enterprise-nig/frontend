'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The day's printed forms, one per page, landscape.
 *
 * Each form is fitted to the paper the user picks in the print dialog. Letter,
 * A4 and Legal are told apart by the printed page's width (a print media
 * query), so each form is laid out for its own page: it spans the full inner
 * width, and only shrinks when its height would run past the page.
 */

const MM_PX = 96 / 25.4
/** Height kept clear at the foot of each page. The print layout runs a little
 * taller than the screen one measured here (print padding, font metrics), so
 * a form that only just fits on screen would be clipped on paper. */
const PRINT_SLACK_MM = 8
/** Landscape sizes in mm. The 2 mm allowance keeps a full page from spilling
 * into a blank one. */
const PAPERS = [
  { key: 'letter', w: 279.4, h: 215.9, inset: 2 },
  { key: 'a4', w: 297, h: 210, inset: 0 },
  { key: 'legal', w: 475.6, h: 215.9, inset: 0 },
] as const

const PRINT_CSS = `
.print-region { position: absolute; left: -10000px; top: 0; width: ${PAPERS[0].w}mm; }
.print-page { width: ${PAPERS[0].w}mm; padding: ${PAPERS[0].inset}mm; box-sizing: border-box; }
.print-fit { width: var(--w-letter); zoom: var(--z-letter); }
.print-page:not(:last-child) { break-after: page; }
@media print {
  @page { size: landscape; margin: 0; }
  .print-region { position: static; left: auto; width: auto; }
  .print-page { height: auto; }
}
@media print and (min-width: 288mm) and (max-width: 329.9mm) {
  .print-page { width: ${PAPERS[1].w}mm; padding: ${PAPERS[1].inset}mm; }
  .print-sheet-compact { gap: 2mm !important; padding: 3mm !important; }
  .print-sheet-compact header { padding-bottom: 1.5mm !important; }
  .print-sheet-compact .print-tight { padding-top: 0.4mm !important; padding-bottom: 0.4mm !important; }
  .print-sheet-compact .print-tight-total { padding-top: 1mm !important; padding-bottom: 0.4mm !important; }
  .print-sheet-compact .print-tight-total,
  .print-sheet-compact .print-tight { line-height: 1.2 !important; }
  .print-fit { width: var(--w-a4); zoom: var(--z-a4); }
}
@media print and (min-width: 330mm) {
  .print-page { width: ${PAPERS[2].w}mm; padding: ${PAPERS[2].inset}mm; }
  .print-sheet-compact { gap: 2mm !important; padding: 3mm !important; }
  .print-sheet-compact header { padding-bottom: 1.5mm !important; }
  .print-sheet-compact .print-tight { padding-top: 0.4mm !important; padding-bottom: 0.4mm !important; }
  .print-sheet-compact .print-tight-total { padding-top: 1mm !important; padding-bottom: 0.4mm !important; }
  .print-sheet-compact .print-tight-total,
  .print-sheet-compact .print-tight { line-height: 1.2 !important; }
  .print-fit { width: var(--w-legal); zoom: var(--z-legal); }
}
`

interface Props {
  /** One printed page each; a null entry prints nothing. */
  pages: (ReactNode | null)[]
}

export default function DailyCollectionPrintPages({ pages }: Props): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fit = (): void => {
      if (root.current) fitToPages(root.current)
    }
    fit()
    // Fonts settle after first paint, and a late layout would measure a taller
    // form than the one printed, so the fit runs again once they have.
    void document.fonts?.ready.then(fit)
    window.addEventListener('resize', fit)
    window.addEventListener('beforeprint', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('beforeprint', fit)
    }
  })

  return (
    <div ref={root} className="print-region" aria-hidden="true">
      <style>{PRINT_CSS}</style>
      {pages.map((page, i) =>
        page ? (
          <section key={i} className="print-page">
            <div className="print-fit">{page}</div>
          </section>
        ) : null
      )}
    </div>
  )
}

/** Works out, for each paper, the layout width and scale that fill its page. */
function fitToPages(region: HTMLElement): void {
  region.querySelectorAll<HTMLElement>('.print-fit').forEach((el) => {
    el.style.setProperty('zoom', '1')
    el.style.width = 'min-content'
    // The ledger sits in an overflow-x container, which hides anything wider
    // than itself, so the tables are measured directly rather than trusting
    // the wrapper's scroll width.
    const tables = Array.from(el.querySelectorAll<HTMLElement>('table'))
    const needW = Math.max(el.scrollWidth, ...tables.map((t) => t.offsetWidth))
    for (const paper of PAPERS) {
      const { w, scale } = fitPaper(el, needW, paper)
      el.style.setProperty(`--w-${paper.key}`, `${w}px`)
      el.style.setProperty(`--z-${paper.key}`, String(scale))
    }
    el.style.width = ''
    el.style.removeProperty('zoom')
  })
}

/**
 * Lays the form out wide enough that, once scaled, it spans the page's inner
 * width. A wider layout is usually a shorter form, so the scale is refined a
 * few times before it is capped by the page's height.
 */
function fitPaper(
  el: HTMLElement,
  needW: number,
  paper: (typeof PAPERS)[number]
): { w: number; scale: number } {
  const maxW = (paper.w - 2 * paper.inset) * MM_PX
  const maxH = (paper.h - 2 * paper.inset - PRINT_SLACK_MM) * MM_PX
  const layoutW = (scale: number): number => Math.max(maxW / scale, needW)
  const heightAt = (scale: number): number => {
    el.style.width = `${layoutW(scale)}px`
    return el.offsetHeight
  }

  let scale = 1
  for (let i = 0; i < 4; i++) {
    scale = Math.min(maxH / heightAt(scale), maxW / needW)
  }
  scale = Math.min(scale, maxH / heightAt(scale), maxW / needW)
  return { w: layoutW(scale), scale }
}
