// Dependency-free formal contract PDF (A4, Times). Generated from live contract data.
import { formatDate } from './format'

const W = 595, H = 842, M = 62, TOP = 70, BOT = 62, CW = W - 2 * M
const NAVY = '0.12 0.16 0.27', GREY = '0.33 0.33 0.33', TINT = '0.93 0.94 0.96', LINEC = '0.72 0.74 0.78'
const clean = (v) => String(v ?? '-').replace(/₹/g, 'Rs. ').replace(/[—–]/g, '-').replace(/[·•]/g, '-')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E]/g, '?')
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
const money = (n) => (n == null ? '-' : `Rs. ${Number(n).toLocaleString('en-IN')}`)
const cw = (size, bold) => size * (bold ? 0.5 : 0.46)          // approx. Times glyph width

function wrap(text, size, width, bold) {
  const max = Math.max(1, Math.floor(width / cw(size, bold))), out = []
  String(text ?? '-').split('\n').forEach((raw) => {
    const para = clean(raw)
    let line = ''
    para.split(' ').forEach((w) => {
      while (w.length > max) { if (line) { out.push(line); line = '' } out.push(w.slice(0, max)); w = w.slice(max) }
      if ((line ? line.length + 1 : 0) + w.length > max) { out.push(line); line = w } else line = line ? `${line} ${w}` : w
    })
    out.push(line)
  })
  return out
}

