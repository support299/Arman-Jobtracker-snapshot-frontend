import {
  applyCompanyNameToTermsText,
  fetchCompanyProfileByLocationId,
  getCompanyContactLines,
  getDefaultCompanyProfile,
} from './companyProfile'
import { DEFAULT_ACCOUNT_CURRENCY } from './accountCurrency'
import { formatMoneyForPdf, formatMoneyOrZeroForPdf } from './formatMoney'

export const handleDownloadPDF = async (
  setIsGeneratingPDF,
  quote,
  contact,
  address,
  quote_schedule,
  service_selections,
  custom_products,
  globalPriceData,
  additional_data,
  house_sqft,
  companyProfile,
  locationId,
  options = {}
) => {
  setIsGeneratingPDF(true)
  try {
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF()

    let yPosition = 20
    const pageHeight = doc.internal.pageSize.height
    const pageWidth = doc.internal.pageSize.width
    const margin = 20
    const lineHeight = 6
    const maxLineWidth = pageWidth - margin * 2

    const defaults = getDefaultCompanyProfile()
    const resolvedLocationId = locationId || companyProfile?.locationId

    let COMPANY = companyProfile || defaults
    if (resolvedLocationId) {
      try {
        COMPANY = await fetchCompanyProfileByLocationId(resolvedLocationId)
      } catch {
        COMPANY = companyProfile?.fromAccountInfo ? companyProfile : COMPANY
      }
    }

    const t = (text) => applyCompanyNameToTermsText(text, COMPANY.name, COMPANY.abbreviation)
    const companyContactLines = getCompanyContactLines(COMPANY)

    const rgb = {
      green: [46, 125, 50],
      orange: [230, 81, 0],
      blue: [2, 60, 143],
      muted: [80, 80, 80],
    }

    const centerText = (text, y, fontSize = 10, style = "normal") => {
      doc.setFontSize(fontSize)
      doc.setFont(undefined, style)
      const w = doc.getTextWidth(text)
      doc.text(text, (pageWidth - w) / 2, y)
    }

    const checkPageBreak = (linesNeeded = 1) => {
      if (yPosition + linesNeeded * lineHeight > pageHeight - 30) {
        doc.addPage()
        yPosition = 20
      }
    }

    const pdfCurrency = COMPANY.currency || DEFAULT_ACCOUNT_CURRENCY
    const formatPrice = (price) => formatMoneyOrZeroForPdf(price, pdfCurrency)
    /** Fixed policy fees in terms (trip fee, deposit, etc.) */
    const fee = (amount) => formatMoneyForPdf(amount, pdfCurrency)

    const addWrappedText = (text, x, y) => {
      const split = doc.splitTextToSize(String(text || ""), maxLineWidth)
      doc.text(split, x, y)
      return split.length * lineHeight
    }

    const formatResponse = (response) => {
      const { question_type, yes_no_answer, text_answer, sub_question_responses, option_responses } = response
      switch (question_type) {
        case "yes_no":
        case "conditional":
          return [yes_no_answer ? "Yes" : "No"]
        case "options":
        case "describe":
          if (option_responses?.length > 0) return option_responses.map(opt => opt.option_text)
          return [text_answer || "N/A"]
        case "quantity":
          if (option_responses?.length > 0) {
            return option_responses.map(opt => `${opt.option_text} — Qty: ${opt.quantity}`)
          }
          return ["N/A"]
        case "multiple_yes_no":
          if (sub_question_responses?.length > 0) {
            return sub_question_responses.map((sub) => {
              const a = sub.yes_no_answer
              const yn = a === true ? "Yes" : a === false ? "No" : String(a ?? "N/A")
              return `${sub.sub_question_text}: ${yn}`
            })
          }
          return ["N/A"]
        default:
          return [text_answer || "N/A"]
      }
    }

    const getBase64FromUrl = async (url) => {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }

    const toTitleCase = (str) => {
      if (!str) return ""
      return str.toLowerCase().split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    }

    const customerName =
      `${toTitleCase(contact?.first_name) || ""} ${toTitleCase(contact?.last_name) || ""}`.trim() || "Customer"
    const streetLine = address
      ? [address.street_address, address.city, address.state, address.postal_code].filter(Boolean).join(", ")
      : ""
    const serviceLocation = streetLine || "—"

    // ------------------------
    // 1. Company logo and information (page 1 only)
    // ------------------------
    const logoUrl = COMPANY.logoUrl || defaults.logoUrl
    const logoBase64 = await getBase64FromUrl(logoUrl)
    const logoFormat = String(logoBase64).includes('data:image/png') ? 'PNG' : 'JPEG'
    const logoW = 38
    const logoH = 38
    doc.addImage(logoBase64, logoFormat, (pageWidth - logoW) / 2, yPosition, logoW, logoH)
    yPosition += logoH + 10

    doc.setTextColor(0, 0, 0)
    centerText(COMPANY.name, yPosition, 12, "bold")
    yPosition += 8

    doc.setFontSize(9)
    doc.setFont(undefined, "normal")
    doc.setTextColor(...rgb.muted)
    companyContactLines.forEach((line) => {
      checkPageBreak(1)
      centerText(line, yPosition, 9)
      yPosition += 5
    })
    doc.setTextColor(0, 0, 0)
    yPosition += 12

    // Prepared for / Prepared by — bottom right, neutral business styling
    const prepFooterMaxW = 72
    const preparedAddrLinesP1 = doc.splitTextToSize(streetLine || "—", prepFooterMaxW)
    const companyFooterLines = doc.splitTextToSize(COMPANY.name, prepFooterMaxW)
    const footerLineH = 4.5
    const footerGap = 5
    const footerBlockHeight =
      footerLineH +
      footerLineH +
      preparedAddrLinesP1.length * footerLineH +
      footerGap +
      footerLineH +
      footerLineH +
      companyFooterLines.length * footerLineH +
      4

    let fy = pageHeight - margin - footerBlockHeight
    const rx = (text) => pageWidth - margin - doc.getTextWidth(text)

    doc.setFontSize(8)
    doc.setFont(undefined, "bold")
    doc.setTextColor(64, 64, 64)
    doc.text("Prepared for:", rx("Prepared for:"), fy)
    fy += footerLineH
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont(undefined, "bold")
    doc.text(customerName, rx(customerName), fy)
    fy += footerLineH
    doc.setFont(undefined, "normal")
    doc.setFontSize(8.5)
    preparedAddrLinesP1.forEach((ln) => {
      doc.text(ln, rx(ln), fy)
      fy += footerLineH
    })
    fy += footerGap - 1
    doc.setFontSize(8)
    doc.setFont(undefined, "bold")
    doc.setTextColor(64, 64, 64)
    doc.text("Prepared by:", rx("Prepared by:"), fy)
    fy += footerLineH
    doc.setTextColor(28, 37, 64)
    doc.setFontSize(10)
    doc.setFont(undefined, "bold")
    companyFooterLines.forEach((ln) => {
      doc.text(ln, rx(ln), fy)
      fy += footerLineH
    })
    doc.setTextColor(0, 0, 0)

    doc.addPage()
    yPosition = 20

    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 12

    doc.setTextColor(...rgb.orange)
    centerText("PROPOSAL", yPosition, 18, "bold")
    doc.setTextColor(0, 0, 0)
    yPosition += 8

    doc.setFontSize(8)
    doc.setFont(undefined, "normal")
    doc.setTextColor(...rgb.muted)
    centerText(`Quote #${quote.id} · ${new Date(quote.created_at).toLocaleDateString()}`, yPosition, 8)
    doc.setTextColor(0, 0, 0)
    yPosition += 12

    // Customer information (before line items & totals on proposal pages)
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    doc.setFontSize(13)
    doc.setFont(undefined, "bold")
    doc.setTextColor(...rgb.green)
    doc.text("Customer Information", margin, yPosition)
    doc.setTextColor(0, 0, 0)
    yPosition += 10

    const colMid = pageWidth / 2 + 8
    doc.setFontSize(9)
    doc.setFont(undefined, "bold")
    doc.text("Presented To:", margin, yPosition)
    doc.text("Service location:", colMid, yPosition)
    yPosition += 5
    doc.setFont(undefined, "normal")
    const leftBlock = doc.splitTextToSize(customerName, colMid - margin - 12)
    const rightBlock = doc.splitTextToSize(serviceLocation, pageWidth - margin - colMid - 4)
    const blockLines = Math.max(leftBlock.length, rightBlock.length)
    for (let i = 0; i < blockLines; i++) {
      checkPageBreak(1)
      if (leftBlock[i]) doc.text(leftBlock[i], margin, yPosition)
      if (rightBlock[i]) doc.text(rightBlock[i], colMid, yPosition)
      yPosition += 5
    }
    yPosition += 2
    doc.text(`Phone: ${contact?.phone || "N/A"}`, margin, yPosition)
    yPosition += 5
    doc.text(`Email: ${contact?.email || "N/A"}`, margin, yPosition)
    yPosition += 5
    doc.text(`Property size: ${house_sqft ? `${house_sqft} sq ft` : "N/A"}`, margin, yPosition)
    yPosition += 10

    if (quote_schedule?.is_submitted && quote_schedule?.scheduled_date) {
      doc.setFont(undefined, "bold")
      doc.setFontSize(9)
      doc.text("Scheduled service", margin, yPosition)
      yPosition += 5
      doc.setFont(undefined, "normal")
      const scheduledDate = new Date(quote_schedule.scheduled_date)
      doc.text(
        `${scheduledDate.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })} · ${scheduledDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
        margin,
        yPosition
      )
      yPosition += 10
    }

    yPosition += 6

    // ------------------------
    // 2. Proposal — line items + totals (page 2+; continues on extra pages if long)
    // ------------------------
    const totalServicePrice =
      service_selections?.reduce((sum, s) => sum + Number(s.final_total_price || 0), 0) || 0
    const customServiceTotal =
      custom_products?.reduce((sum, p) => sum + Number(p.price || 0), 0) || 0
    let subtotal = 0
    if (service_selections?.length > 0) {
      if (totalServicePrice < (globalPriceData?.base_price || 0)) {
        subtotal = Number(globalPriceData?.base_price || 0)
      } else {
        subtotal = totalServicePrice + customServiceTotal
      }
    } else {
      subtotal = Number(quote?.final_total || 0)
    }
    const final = subtotal
    const taxRate = parseFloat(import.meta.env.VITE_TAX_RATE) || 0.0825
    const taxAmount = final * taxRate
    const finalWithTax = final + taxAmount
    const taxRatePercent = (taxRate * 100).toFixed(2)

    doc.setFontSize(13)
    doc.setFont(undefined, "bold")
    doc.setTextColor(...rgb.green)
    doc.text("Proposal", margin, yPosition)
    doc.setTextColor(0, 0, 0)
    yPosition += 10

    const descColW = pageWidth - 2 * margin - 38
    const detailLine = 4.35
    const headerBarH = 8
    checkPageBreak(12)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, yPosition - 4, pageWidth - 2 * margin, headerBarH, "F")
    doc.setFontSize(9)
    doc.setFont(undefined, "bold")
    doc.text("Description", margin + 2, yPosition)
    doc.text("Total", pageWidth - margin - 2, yPosition)
    yPosition += 10
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2)
    doc.setFont(undefined, "normal")

    const advanceY = (n = 1) => {
      yPosition += n * detailLine
    }

    const drawServiceLineItem = (selection, linePrice) => {
      checkPageBreak(16)
      const blockStartY = yPosition
      const title = selection.service_details?.name || "Service"

      doc.setFont(undefined, "bold")
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      const titleLines = doc.splitTextToSize(title, descColW)
      titleLines.forEach((tl) => {
        doc.text(tl, margin + 2, yPosition)
        advanceY(1)
      })

      if (selection.service_details?.description) {
        advanceY(0.35)
        doc.setFont(undefined, "normal")
        doc.setFontSize(8)
        doc.setTextColor(55, 55, 55)
        const descLines = doc.splitTextToSize(
          selection.service_details.description,
          descColW - 4
        )
        descLines.forEach((ln) => {
          checkPageBreak(1)
          doc.text(ln, margin + 4, yPosition)
          advanceY(1)
        })
        doc.setTextColor(0, 0, 0)
        advanceY(0.5)
      }

      if (selection.selected_package_details?.name) {
        checkPageBreak(2)
        doc.setFont(undefined, "bold")
        doc.setFontSize(8.5)
        doc.text("Package", margin + 4, yPosition)
        doc.setFont(undefined, "normal")
        doc.text(selection.selected_package_details.name, margin + 4 + doc.getTextWidth("Package") + 3, yPosition)
        advanceY(1.15)
      }

      if (selection.question_responses?.length > 0) {
        checkPageBreak(4)
        advanceY(0.4)
        doc.setFont(undefined, "bold")
        doc.setFontSize(8)
        doc.setTextColor(72, 72, 72)
        doc.text("Questions & responses", margin + 4, yPosition)
        doc.setTextColor(0, 0, 0)
        advanceY(1.1)

        selection.question_responses.forEach((response, qIdx) => {
          const answers = formatResponse(response)
          const answerText =
            answers.length > 1 ? answers.map((a, i) => `${i + 1}. ${a}`).join(" ") : answers.join(" ")

          const qLines = doc.splitTextToSize(
            `${qIdx + 1}. ${response.question_text || "Question"}`,
            descColW - 8
          )
          const aLines = doc.splitTextToSize(answerText || "—", descColW - 12)

          checkPageBreak(2 + qLines.length + aLines.length)
          doc.setFont(undefined, "bold")
          doc.setFontSize(8)
          qLines.forEach((ql) => {
            doc.text(ql, margin + 6, yPosition)
            advanceY(1)
          })
          doc.setFont(undefined, "normal")
          doc.setFontSize(8)
          doc.setTextColor(60, 60, 60)
          aLines.forEach((al) => {
            checkPageBreak(1)
            doc.text(al, margin + 10, yPosition)
            advanceY(1)
          })
          doc.setTextColor(0, 0, 0)
          advanceY(0.65)
        })
      }

      const priceStr = formatPrice(linePrice)
      doc.setFontSize(9)
      doc.setFont(undefined, "bold")
      doc.setTextColor(0, 0, 0)
      doc.text(priceStr, pageWidth - margin - 2 - doc.getTextWidth(priceStr), blockStartY + 4)
      doc.setFont(undefined, "normal")
      advanceY(0.5)
      doc.setDrawColor(230, 230, 230)
      doc.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8
    }

    const drawProposalRow = (title, detailParts, linePrice) => {
      checkPageBreak(14)
      const blockStartY = yPosition
      doc.setFont(undefined, "bold")
      doc.setFontSize(9)
      const titleLines = doc.splitTextToSize(title, descColW)
      titleLines.forEach((tl) => {
        doc.text(tl, margin + 2, yPosition)
        yPosition += lineHeight
      })
      doc.setFont(undefined, "normal")
      doc.setFontSize(8)
      detailParts.forEach((part) => {
        if (!part) return
        const lines = doc.splitTextToSize(part, descColW - 4)
        lines.forEach((ln) => {
          checkPageBreak(1)
          doc.text(ln, margin + 4, yPosition)
          yPosition += detailLine
        })
        yPosition += 2
      })
      const priceStr = formatPrice(linePrice)
      doc.setFontSize(9)
      doc.setFont(undefined, "bold")
      doc.text(priceStr, pageWidth - margin - 2 - doc.getTextWidth(priceStr), blockStartY + 4)
      doc.setFont(undefined, "normal")
      yPosition += 4
      doc.setDrawColor(230, 230, 230)
      doc.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8
    }

    if (service_selections?.length > 0) {
      service_selections.forEach((selection) => {
        drawServiceLineItem(selection, selection.final_total_price)
      })
    }

    if (custom_products?.length > 0) {
      custom_products.forEach((product) => {
        const details = []
        if (product.description) details.push(product.description)
        drawProposalRow(product.product_name || "Additional item", details, product.price)
      })
    }

    const totalsX = pageWidth - margin - 50
    const amountsX = pageWidth - margin - 2
    const lineTotal = (label, value, bold = false) => {
      checkPageBreak(2)
      doc.setFont(undefined, bold ? "bold" : "normal")
      doc.setFontSize(10)
      doc.text(label, totalsX, yPosition)
      const v = typeof value === "string" ? value : formatPrice(value)
      doc.text(v, amountsX - doc.getTextWidth(v), yPosition)
      yPosition += 6
      doc.setFont(undefined, "normal")
    }

    yPosition += 4
    lineTotal("Subtotal", formatPrice(final))
    lineTotal(`Tax (${taxRatePercent}%)`, formatPrice(taxAmount))

    if (
      service_selections?.length > 0 &&
      totalServicePrice < (globalPriceData?.base_price || 0)
    ) {
      checkPageBreak(2)
      doc.setFontSize(9)
      doc.setTextColor(220, 38, 38)
      yPosition += addWrappedText(
        `Minimum base price of ${formatPrice(globalPriceData?.base_price || 0)} applied.`,
        margin,
        yPosition
      )
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
    }

    yPosition += 4
    doc.setDrawColor(0, 0, 0)
    doc.line(totalsX - 4, yPosition, pageWidth - margin, yPosition)
    yPosition += 8
    lineTotal("Total", formatPrice(finalWithTax), true)

    yPosition += 4
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    const incNote = "Amounts shown; tax calculated as indicated above."
    doc.text(incNote, totalsX, yPosition)
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    yPosition += 12

    const extra = additional_data || {}
    const customerVisibleNotes = (
      extra.customer_notes ||
      (quote?.quote_origin === "public" ? extra.additional_notes : "") ||
      ""
    ).trim()
    if (customerVisibleNotes) {
      checkPageBreak(8)
      doc.setFontSize(10)
      doc.setFont(undefined, "bold")
      doc.text("Notes", margin, yPosition)
      yPosition += 6
      doc.setFont(undefined, "normal")
      yPosition += addWrappedText(customerVisibleNotes, margin, yPosition) + 4
    }

    const technicianNotes = options.includeTechnicianNotes
      ? String(quote?.technician_notes || "").trim()
      : ""
    if (technicianNotes) {
      checkPageBreak(10)
      doc.setFontSize(10)
      doc.setFont(undefined, "bold")
      doc.text("Technician notes (internal — not shown to customer)", margin, yPosition)
      yPosition += 6
      doc.setFont(undefined, "normal")
      yPosition += addWrappedText(technicianNotes, margin, yPosition) + 4
    }

    const agreementDate = additional_data?.submitted_at
      ? new Date(additional_data.submitted_at)
      : new Date()

    // ------------------------
    // Signature
    // ------------------------
    // if (additional_data?.signature) {
    //   checkPageBreak(10)
    //   doc.setFontSize(12)
    //   doc.setFont(undefined, "bold")
    //   doc.setTextColor("#000000")
    //   doc.text("CUSTOMER SIGNATURE", margin, yPosition)
    //   yPosition += 8

    //   try {
    //     // Professional signature size
    //     doc.addImage(`data:image/png;base64,${additional_data.signature}`, "PNG", margin, yPosition, 100, 40)
    //     yPosition += 45
    //   } catch (e) {
    //     doc.setFontSize(10)
    //     doc.setFont(undefined, "normal")
    //     doc.setTextColor("#666666")
    //     doc.text("Digital signature on file", margin, yPosition)
    //     yPosition += 10
    //   }
      
    //   // Use actual signature timestamp from submitted_at, otherwise use current date
    //   const signatureDate = additional_data?.submitted_at 
    //     ? new Date(additional_data.submitted_at)
    //     : new Date();
      
    //   yPosition += 3
    //   doc.setFontSize(10)
    //   doc.setFont(undefined, "normal")
    //   doc.setTextColor("#000000")
    //   doc.text(`Date: ${signatureDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, yPosition)
    //   yPosition += 5
    //   doc.text(`Time: ${signatureDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`, margin, yPosition)
    //   yPosition += 15
    // }

    // ------------------------
    // Terms & Conditions Agreement
    // ------------------------
    // if (quote?.status === "accepted") {
    //   checkPageBreak(4)
    //   doc.setFontSize(10)
    //   doc.setFont(undefined, "normal")
    //   doc.setTextColor("#374151")
    //   yPosition += 5
    //   doc.text("✓ I have read and agree to the Terms & Conditions and Privacy Policy", margin, yPosition)
    //   yPosition += 10
    // }

    // ------------------------
    // 4. Terms and conditions
    // ------------------------
    {
      checkPageBreak(30)
      if (yPosition > pageHeight - 100) {
        doc.addPage()
        yPosition = 20
      } else {
        yPosition += 14
      }

      const termsMargin = margin
      const termsLineHeight = 3.5 // Further reduced from 4
      const termsSpacing = 0.5 // Further reduced spacing between items
      const termsMaxLineWidth = pageWidth - termsMargin * 2
      
      // Override checkPageBreak for terms section with tighter margins
      const checkTermsPageBreak = (linesNeeded = 1) => {
        if (yPosition + linesNeeded * termsLineHeight > pageHeight - 15) { // Reduced bottom margin from 30
          doc.addPage()
          yPosition = 15 // Reduced from 20
        }
      }
      
      doc.setFontSize(14)
      doc.setFont(undefined, "bold")
      doc.setTextColor(rgb.green[0], rgb.green[1], rgb.green[2])
      doc.text("Terms and Conditions", termsMargin, yPosition)
      yPosition += 6
      doc.setFontSize(10)
      doc.setFont(undefined, "bold")
      doc.setTextColor(0, 0, 0)
      doc.text("Agreement", termsMargin, yPosition)
      yPosition += 6
      doc.setFontSize(8)
      doc.setFont(undefined, "normal")
      doc.setTextColor(60, 60, 60)
      doc.text(COMPANY.name, termsMargin, yPosition)
      yPosition += 6
      doc.setTextColor(0, 0, 0)
      
      // Agreement Statement with Timestamp
      doc.setFontSize(7) // Further reduced from 8
      doc.setFont(undefined, "bold")
      doc.setTextColor("#1f2937")
      const agreementText = `CLIENT AGREEMENT ACKNOWLEDGMENT`
      doc.text(agreementText, termsMargin, yPosition)
      yPosition += 3 // Reduced from 6
      
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const acknowledgmentText = `The client has read and agreed to the Terms & Conditions and Privacy Policy`
      const acknowledgmentLines = doc.splitTextToSize(acknowledgmentText, termsMaxLineWidth)
      doc.text(acknowledgmentLines, termsMargin, yPosition)
      yPosition += acknowledgmentLines.length * termsLineHeight + 2 // Reduced spacing
      
      doc.setFont(undefined, "bold")
      doc.setTextColor("#1f2937")
      doc.setFontSize(6) // Further reduced from 7
      const agreementDateText = `Agreement Date & Time: ${agreementDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${agreementDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`
      const agreementDateLines = doc.splitTextToSize(agreementDateText, termsMaxLineWidth)
      doc.text(agreementDateLines, termsMargin, yPosition)
      yPosition += agreementDateLines.length * termsLineHeight + 3 // Reduced from 10
      
      // Divider line
      doc.setDrawColor(200, 200, 200)
      doc.line(termsMargin, yPosition, pageWidth - termsMargin, yPosition)
      yPosition += 4 // Reduced from 10
      
      // OLD TERMS - HIDDEN
      // Terms Content
      // doc.setFontSize(11)
      // doc.setFont(undefined, "bold")
      // doc.setTextColor("#000000")
      // doc.text("GENERAL TERMS", margin, yPosition)
      // ... (old terms code hidden)
      
      // NEW TERMS AND CONDITIONS
      // Written Notice Definition
      doc.setFontSize(6.5) // Further reduced from 7
      doc.setFont(undefined, "italic")
      doc.setTextColor("#374151")
      const noticeText = t("Written notice for anything in this agreement means email or SMS/text message to TruShine's official contact information on your invoice/estimate/website (or the number/email used to confirm your appointment).")
      const noticeLines = doc.splitTextToSize(noticeText, termsMaxLineWidth)
      doc.text(noticeLines, termsMargin, yPosition)
      yPosition += noticeLines.length * termsLineHeight + 1.5 // Further reduced spacing
      
      // 1) Definitions
      doc.setFontSize(8) // Further reduced from 9
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("1) Definitions", termsMargin, yPosition)
      yPosition += 3 // Further reduced from 4
      
      doc.setFontSize(6.5) // Further reduced from 7
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const definitions = [
        t("\"TruShine / TWC\" = TruShine Window Cleaning."),
        "\"Client\" = the person or entity booking services.",
        "\"Services\" = work listed in the estimate/proposal/work order/invoice.",
        "\"Visit\" = a scheduled service appointment date.",
        "\"Site\" = the property where Services are performed.",
        "\"Recurring Plan\" = ongoing services scheduled monthly, bi-monthly, quarterly, semi-annual, or annual."
      ]
      definitions.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // 2) Acceptance & Agreement
      yPosition += 1.5 // Further reduced from 2
      checkTermsPageBreak(4)
      doc.setFontSize(8) // Further reduced from 9
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("2) Acceptance & Agreement", termsMargin, yPosition)
      yPosition += 3 // Further reduced from 4
      
      doc.setFontSize(6.5) // Further reduced from 7
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const acceptanceText = "Quotes are valid for 30 days and must be accepted in writing (signature, electronic acceptance, or checkbox). By booking, approving, paying, or accepting electronically, Client agrees to these Master Terms & Conditions. If Client enrolls in a Recurring Plan, the Recurring Service Addendum also applies."
      const acceptanceLines = doc.splitTextToSize(acceptanceText, termsMaxLineWidth - 3)
      doc.text(acceptanceLines, termsMargin + 3, yPosition)
      yPosition += acceptanceLines.length * termsLineHeight + 1.5 // Further reduced spacing
      
      // 3) Professional Standards
      checkPageBreak(4)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("3) Professional Standards, Codes, and Insurance", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const standardsText = t("All work is performed in a professional, workmanlike manner and in compliance with applicable local codes and regulations. TruShine is properly insured against injury to employees and losses resulting from employee actions.")
        const standardsLines = doc.splitTextToSize(standardsText, termsMaxLineWidth - 3)
        doc.text(standardsLines, termsMargin + 3, yPosition)
      yPosition += standardsLines.length * termsLineHeight + 2 // Reduced spacing
      
      // 4) Scope of Work & Exclusions
      checkPageBreak(6)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("4) Scope of Work & Exclusions", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const scopeIntro = "The scope is limited to what is specifically included in the estimate/proposal/work order. Anything not listed is excluded unless agreed in writing."
        const scopeIntroLines = doc.splitTextToSize(scopeIntro, termsMaxLineWidth - 3)
        doc.text(scopeIntroLines, termsMargin + 3, yPosition)
      yPosition += scopeIntroLines.length * termsLineHeight + 2
      
      const scopeTerms = [
        "A) Window Cleaning: All windows must be securely closed on the day of service. Unsafe/inaccessible windows will not be cleaned. Exterior glass may be cleaned using a water-fed pole with pure water and left to dry naturally. \"Window\" includes frame, sill, sash, and glass (wood, aluminum, steel, UPVC). Brick/tile/stone sills are excluded. Add-ons (extra fee unless included): screen cleaning, track detailing, hard water removal, etc.",
        "B) Gutter Cleaning: Basic gutter cleaning includes clearing internal gutters only. Debris hauling and repairs are not included unless agreed in writing. Cleaning may be performed via leaf blower; downspouts may be flushed with hose. Exterior gutter surface cleaning is not included (available for additional cost).",
        t(`C) Pressure Washing: Removes most stains; some marks may remain. External water access is required. Client must cover/remove outdoor furniture. If TruShine must do it, a ${fee(150)} fee may apply. TruShine is not liable for chemical damage to items not properly protected/removed.`),
        t("D) Awning Cleaning: TruShine is not liable for unexpected damage during awning cleaning. Service may be declined if material is over 5 years old or fails inspection.")
      ]
      scopeTerms.forEach(term => {
        checkTermsPageBreak(4)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // 5) Access, Safety, and Property Condition
      yPosition += 2 // Reduced from 3
      checkPageBreak(6)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("5) Access, Safety, and Property Condition", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const accessTerms = [
        "• Client must provide full access to work areas (gates unlocked, pets secured, clear access).",
        t("• TruShine will not move obstacles/furniture for access (unless agreed)."),
        t(`• If TruShine arrives and cannot perform due to lack of access or unsafe conditions, a ${fee(75)} trip fee applies.`),
        t("• Client is responsible for ensuring items/structures are sound. TruShine may document or refuse questionable items."),
        t("• Any special accommodations must be reviewed and approved by TruShine management before accepting the proposal.")
      ]
      accessTerms.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // 6) Scheduling, Rescheduling, and Delays
      yPosition += 2 // Reduced from 3
      checkPageBreak(6)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("6) Scheduling, Rescheduling, and Delays", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const schedulingTerms = [
        t("• TruShine is not liable for delays due to weather, supply issues, or other uncontrollable factors."),
        "• Each Client may reschedule up to two (2) times within 7 days of the original date.",
        `• Rescheduling/cancellation requested within 8 hours of a scheduled Visit: ${fee(35)} fee.`,
        "• Rescheduling more than 8 hours in advance: no fee for the first 2 reschedules.",
        t("• Beyond 2 reschedules, TruShine may charge up to the full service amount to protect crew scheduling and reserved time."),
        "• Important: These rescheduling rules apply to all Visits, including Recurring Plan Visits."
      ]
      schedulingTerms.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // 7) Pricing, Deposits, and Payments
      yPosition += 2 // Reduced from 3
      checkPageBreak(6)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("7) Pricing, Deposits, and Payments", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const paymentTerms = [
        "• Payment is due upon completion unless otherwise agreed in writing.",
        t(`• TruShine may require credit card info on file and/or a ${fee(100)} deposit.`),
        "• Jobs needing materials may require a 50% deposit.",
        "• Accepted: cash, check, credit card (in person, by phone, or online).",
        COMPANY.address
          ? t(`• Commercial payments may be mailed to: ${COMPANY.address}.`)
          : t('• Commercial payments may be mailed to the address shown on your invoice.'),
        "• Clients with unpaid balances may be denied further service.",
        "• Disputed payments are Client's responsibility; late/recovery fees may apply.",
        "• All services are subject to applicable Texas state tax."
      ]
      paymentTerms.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // 8) Late Fees & Collections
      yPosition += 2 // Reduced from 3
      checkPageBreak(6)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("8) Late Fees & Collections", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const lateFeeTerms = [
        "• Residential: 10% late fee after 1 day.",
        "• Commercial: 10% late fee after 30 days.",
        "• Balances unpaid after 60 days may be sent to collections, including legal fees and collection costs as permitted by law."
      ]
      lateFeeTerms.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // 9) Guarantees
      yPosition += 2 // Reduced from 3
      checkPageBreak(6)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("9) Guarantees (Service-Specific)", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const guaranteeTerms = [
        "• Window Cleaning: 36-hour streak-free guarantee on all window cleaning packages.",
        "• Gutter Cleaning: 15-day guarantee on all gutter cleaning packages.",
        "• Awning Cleaning: 24-hour guarantee on all awning cleaning services.",
        "• Pressure Washing: 3-day satisfaction guarantee on premium pressure washing packages only."
      ]
      guaranteeTerms.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // 10) Complaints, Re-Visits, and Trip Fees
      yPosition += 2 // Reduced from 3
      checkPageBreak(6)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("10) Complaints, Re-Visits, and Trip Fees", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const complaintTerms = [
        "• Any service concerns must be reported within 48 hours of completion for review and resolution.",
        t("• TruShine must be given a reasonable opportunity to inspect and/or correct any confirmed workmanship issues."),
        `• If a complaint revisit finds the work satisfactory, a ${fee(75)} trip fee applies.`
      ]
      complaintTerms.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // 11) Refund Policy
      yPosition += 3
      checkPageBreak(4)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("11) Refund Policy", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const refundText = "All sales are final. Refunds are only for unused materials during service (if applicable)."
        const refundLines = doc.splitTextToSize(refundText, termsMaxLineWidth - 3)
        doc.text(refundLines, termsMargin + 3, yPosition)
      yPosition += refundLines.length * lineHeight + 3
      
      // 12) Cancellation Policy
      checkPageBreak(4)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("12) Cancellation Policy (One-Time / Non-Recurring)", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const cancellationText = t("Client cancellation requests should be provided with as much notice as possible. For larger or reserved jobs, TruShine may require 14 days' written notice; shorter notice may result in a charge up to the full service amount, depending on crew scheduling and reserved time.")
        const cancellationLines = doc.splitTextToSize(cancellationText, termsMaxLineWidth - 3)
        doc.text(cancellationLines, termsMargin + 3, yPosition)
      yPosition += cancellationLines.length * termsLineHeight + 2
      
      // 13) Liability Limits
      checkPageBreak(4)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("13) Liability Limits & Pre-Existing Damage", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const liabilityText = t("TruShine is not responsible for pre-existing damage or deterioration including (but not limited to): aged gutters, rotted wood, failing seals, cracked panes, loose screens, or previously weakened/fragile items. Client must notify TruShine of known issues or safety concerns prior to service.")
        const liabilityLines = doc.splitTextToSize(liabilityText, termsMaxLineWidth - 3)
        doc.text(liabilityLines, termsMargin + 3, yPosition)
      yPosition += liabilityLines.length * termsLineHeight + 2
      
      // 14) Updates to Terms
      checkPageBreak(4)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("14) Updates to Terms", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const updatesText = t("TruShine reserves the right to update these Terms & Conditions at any time. Updated terms apply prospectively.")
        const updatesLines = doc.splitTextToSize(updatesText, termsMaxLineWidth - 3)
        doc.text(updatesLines, termsMargin + 3, yPosition)
      yPosition += updatesLines.length * termsLineHeight + 2
      
      // 15) Order of Priority
      checkPageBreak(6)
      doc.setFontSize(9) // Reduced from 11
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("15) Order of Priority (If Anything Conflicts)", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(7) // Reduced from 9
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
        const priorityIntro = "If there is a conflict between documents:"
        doc.text(priorityIntro, termsMargin + 3, yPosition)
      yPosition += 6
      const priorityTerms = [
        "1. The signed/accepted proposal/work order/invoice for the Visit, then",
        "2. the Recurring Service Addendum (if enrolled), then",
        "3. these Master Terms & Conditions."
      ]
      priorityTerms.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // Recurring Service Addendum
      yPosition += 3 // Reduced from 5
        checkTermsPageBreak(8)
      doc.setFontSize(9) // Further reduced from 10
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("Recurring Service Addendum", termsMargin, yPosition)
      yPosition += 4 // Further reduced from 5
      doc.setFontSize(7) // Further reduced from 8
      doc.setFont(undefined, "normal")
      doc.text("(Window Cleaning & Gutter Cleaning)", termsMargin, yPosition)
      yPosition += 5 // Reduced from 8
      
      // R1) Scope of Recurring Services
      doc.setFontSize(8) // Further reduced from 9
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("R1) Scope of Recurring Services", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(6.5) // Further reduced from 7
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const recurringScopeText = t("TruShine will perform recurring window cleaning and/or gutter cleaning as selected: Window Cleaning: exterior window cleaning for all accessible glass; interior if included; add-ons available for additional fee. Gutter Cleaning: removal of debris; flushing downspouts; light roof debris removal near gutter lines when safely accessible. Services occur on the chosen frequency: monthly, bi-monthly, quarterly, semi-annual, or annual, and continue until canceled per this Addendum.")
        const recurringScopeLines = doc.splitTextToSize(recurringScopeText, termsMaxLineWidth - 3)
        doc.text(recurringScopeLines, termsMargin + 3, yPosition)
      yPosition += recurringScopeLines.length * termsLineHeight + 1.5 // Further reduced
      
      // R2) Pricing & Payment Terms
      checkTermsPageBreak(6)
      doc.setFontSize(8) // Further reduced from 9
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("R2) Pricing & Payment Terms (Recurring)", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(6.5) // Further reduced from 7
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const recurringPaymentTerms = [
        "• Recurring clients receive discounted pricing compared to one-time rates.",
        "• Pricing is based on property size, service scope, and access conditions.",
        t("• Billing timing: For Recurring Plan Visits, Client authorizes TruShine to charge the card on file after completion of each Visit (same day), unless otherwise agreed in writing."),
        "• A valid credit card must be kept on file for automated billing; receipts are sent via email after each charge."
      ]
      recurringPaymentTerms.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // R3) Minimum Commitment
      yPosition += 1.5 // Further reduced from 2
      checkTermsPageBreak(6)
      doc.setFontSize(8) // Further reduced from 9
      doc.setFont(undefined, "bold")
      doc.setTextColor("#000000")
      doc.text("R3) Minimum Commitment (By Frequency)", termsMargin, yPosition)
      yPosition += 4 // Reduced from 7
      
      doc.setFontSize(6.5) // Further reduced from 7
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const commitmentTerms = [
        "• Monthly, Bi-Monthly, Quarterly, Semi-Annual: minimum one (1) year commitment.",
        "• Quarterly: minimum 4 scheduled services",
        "• Semi-Annual: minimum 2 scheduled services",
        "• Annual: minimum two (2) year commitment with at least 2 scheduled services per year."
      ]
      commitmentTerms.forEach(term => {
        checkTermsPageBreak(3)
        const lines = doc.splitTextToSize(term, termsMaxLineWidth - 3)
        doc.text(lines, termsMargin + 3, yPosition)
        yPosition += lines.length * termsLineHeight + termsSpacing
      })
      
      // R4-R9) Additional Recurring Terms
      const recurringSections = [
        { title: "R4) Renewal & Post-Term Continuation", text: "After the minimum commitment is met, the plan continues automatically at the same recurring rate unless Client cancels with written notice (as defined at the top). No price increases apply without Client approval or advance written notice." },
        { title: "R5) Cancellation After Minimum Term", text: "After the minimum commitment is met, either party may terminate with at least 14 days' written notice." },
        { title: "R6) Early Cancellation Policy (Before Minimum Term)", text: "If Client cancels before fulfilling the minimum service term, a cancellation fee applies equal to: the difference between the discounted recurring rate and the standard one-time rate (plus tax) for all completed Visits to date. This fee will be charged to the card on file on the day of cancellation." },
        { title: "R7) Client Responsibilities (Recurring)", text: t(`Ensure access on scheduled dates (gates unlocked, pets secured, clear paths). Notify TruShine of pre-existing issues, fragile items, or safety concerns. Communicate promptly about scheduling changes or access restrictions. If TruShine arrives and cannot perform due to lack of access, the ${fee(75)} trip fee applies, and rescheduling fees may also apply.`) },
        { title: "R8) Service Adjustments & Changes", text: t("Pricing may be updated if property conditions change or the service scope is modified. Client may request upgrades, add-ons, or frequency changes with written notice. TruShine will provide advance notice of pricing updates.") },
        { title: "R9) Weather / Safety / Access Limitations", text: t("TruShine may cancel or reschedule due to weather, safety concerns, or access limitations.") }
      ]
      
      recurringSections.forEach(section => {
        yPosition += 2 // Further reduced from 3
        checkTermsPageBreak(6)
        doc.setFontSize(8) // Further reduced from 11
        doc.setFont(undefined, "bold")
        doc.setTextColor("#000000")
        doc.text(section.title, termsMargin, yPosition)
        yPosition += 3 // Further reduced from 4
        
        doc.setFontSize(6.5) // Further reduced from 9
        doc.setFont(undefined, "normal")
        doc.setTextColor("#374151")
        const sectionLines = doc.splitTextToSize(section.text, termsMaxLineWidth - 3)
        doc.text(sectionLines, termsMargin + 3, yPosition)
        yPosition += sectionLines.length * termsLineHeight + termsSpacing
      })
      
      // Final Agreement Statement
      yPosition += 5 // Further reduced from 10
      checkTermsPageBreak(6)
      doc.setDrawColor(200, 200, 200)
      doc.line(termsMargin, yPosition, pageWidth - termsMargin, yPosition)
      yPosition += 5 // Further reduced from 10
      
      doc.setFontSize(7) // Further reduced from 8
      doc.setFont(undefined, "normal")
      doc.setTextColor("#374151")
      const finalAgreement = "By signing this document, the client acknowledges that they have read, understood, and agreed to all Terms & Conditions contained in this proposal."
        const finalAgreementLines = doc.splitTextToSize(finalAgreement, termsMaxLineWidth)
        doc.text(finalAgreementLines, termsMargin, yPosition)
      yPosition += finalAgreementLines.length * termsLineHeight + 4

      if (additional_data?.signature) {
        checkTermsPageBreak(22)
        try {
          doc.addImage(
            `data:image/png;base64,${additional_data.signature}`,
            "PNG",
            termsMargin,
            yPosition,
            100,
            40
          )
          yPosition += 46
        } catch {
          doc.setFontSize(9)
          doc.setTextColor(100, 100, 100)
          doc.text("Digital signature on file", termsMargin, yPosition)
          doc.setTextColor(0, 0, 0)
          yPosition += 8
        }

        doc.setFontSize(10)
        doc.setFont(undefined, "normal")
        doc.setTextColor(0, 0, 0)
        const signedByName =
          (contact &&
            (toTitleCase([contact?.first_name, contact?.last_name].filter(Boolean).join(" ")) ||
              contact?.email)) ||
          "Customer"
        doc.text(`Signed by: ${signedByName}`, termsMargin, yPosition)
        yPosition += 5
        doc.text(
          `Date: ${agreementDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
          termsMargin,
          yPosition
        )
        yPosition += 5
        doc.text(
          `Time: ${agreementDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}`,
          termsMargin,
          yPosition
        )
        yPosition += 8
      }
    }

    const timestamp = new Date().toISOString().split("T")[0]
    doc.save(`${COMPANY.name.replace(/\s+/g, '-')}-Quote-${quote.id}-${timestamp}.pdf`)
  } catch (error) {
    alert("Failed to generate PDF. Please try again.")
    console.error('Error generating PDF:', error)
  } finally {
    setIsGeneratingPDF(false)
  }
}
