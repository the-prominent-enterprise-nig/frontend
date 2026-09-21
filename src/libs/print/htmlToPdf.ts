import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import jsPDF from 'jspdf'
// -pro fork: plain html2canvas can't parse the lab()/oklch() color
// functions Tailwind v4's generated CSS uses, and throws instead of
// rendering — this fork adds support for those color functions.
import html2canvas from 'html2canvas-pro'

/**
 * Renders a DOM element (a document "Sheet" component, already on screen) to
 * a real, multi-page PDF and triggers a download.
 *
 * Every other "Download"/"Download PDF" button in this app actually saves
 * the print HTML as an .html file — it only becomes a real PDF if the reader
 * picks "Save as PDF" from their own browser's print dialog. This is used
 * where an actual .pdf file on disk is the point, not a print-ready page.
 */
export async function downloadElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  const imgData = canvas.toDataURL('image/png')

  // A single addImage per page, each shifted further up by one page height —
  // jsPDF clips to the current page's bounds, so only the slice that falls
  // within [0, pageHeight] renders on that page. Standard technique for
  // paginating a canvas taller than one page.
  let heightLeft = imgHeight
  let position = 0
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight
  while (heightLeft > 0) {
    position -= pageHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

/**
 * Same as downloadElementAsPdf(), but for a document Sheet that has nothing
 * already open on screen to capture — a "Download" trigger with no preview
 * panel behind it (a list row action, a detail header icon). Mounts the
 * given element off-screen just long enough to render and capture it, then
 * tears it back down.
 */
export async function downloadReactNodeAsPdf(node: ReactElement, filename: string): Promise<void> {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '-99999px'
  // Matches the max-w-3xl width the on-screen document panels render this
  // same Sheet at, so an off-screen capture wraps and paginates identically
  // to what a reader sees when the Sheet IS on screen.
  container.style.width = '768px'
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(node)

  // Let React commit the render, then let any <img> tags (the letterhead
  // logo) finish loading before html2canvas-pro snapshots the tree —
  // otherwise a freshly-mounted image can still be mid-load and paint blank.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const images = Array.from(container.querySelectorAll('img'))
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          })
    )
  )

  try {
    await downloadElementAsPdf(container, filename)
  } finally {
    root.unmount()
    container.remove()
  }
}
