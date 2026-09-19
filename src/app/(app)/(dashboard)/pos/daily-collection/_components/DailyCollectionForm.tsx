'use client'

import type { DailyCollectionReport } from '@/src/schema/pos/daily-collection'
import type { SheetDraftController } from '../_hooks/useSheetDraft'
import {
  buildCollectionRecapLines,
  buildDenominationLines,
  buildFormLines,
  footerAmount,
  formatFormDate,
  peso,
  pesoOrDash,
  type DenominationLine,
  type FooterLine,
  type FormLine,
} from './form-model'

/**
 * Scenario 53 Part 6 — a facsimile of the client's own Daily Collection
 * Report form, on screen and on paper.
 *
 * Columns, header grouping, merged customer cells, the in-grid subtotal and
 * denomination blocks and the signature strip all follow the printed form
 * they handed over, so a branch can file our output in the same binder. The
 * ledger is cash only, as their form is — the service filters non-cash
 * collections out of it — and the non-cash take is printed per provider in
 * its own block under the cash recap. The backend's form sheet
 * (daily-collection.form-sheet.ts) reproduces the same layout in Excel —
 * change one, change the other.
 *
 * The handwritten half of the paper form — the two signatories, a remark, and
 * a corrected denomination count — is editable here when `edit` is passed.
 * Those fields are inputs on screen and plain text on paper: an input's border
 * is chrome, and chrome has no place on a form three people sign.
 */

const CELL = 'border border-black px-1.5 py-[3px] leading-tight'
const HEAD = `${CELL} bg-gray-100 text-center text-[10px] font-bold uppercase`
const NUM = `${CELL} text-right tabular-nums`

/** Blank ledger lines so a short day still prints a full-height grid, exactly
 * as the pre-ruled paper form does. Sized so a fully filled-in form — remarks
 * line, correction notice and all three signatures — still lands on one
 * landscape page, which is the whole point of a form people sign. */
const MIN_LEDGER_ROWS = 11

/** The cash recap's own height: five DESC subtotals, TOTAL, LESS: DEPOSITED
 * and BALANCE. Anything past it is the non-cash block, which takes its rows
 * out of the ruled filler so the page total does not grow. */
const CASH_RECAP_ROWS = 8

/**
 * An input that reads as part of the form rather than as a web control, and
 * leaves no trace of itself on paper.
 *
 * Tinted while the form is being edited, so the handful of fields a branch may
 * change are obvious against the derived figures they sit among — on a grid
 * this dense, an untinted box is indistinguishable from a printed one and the
 * COINS amount in particular was being missed. The tint is screen-only: it is
 * chrome, and chrome has no place on a form three people sign.
 */
const FIELD =
  'w-full bg-amber-50 px-0 outline-none ring-1 ring-inset ring-amber-300 focus:bg-amber-100 focus:ring-prominent-orange-400 print:bg-transparent print:ring-0'

interface Props {
  report: DailyCollectionReport
  companyName: string
  preparedBy: string
  /** Omitted or null for a read-only form. */
  edit?: SheetDraftController | null
}

export default function DailyCollectionForm({
  report,
  companyName,
  preparedBy,
  edit = null,
}: Props): React.JSX.Element {
  const draft = edit?.draft ?? null
  const lines = buildFormLines(report)
  const recap = buildCollectionRecapLines(report)
  // While editing, the blocks add up what is being typed, so TOTAL and CASH
  // COLLECTED move as the cashier counts rather than only after a save.
  const denominations = buildDenominationLines(
    report,
    draft
      ? Object.fromEntries(
          Object.entries(draft.denominations).map(([face, raw]) => [face, Number(raw) || 0])
        )
      : undefined
  )
  const fillerCount = Math.max(
    0,
    MIN_LEDGER_ROWS - lines.length - Math.max(0, recap.length - CASH_RECAP_ROWS)
  )

  return (
    <div className="print-sheet rounded-2xl border border-gray-200 bg-white p-6 print:p-0">
      <header className="mb-2 text-[11px] font-bold uppercase leading-snug text-black">
        <p>{companyName}</p>
        <p>Daily Collection Report</p>
        <p>{report.branchName}</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px] text-black">
          <FormHeader />
          <tbody>
            <LedgerBody report={report} lines={lines} />
            {Array.from({ length: fillerCount }, (_, i) => (
              <FillerRow key={`filler-${i}`} />
            ))}
            <FooterBlocks recap={recap} denominations={denominations} edit={edit} />
          </tbody>
        </table>
      </div>

      <SignatureStrip report={report} preparedBy={preparedBy} edit={edit} />
    </div>
  )
}