function buildPdf(build, footerLabel) {
  const pages = [[]]
  let y = H - TOP
  const ops = () => pages[pages.length - 1]
  const newPage = () => { pages.push([]); y = H - TOP }
  const need = (h) => { if (y - h < BOT) newPage() }
  const text = (t, x, yy, size, font = 'F1', color = '0 g') => ops().push(`BT ${color} /${font} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${esc(clean(t))}) Tj ET`)
  const rect = (x, yy, w, h, fill, stroke) => ops().push(`${fill ? fill + ' rg ' : ''}${stroke ? stroke + ' RG 0.5 w ' : ''}${x} ${yy} ${w} ${h} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`)

  const api = {
    title(t, s) {
      text(t, (W - clean(t).length * cw(18, true)) / 2, y - 18, 18, 'F2', NAVY + ' rg'); y -= 26
      text(s, (W - clean(s).length * cw(9)) / 2, y - 9, 9, 'F3', GREY + ' rg'); y -= 12
      ops().push(`${NAVY} RG 1.2 w ${M} ${y - 4} m ${W - M} ${y - 4} l S`); y -= 16
    },
    h(t) { need(40); y -= 8; text(t, M, y - 10, 10.5, 'F2', NAVY + ' rg'); y -= 15 },
    p(t, { indent = 0, size = 9.5, bold = false, font } = {}) {
      wrap(t, size, CW - indent, bold).forEach((l) => { need(size + 4); text(l, M + indent, y - size, size, font ?? (bold ? 'F2' : 'F1')); y -= size + 3.6 })
      y -= 3
    },
    clause(n, t) {
      const lines = wrap(t, 9.5, CW - 30)
      lines.forEach((l, i) => { need(14); if (i === 0) text(n, M, y - 9.5, 9.5, 'F2'); text(l, M + 30, y - 9.5, 9.5); y -= 13 })
      y -= 3
    },
    gap(n = 8) { y -= n },
    // cols: [{w, head}], rows: array of arrays of strings; opts.total row shaded; opts.labelCol shades first column
    table(cols, rows, { header = true, labelCol = false, boldLast = false } = {}) {
      const tot = cols.reduce((a, c) => a + c.w, 0), sc = CW / tot, ws = cols.map((c) => c.w * sc)
      const draw = (cells, isHead, shade, bold) => {
        const wrapped = cells.map((c, i) => wrap(c, 8.8, ws[i] - 10, isHead || bold || (labelCol && i === 0)))
        const h = Math.max(...wrapped.map((l) => l.length)) * 11.6 + 9
        need(h)
        let x = M
        wrapped.forEach((lines, i) => {
          rect(x, y - h, ws[i], h, isHead ? NAVY : shade || (labelCol && i === 0 ? TINT : null), LINEC)
          lines.forEach((l, k) => text(l, x + 5, y - 13 - k * 11.6, 8.8, isHead || bold || (labelCol && i === 0) ? 'F2' : 'F1', isHead ? '1 g' : '0 g'))
          x += ws[i]
        })
        y -= h
      }
      if (header) draw(cols.map((c) => c.head), true)
      rows.forEach((r, i) => draw(r, false, boldLast && i === rows.length - 1 ? TINT : null, boldLast && i === rows.length - 1))
      y -= 8
    },
    keep(h) { need(h) },
    sigLine(label, name, id) {
      const half = CW / 2 - 8
      ;[[M, 'FOR THE CLIENT'], [M + half + 16, 'FOR THE FREELANCER']].forEach(([x], k) => {
        text(k ? 'FOR THE FREELANCER' : 'FOR THE CLIENT', x, y - 10, 9, 'F2')
        ops().push(`0 G 0.6 w ${x} ${y - 52} m ${x + half} ${y - 52} l S`)
        text(k ? name[1] : name[0], x, y - 65, 9); text(`User ID: ${k ? id[1] : id[0]}`, x, y - 77, 9)
        text('Date: ____ / ____ / ________', x, y - 92, 9)
      })
      y -= 100
    },
  }
  build(api)
  const total = pages.length
  const streams = pages.map((ops, i) => {
    const d = [
      `${NAVY} RG 1.4 w ${30} ${30} ${W - 60} ${H - 60} re S`, `0.5 w ${34} ${34} ${W - 68} ${H - 68} re S`,
      `BT ${GREY} rg /F3 7.5 Tf ${M} ${H - 50} Td (CONFIDENTIAL - FREELANCE SERVICES AGREEMENT) Tj ET`,
      `BT ${GREY} rg /F1 7.5 Tf ${M} 46 Td (${esc(clean(footerLabel))}) Tj ET`,
      `BT ${GREY} rg /F1 7.5 Tf ${W - M - 42} 46 Td (Page ${i + 1} of ${total}) Tj ET`,
    ]
    return d.join('\n') + '\n' + ops.join('\n')
  })
  const objs = []
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>'
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>'
  objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>'
  const kids = []
  streams.forEach((st, i) => {
    const c = 6 + i * 2, p = 7 + i * 2
    objs[c] = `<< /Length ${st.length} >>\nstream\n${st}\nendstream`
    objs[p] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${c} 0 R >>`
    kids.push(`${p} 0 R`)
  })
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${total} >>`
  let pdf = '%PDF-1.4\n'; const off = []
  for (let i = 1; i < objs.length; i++) { off[i] = pdf.length; pdf += `${i} 0 obj\n${objs[i]}\nendobj\n` }
  const xr = pdf.length
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + off.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

export function downloadContractPdf(contract) {
  const job = contract.job ?? {}, tasks = job.milestoneTasks ?? [], ms = contract.milestones ?? []
  const n = Math.max(tasks.length, ms.length)
  const each = tasks.length ? Math.floor(Number(job.budget) / tasks.length) : 0
  const rows = Array.from({ length: n }, (_, i) => {
    const m = ms[i]
    const amount = m?.amount ?? (tasks.length ? (i === tasks.length - 1 ? Number(job.budget) - each * (tasks.length - 1) : each) : null)
    const status = m?.payment?.paymentStatus === 'Paid' ? 'Paid' : m?.payment?.paymentStatus === 'Held' ? 'Funded' : m?.status ?? 'Pending'
    return [String(i + 1), m?.taskSpec ?? tasks[i] ?? m?.title ?? '-', m ? formatDate(m.dueDate) : '-', money(amount), status]
  })
  const total = rows.reduce((s, r) => s + (Number(r[3].replace(/[^0-9]/g, '')) || 0), 0)
  const cid = contract.contractId
  const blob = buildPdf((d) => {
    d.title('FREELANCE SERVICES AGREEMENT', 'Project Contract executed through the FreelanceFlow platform')
    d.table([{ w: 30 }, { w: 45 }, { w: 30 }, { w: 45 }], [
      ['Contract No.', cid, 'Version', '1.0'], ['Effective Date', contract.startDate ? formatDate(contract.startDate) : formatDate(new Date().toISOString()), 'Job ID', contract.jobId],
      ['Contract Status', contract.status, 'Governing Law', 'Laws of India']], { header: false, labelCol: true })
    d.p('This Freelance Services Agreement (the "Agreement") is made between the parties identified below through the FreelanceFlow online platform (the "Platform"), on the Effective Date stated above.')
    d.h('ARTICLE 1 - PARTIES')
    d.table([{ w: 50, head: 'CLIENT' }, { w: 50, head: 'FREELANCER' }], [[`Name / Company: ${contract.clientName}\nUser ID: ${contract.clientId}`, `Name / Company: ${contract.freelancerName}\nUser ID: ${contract.freelancerId}`]])
    d.p('The Client and the Freelancer are each a "Party" and together the "Parties".')
    d.h('ARTICLE 2 - RECITALS')
    d.clause('A.', 'The Client has published a project on the Platform and wishes to engage an independent professional to perform the work described herein.')
    d.clause('B.', 'The Freelancer has submitted a proposal, which the Client has accepted, and represents that they have the skills and capacity required to perform the Services.')
    d.clause('C.', 'The Parties wish to record the terms on which the Services shall be performed and paid for.')
    d.p('NOW, THEREFORE, in consideration of the mutual covenants herein, the Parties agree as follows:')
    d.h('ARTICLE 3 - DEFINITIONS')
    ;['"Services" means the work described in Article 4 and the Milestone Plan.', '"Milestone" means a discrete stage of the Services with its own task specification and amount, as set out in Article 5.',
      '"Deliverable" means any work product submitted by the Freelancer in respect of a Milestone.', '"Contract Value" means the aggregate of all Milestone Amounts payable under this Agreement.',
      '"Escrow Account" means the Platform-controlled account, operated through the Razorpay payment gateway, in which Milestone Amounts are held pending Client approval.'].forEach((t, i) => d.clause(`3.${i + 1}`, t))
    d.h('ARTICLE 4 - PROJECT AND SCOPE OF WORK')
    d.table([{ w: 28 }, { w: 72 }], [['Project Title', job.title ?? '-'], ['Category', job.category ?? '-'], ['Experience Level', job.experienceLevel ?? '-'],
      ['Start / End Date', `${formatDate(contract.startDate)} / ${contract.endDate ? formatDate(contract.endDate) : 'On completion of the final Milestone'}`], ['Project Summary', job.description ?? '-']], { header: false, labelCol: true })
    d.clause('4.1', 'The Freelancer shall perform the Services with reasonable skill, care and diligence and in accordance with the task specification of each Milestone.')
    d.clause('4.2', 'Work outside the agreed scope requires the prior written approval of both Parties and, where applicable, a revised Milestone or amount.')
    d.h('ARTICLE 5 - MILESTONES, DELIVERABLES AND ACCEPTANCE')
    d.p('The Services shall be delivered in the following Milestones, each governed by the task specification supplied by the Client:')
    if (rows.length) d.table([{ w: 8, head: 'No.' }, { w: 50, head: 'Task Specification' }, { w: 15, head: 'Due Date' }, { w: 15, head: 'Amount' }, { w: 12, head: 'Status' }],
      [...rows, ['', 'Total Contract Value', '', money(total), '']], { boldLast: true })
    else d.p('No milestones have been defined for this contract.', { font: 'F3' })
    ;['The Freelancer shall submit each Deliverable through the Platform on or before the Milestone due date.', 'The Client shall review each submitted Deliverable within seven (7) days and shall either approve it or reject it with reasons.',
      'A Deliverable is deemed accepted when it conforms to the task specification and the Client approves it on the Platform.', 'A rejected Milestone returns to "Pending" status; the Freelancer shall correct and resubmit within the original scope at no additional cost.']
      .forEach((t, i) => d.clause(`5.${i + 1}`, t))
    d.h('ARTICLE 6 - FEES, ESCROW AND PAYMENT')
    ;['Funding on start. Upon commencement of this Agreement, the Client shall pay the Amount of Milestone 1 through the Razorpay payment gateway, to be held in the Escrow Account. Work on a Milestone begins once its Amount is funded.',
      'Release. On the Client\'s approval of a Milestone, the Platform shall automatically transfer the corresponding Amount to the Freelancer\'s registered payment account.',
      'Subsequent Milestones. The foregoing procedure applies to each subsequent Milestone, which shall be funded following the approval of the preceding one.',
      'Records. The Platform maintains a record of every payment, including the gateway transaction reference, and the Platform administrator may review payment status where a query or dispute arises.',
      'Taxes. Each Party is responsible for its own taxes. Amounts are stated exclusive of GST or other levies unless expressly indicated.'].forEach((t, i) => d.clause(`6.${i + 1}`, t))
    d.h('ARTICLE 7 - RESPONSIBILITIES OF THE PARTIES')
    d.clause('7.1', 'Client: provide accurate requirements, assets and access; give timely feedback; review Deliverables within the agreed period; and fund and approve Milestones in accordance with Article 6.')
    d.clause('7.2', 'Freelancer: deliver the Services within scope and deadlines; report progress, blockers and dependencies promptly; and keep payment account details accurate and up to date.')
    d.h('ARTICLE 8 - INTELLECTUAL PROPERTY')
    d.clause('8.1', 'Upon receipt of full payment for a Milestone, all rights, title and interest in the Deliverables of that Milestone vest in the Client, save for the Freelancer\'s pre-existing tools, libraries and know-how.')
    d.clause('8.2', 'The Freelancer warrants that the Deliverables shall be original and shall not knowingly infringe the rights of any third party.')
    d.h('ARTICLE 9 - CONFIDENTIALITY')
    d.clause('9.1', 'Each Party shall keep confidential all non-public information received from the other in connection with this Agreement, use it solely for the Services, and not disclose it to any third party except as required by law. This obligation survives termination for three (3) years.')
    d.h('ARTICLE 10 - TERM AND TERMINATION')
    d.clause('10.1', 'This Agreement commences on the start date and continues until all Milestones are completed, unless terminated earlier under this Article.')
    d.clause('10.2', 'Either Party may request termination through the Platform, stating the reason. Termination takes effect only when the other Party approves, or as determined by the Platform administrator in case of dispute.')
    d.clause('10.3', 'On termination, the Freelancer shall be paid for Milestones approved by the Client; any funded but unapproved Milestone Amount shall be dealt with as agreed between the Parties or as determined under Article 11.')
    if (contract.cancellationReason) d.clause('10.4', `Recorded cancellation reason: ${contract.cancellationReason}`)
    d.h('ARTICLE 11 - DISPUTE RESOLUTION AND GOVERNING LAW')
    d.clause('11.1', 'The Parties shall first attempt to resolve any dispute in good faith, using documented project information and Platform communication.')
    d.clause('11.2', 'Unresolved disputes may be referred to the Platform administrator, who may review the contract, Milestone and payment records and issue a recommendation.')
    d.clause('11.3', 'This Agreement is governed by the laws of India, and the courts of India shall have jurisdiction.')
    d.h('ARTICLE 12 - GENERAL PROVISIONS')
    ;['Independent contractor. The Freelancer is an independent contractor; nothing herein creates employment, partnership or agency.', 'Limitation of liability. Neither Party is liable for indirect or consequential loss; each Party\'s aggregate liability shall not exceed the Contract Value.',
      'Entire agreement. This Agreement, with the Platform records, is the entire agreement between the Parties and may be amended only in writing or through the Platform\'s change process.', 'Electronic execution. This Agreement may be executed electronically and such execution is binding.']
      .forEach((t, i) => d.clause(`12.${i + 1}`, t))
    d.keep(190)
    d.h('ARTICLE 13 - EXECUTION')
    d.p('IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.')
    d.sigLine('', [contract.clientName, contract.freelancerName], [contract.clientId, contract.freelancerId])
    d.p(`Platform Contract ID: ${cid}. This document is generated by FreelanceFlow from live contract records and should be reviewed for applicable legal, tax and jurisdiction-specific requirements before being relied upon as a legally binding contract.`, { size: 8, font: 'F3' })
  }, `FreelanceFlow  |  Contract No. ${cid}`)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `Contract_${cid}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