function FormHeader(): React.JSX.Element {
  return (
    <thead>
      <tr>
        <th rowSpan={2} className={`${HEAD} w-18`}>
          Date
        </th>
        <th rowSpan={2} className={`${HEAD} w-13`}>
          SI#
        </th>
        <th rowSpan={2} className={`${HEAD} w-47.5`}>
          Customer
        </th>
        <th rowSpan={2} className={`${HEAD} w-21.5`}>
          Desc
        </th>
        <th colSpan={3} className={HEAD}>
          Collection Receipts
        </th>
        <th rowSpan={2} className={`${HEAD} w-16`}>
          Cash
          <br />
          Invoice
        </th>
        <th rowSpan={2} className={`${HEAD} w-14`}>
          PPD
        </th>
        <th rowSpan={2} className={`${HEAD} w-11.5`}>
          Pen
        </th>
        <th rowSpan={2} className={`${HEAD} w-24`}>
          Amount/
          <br />
          Debit
        </th>
        <th rowSpan={2} className={`${HEAD} w-24`}>
          Credit
        </th>
        <th rowSpan={2} className={`${HEAD} w-24`}>
          Balance
        </th>
      </tr>
      <tr>
        <th className={`${HEAD} w-15`}>Office</th>
        <th className={`${HEAD} w-13`}>Field</th>
        <th className={`${HEAD} w-14`}>Others</th>
      </tr>
    </thead>
  )
}

/** The ledger itself: the business date merged down every collection line, the
 * customer merged down their own DESC lines, then the day's deposits. */
function LedgerBody({
  report,
  lines,
}: {
  report: DailyCollectionReport
  lines: FormLine[]
}): React.JSX.Element {
  const collectionCount = lines.filter((l) => l.type === 'collection').length

  return (
    <>
      {lines.map((line, i) => (
        <tr key={`line-${i}`}>
          {line.type === 'deposit' ? (
            <td className={`${CELL} font-bold`}>DEPOSIT:</td>
          ) : (
            i === 0 && (
              <td rowSpan={collectionCount} className={`${CELL} text-center align-top`}>
                {formatFormDate(report.date)}
              </td>
            )
          )}
          {line.span > 0 && (
            <>
              <td rowSpan={line.span} className={`${CELL} text-center`}>
                {line.si}
              </td>
              <td
                rowSpan={line.span}
                colSpan={line.type === 'deposit' ? 2 : 1}
                className={`${CELL} ${line.type === 'deposit' ? 'font-bold uppercase' : 'text-center'}`}
              >
                {line.customer}
              </td>
            </>
          )}
          {line.type !== 'deposit' && <td className={CELL}>{line.desc}</td>}
          <td className={`${CELL} text-center`}>{line.office}</td>
          <td className={`${CELL} text-center`}>{line.field}</td>
          <td className={`${CELL} text-center`}>{line.others}</td>
          <td className={`${CELL} text-center`}>{line.cashInvoice}</td>
          <td className={NUM}>{line.ppd ? peso(line.ppd) : ''}</td>
          <td className={NUM}>{line.penalty ? peso(line.penalty) : ''}</td>
          <td className={NUM}>{line.debit === null ? '' : peso(line.debit)}</td>
          <td className={NUM}>{line.credit === null ? '' : peso(line.credit)}</td>
          <td className={NUM}>{pesoOrDash(line.balance)}</td>
        </tr>
      ))}
    </>
  )
}

function FillerRow(): React.JSX.Element {
  return (
    <tr>
      {Array.from({ length: 13 }, (_, c) => (
        <td key={c} className={`${CELL} h-4.75`} />
      ))}
    </tr>
  )
}

/**
 * The two blocks the form prints inside the bottom of the grid.
 *
 * Left: the DESC-type subtotals, then the bridge down to the cash still in the
 * drawer. Right: the denomination count, then back out the opening float to
 * land on the cash collected. The two meet at TOTAL COLLECTION / CASH
 * COLLECTED, which is what makes the form prove itself to whoever signs it.
 */
function FooterBlocks({
  recap,
  denominations,
  edit,
}: {
  recap: FooterLine[]
  denominations: DenominationLine[]
  edit: SheetDraftController | null
}): React.JSX.Element {
  const rowCount = Math.max(recap.length, denominations.length + 1)
  // The denomination block is the taller of the two, so the recap sits flush
  // with the grid's last row rather than floating mid-page.
  const recapOffset = rowCount - recap.length

  return (
    <>
      {Array.from({ length: rowCount }, (_, i) => {
        const left = i >= recapOffset ? recap[i - recapOffset] : undefined
        const right = i === 0 ? undefined : denominations[i - 1]

        return (
          <tr key={`footer-${i}`}>
            <td
              className={`${CELL} whitespace-nowrap ${left?.emphasis ? 'font-bold' : ''} ${
                left?.indent ? 'pl-5' : ''
              }`}
            >
              {left?.label ?? ''}
            </td>
            <td colSpan={2} className={`${NUM} ${left?.emphasis ? 'font-bold' : ''}`}>
              {left ? footerAmount(left) : ''}
            </td>
            {Array.from({ length: 7 }, (_, c) => (
              <td key={c} className={CELL} />
            ))}
            {i === 0 ? (
              <>
                <td colSpan={2} className={`${CELL} font-bold uppercase`}>
                  Denomination
                </td>
                <td className={CELL} />
              </>
            ) : (
              <>
                <td className={`${CELL} whitespace-nowrap ${right?.emphasis ? 'font-bold' : ''}`}>
                  {right?.label ?? ''}
                </td>
                <td className={NUM}>
                  <DenominationCount line={right} edit={edit} />
                </td>
                <td className={`${NUM} ${right?.emphasis ? 'font-bold' : ''}`}>
                  <DenominationAmount line={right} edit={edit} />
                </td>
              </>
            )}
          </tr>
        )
      })}
    </>
  )
}

/**
 * The piece count for one denomination row. Editable on the note rows only:
 * COINS is counted as an amount, not as pieces, so it is typed in the amount
 * column instead (DenominationAmount below), and TOTAL and the float line are
 * derived — typing over a derived figure is how a form starts lying.
 */
function DenominationCount({
  line,
  edit,
}: {
  line: DenominationLine | undefined
  edit: SheetDraftController | null
}): React.JSX.Element {
  const isCountable = !!line && line.count !== undefined && !line.emphasis && !line.negate
  const face = line?.label ?? ''
  const editable = edit && isCountable && face !== 'COINS'

  if (!editable) return <>{line?.count ?? ''}</>

  return (
    <input
      type="number"
      min={0}
      step={1}
      aria-label={`Count of ${face} notes`}
      className={`${FIELD} text-right tabular-nums`}
      value={edit.draft?.denominations[face] ?? ''}
      onChange={(e) => edit.setDenomination(face, e.target.value)}
    />
  )
}

/**
 * The amount column of one denomination row. Every row derives its amount
 * from the piece count — except COINS, which the client's own form collects
 * as a single lump peso figure rather than a count per centavo piece. That
 * one is typed here, to two decimals, and it is the only editable amount on
 * the form.
 */
function DenominationAmount({
  line,
  edit,
}: {
  line: DenominationLine | undefined
  edit: SheetDraftController | null
}): React.JSX.Element {
  if (!line) return <></>
  if (!edit || line.label !== 'COINS') return <>{footerAmount(line)}</>

  return (
    <input
      type="number"
      min={0}
      step={0.01}
      aria-label="Total amount in coins"
      className={`${FIELD} text-right tabular-nums`}
      value={edit.draft?.denominations.coins ?? ''}
      onChange={(e) => edit.setDenomination('coins', e.target.value)}
    />
  )
}

/**
 * Below the grid: the reason for any denomination correction, the branch's
 * remark, and the three signatures.
 *
 * PREPARED BY is stamped from the session — whoever pulled the report. The
 * other two are typed and saved, falling back to a ruled line to sign by hand.
 * The correction notice is not optional and not editable: a count that
 * disagrees with the day's session closings has to say so on the paper.
 */
function SignatureStrip({
  report,
  preparedBy,
  edit,
}: {
  report: DailyCollectionReport
  preparedBy: string
  edit: SheetDraftController | null
}): React.JSX.Element {
  const corrected = edit
    ? edit.countsChanged
    : report.denominationTotal !== report.countedDenominationTotal

  return (
    <div className="mt-4 break-inside-avoid text-[11px] uppercase text-black">
      {corrected && <CorrectionNotice report={report} edit={edit} />}

      {(edit || report.sheet?.remarks) && (
        <p className="mb-4 flex gap-2">
          <span className="font-semibold">Remarks:</span>
          {edit ? (
            <input
              className={`${FIELD} border-b border-dotted border-gray-400 uppercase print:border-0`}
              value={edit.draft?.remarks ?? ''}
              onChange={(e) => edit.update('remarks', e.target.value)}
              aria-label="Remarks"
            />
          ) : (
            <span className="font-normal">{report.sheet?.remarks}</span>
          )}
        </p>
      )}

      <div className="flex items-end justify-between gap-10 font-semibold">
        <p className="min-w-70">
          Prepared by: <span className="font-normal">{preparedBy}</span>
        </p>
        <p className="flex min-w-70 gap-2">
          <span className="whitespace-nowrap">Checked by:</span>
          <Signatory
            value={edit ? (edit.draft?.checkedBy ?? '') : (report.sheet?.checkedBy ?? '')}
            onChange={edit ? (v) => edit.update('checkedBy', v) : null}
            label="Checked by"
          />
        </p>
      </div>
      <p className="mt-6 flex min-w-70 gap-2 font-semibold">
        <span className="whitespace-nowrap">Certified correct by:</span>
        <Signatory
          value={
            edit ? (edit.draft?.certifiedCorrectBy ?? '') : (report.sheet?.certifiedCorrectBy ?? '')
          }
          onChange={edit ? (v) => edit.update('certifiedCorrectBy', v) : null}
          label="Certified correct by"
        />
      </p>
    </div>
  )
}

/** A name that is typed and saved, or a ruled line to sign by hand. */
function Signatory({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: ((value: string) => void) | null
  label: string
}): React.JSX.Element {
  if (!onChange) {
    return value ? (
      <span className="font-normal">{value}</span>
    ) : (
      <span className="inline-block w-48 border-b border-black" />
    )
  }
  return (
    <input
      className={`${FIELD} w-48 border-b border-dotted border-gray-400 uppercase print:border-b print:border-solid print:border-black`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    />
  )
}

/**
 * States on the paper that the printed count is not the one the sessions
 * closed with. Non-negotiable: an unexplained edit to a signed cash figure is
 * the thing a reviewer most needs to see, so the reason is required to save
 * and printed whether or not anyone would like it there.
 */
function CorrectionNotice({
  report,
  edit,
}: {
  report: DailyCollectionReport
  edit: SheetDraftController | null
}): React.JSX.Element {
  return (
    <p className="mb-3 flex gap-2 text-[10px] italic">
      <span className="whitespace-nowrap normal-case">
        Denomination count corrected from {peso(report.countedDenominationTotal)} as closed —
      </span>
      {edit ? (
        <input
          className={`${FIELD} border-b border-dotted border-gray-400 normal-case print:border-0`}
          value={edit.draft?.denominationOverrideReason ?? ''}
          onChange={(e) => edit.update('denominationOverrideReason', e.target.value)}
          placeholder="reason (required)"
          aria-label="Reason for the corrected denomination count"
        />
      ) : (
        <span className="normal-case">{report.sheet?.denominationOverrideReason}</span>
      )}
    </p>
  )
}
