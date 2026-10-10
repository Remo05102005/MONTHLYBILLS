import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';

// ---------- palette ----------
const NAVY = [15, 23, 42];
const GREY = [100, 116, 139];
const SOFT = [241, 245, 249];
const LINE = [226, 232, 240];
const GREEN = [22, 163, 74];
const RED = [220, 38, 38];
const BLUE = [37, 99, 235];
const AMBER = [217, 119, 6];
const WHITE = [255, 255, 255];

// ---------- small helpers ----------
// jsPDF's built-in fonts can't draw the rupee symbol, so amounts use "Rs."
const inr = (n) => {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? '-' : ''}Rs. ${Math.abs(v).toLocaleString('en-IN')}`;
};

// Compact form for tight spaces: 950, 1.2k, 12k, 1.5L
const short = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
};

const amt = (t) => Number(t.amount) || 0;
const sumAmount = (list) => list.reduce((s, t) => s + amt(t), 0);
const dayKey = (d) => format(new Date(d), 'yyyy-MM-dd');
const inRange = (list, start, end) => list.filter(t => {
  const d = new Date(t.date);
  return d >= start && d <= end;
});
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Cost colours: the cheapest value is green, the costliest red, everything in
// between runs through yellow. Used for every "how much was spent" graphic.
const HEAT = [[34, 197, 94], [250, 204, 21], [220, 38, 38]];
const heat = (t) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x < 0.5 ? mix(HEAT[0], HEAT[1], x * 2) : mix(HEAT[1], HEAT[2], (x - 0.5) * 2);
};
// With nothing to compare against (one value, or all equal) use the neutral
// middle colour instead of claiming it is the costliest.
const heatFor = (value, lo, hi) => (hi > lo ? heat((value - lo) / (hi - lo)) : heat(value > 0 ? 0.5 : 0));

// Bills is a catch-all (Rent, Electricity, Children...), so it is shown by its
// subcategory; every other category is shown by its own name.
const expenseLabel = (t) => (t.category === 'Bills' && t.subCategory) ? t.subCategory : (t.category || 'Others');
const FOOD = ['Milk', 'Vegetables', 'Fruits', 'Groceries', 'Chicken', 'Eggs'];

/**
 * Monthly money report, built page by page. Every page answers one question:
 *   1. How did the month go?          (the totals)
 *   2. Where did the money go?        (categories)
 *   3. Which days were costly?        (calendar)
 *   4. How is the pace?               (weeks + weekdays)
 *   5. Better or worse than before?   (last month)
 *   6. The last 12 months             (earned vs spent graph)
 *   7. Savings over the year          (saved each month)
 *   8. Your top items over the year   (small trend graphs)
 *   9. What should I do next?         (plain tips)
 *  10. Every entry                    (ledger)
 *
 * @param {Array} transactions           transactions covering `month`
 * @param {Date|string} month            month to report on
 * @param {Array} [previousTransactions] transactions of the months before `month`
 *                                       (up to 11 earlier months). Enables the
 *                                       last-month comparison and the 12-month pages.
 */
export const generateMonthlyReport = (transactions, month, previousTransactions = []) => {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  const M = 15;
  const CW = W - 2 * M;

  let monthDate = typeof month === 'string' ? new Date(month) : month;
  if (!(monthDate instanceof Date) || isNaN(monthDate.getTime())) monthDate = new Date();
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthName = format(monthDate, 'MMMM yyyy');

  // ---------- numbers used across pages ----------
  const txs = inRange(transactions || [], monthStart, monthEnd);
  // Spending graphics (calendar, weeks, weekdays, categories) are built from
  // expenseTxs only - income never enters them.
  const isIncome = (t) => String(t.type || '').trim().toLowerCase() === 'income';
  const incomeTxs = txs.filter(isIncome);
  const expenseTxs = txs.filter(t => !isIncome(t));

  const totalIncome = sumAmount(incomeTxs);
  const totalSpent = sumAmount(expenseTxs);
  const saved = totalIncome - totalSpent;
  const savingsPct = totalIncome > 0 ? (saved / totalIncome) * 100 : null;

  // Averages run only up to today for the running month.
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const elapsed = allDays.filter(d => d <= endOfToday);
  const totalDays = allDays.length;
  const daysPassed = Math.max(elapsed.length, 1);
  const daysLeft = totalDays - elapsed.length;
  const isRunning = daysLeft > 0 && elapsed.length > 0;

  const dailySpend = {};
  elapsed.forEach(d => { dailySpend[dayKey(d)] = 0; });
  expenseTxs.forEach(t => {
    const k = dayKey(t.date);
    if (k in dailySpend) dailySpend[k] += amt(t);
  });
  const spendValues = Object.values(dailySpend);
  const noSpendDays = spendValues.filter(v => v === 0).length;
  const maxDaySpend = Math.max(0, ...spendValues);
  const costliest = Object.entries(dailySpend).reduce(
    (m, [d, v]) => (v > m.amount ? { day: d, amount: v } : m), { day: '', amount: 0 });
  const cheapest = Object.entries(dailySpend)
    .filter(([, v]) => v > 0)
    .reduce((m, [d, v]) => (m.day === '' || v < m.amount ? { day: d, amount: v } : m), { day: '', amount: 0 });

  const avgPerDay = totalSpent / daysPassed;
  const projectedSpend = avgPerDay * totalDays;

  const byLabel = {};
  expenseTxs.forEach(t => {
    const k = expenseLabel(t);
    byLabel[k] = (byLabel[k] || 0) + amt(t);
  });
  const labelRows = Object.entries(byLabel).sort(([, a], [, b]) => b - a);

  const foodTotal = sumAmount(expenseTxs.filter(t => FOOD.includes(t.category)));
  const billsTotal = sumAmount(expenseTxs.filter(t => t.category === 'Bills'));
  const petrolTotal = sumAmount(expenseTxs.filter(t => t.category === 'Petrol'));
  const otherTotal = Math.max(totalSpent - foodTotal - billsTotal - petrolTotal, 0);

  const biggestTx = expenseTxs.reduce((m, t) => (amt(t) > amt(m || {}) ? t : m), null);

  // ---------- drawing helpers ----------
  const fit = (text, width) => {
    let s = String(text || '');
    if (doc.getTextWidth(s) <= width) return s;
    while (s.length > 1 && doc.getTextWidth(`${s}...`) > width) s = s.slice(0, -1);
    return `${s}...`;
  };

  const header = (title, subtitle) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 26, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title, M, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(203, 213, 225);
    doc.text(subtitle, M, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(monthName, W - M, 12, { align: 'right' });
  };

  const newPage = (title, subtitle) => {
    doc.addPage();
    header(title, subtitle);
  };

  const card = (x, y, w, h, label, value, sub, color = NAVY) => {
    doc.setFillColor(...SOFT);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(fit(label, w - 8), x + 5, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...color);
    doc.text(fit(value, w - 8), x + 5, y + 18);
    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(fit(sub, w - 8), x + 5, y + h - 3.5);
    }
  };

  const bar = (x, y, w, h, value, max, color) => {
    doc.setFillColor(...SOFT);
    doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
    const fill = max > 0 ? Math.min(value / max, 1) * w : 0;
    if (fill > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(x, y, Math.max(fill, h), h, h / 2, h / 2, 'F');
    }
  };

  const sectionLabel = (text, y) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(text, M, y);
  };

  const note = (text, y, color = GREY) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, CW);
    doc.text(lines, M, y);
    return y + lines.length * 5;
  };

  // =====================================================================
  // PAGE 1 - the month at a glance
  // =====================================================================
  // ---- Cover-style top, like a statement preview ----
  const HEAD_H = 46;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, HEAD_H, 'F');
  doc.setFillColor(...BLUE);
  doc.rect(0, HEAD_H - 2.5, W, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(147, 197, 253);
  doc.text('C O M M O N   M A N', M, 13);

  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text('Monthly Money Report', M, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.5);
  doc.setTextColor(226, 232, 240);
  doc.text(monthName, M, 34);
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`${format(monthStart, 'dd MMM yyyy')}  -  ${format(monthEnd, 'dd MMM yyyy')}`, M, 40);

  // Status chip + generated date, top right
  const chipText = isRunning ? `DAY ${elapsed.length} OF ${totalDays}` : 'COMPLETE MONTH';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const chipW = doc.getTextWidth(chipText) + 10;
  doc.setFillColor(...(isRunning ? AMBER : GREEN));
  doc.roundedRect(W - M - chipW, 10, chipW, 8, 4, 4, 'F');
  doc.setTextColor(...WHITE);
  doc.text(chipText, W - M - chipW / 2, 15.3, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated ${format(new Date(), 'dd MMM yyyy')}`, W - M, 25, { align: 'right' });

  // ---- Summary strip: earned | spent | saved ----
  const stripTop = 54;
  const stripH = 36;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, stripTop, CW, stripH, 3, 3, 'FD');
  const colW = CW / 3;
  [
    ['MONEY EARNED', inr(totalIncome), GREEN, `${incomeTxs.length} entr${incomeTxs.length === 1 ? 'y' : 'ies'}`],
    ['MONEY SPENT', inr(totalSpent), RED, `${expenseTxs.length} expense${expenseTxs.length === 1 ? '' : 's'}`],
    [saved >= 0 ? 'MONEY SAVED' : 'OVERSPENT BY', inr(Math.abs(saved)), saved >= 0 ? BLUE : RED, savingsPct === null ? 'add income to see %' : `${savingsPct.toFixed(0)}% of income`],
  ].forEach(([label, value, color, sub], i) => {
    const cx = M + colW * i + colW / 2;
    if (i > 0) {
      doc.setDrawColor(...LINE);
      doc.line(M + colW * i, stripTop + 7, M + colW * i, stripTop + stripH - 7);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(label, cx, stripTop + 10, { align: 'center' });
    doc.setFontSize(15);
    doc.setTextColor(...color);
    doc.text(fit(value, colW - 8), cx, stripTop + 21, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(sub, cx, stripTop + 28.5, { align: 'center' });
  });

  // ---- Verdict: ring gauge of income used + plain-words summary ----
  let verdict;
  let verdictSub;
  let verdictColor;
  if (txs.length === 0) {
    verdict = 'Nothing recorded this month';
    verdictSub = 'Add your income and expenses to see how the month went.';
    verdictColor = GREY;
  } else if (totalIncome === 0) {
    verdict = 'Add your income';
    verdictSub = `You spent ${inr(totalSpent)}. Add income to see how much you are saving.`;
    verdictColor = AMBER;
  } else if (saved < 0) {
    verdict = 'Spending went over income';
    verdictSub = `You spent ${inr(-saved)} more than you earned this month.`;
    verdictColor = RED;
  } else if (savingsPct >= 20) {
    verdict = 'Great month!';
    verdictSub = `You kept ${savingsPct.toFixed(0)}% of your income - ${inr(saved)} saved.`;
    verdictColor = GREEN;
  } else if (savingsPct >= 10) {
    verdict = 'A decent month';
    verdictSub = `You saved ${savingsPct.toFixed(0)}%. Try to reach 20% next month.`;
    verdictColor = AMBER;
  } else {
    verdict = 'A tight month';
    verdictSub = `Only ${savingsPct.toFixed(0)}% of your income was saved.`;
    verdictColor = AMBER;
  }
  const panelTop = stripTop + stripH + 8;
  const panelH = 54;
  doc.setFillColor(...SOFT);
  doc.roundedRect(M, panelTop, CW, panelH, 3, 3, 'F');

  // Donut: how the money earned was divided - spent (red) and saved (blue)
  const dcx = M + 31;
  const dcy = panelTop + panelH / 2;
  const dR = 16.5;
  const dW = 7;
  const spentShare = totalIncome > 0 ? Math.min(totalSpent / totalIncome, 1) : 0;
  const drawArc = (fromDeg, toDeg, color) => {
    if (toDeg - fromDeg <= 0.01) return;
    doc.setDrawColor(...color);
    doc.setLineWidth(dW);
    const stepDeg = 2;
    for (let a = fromDeg; a < toDeg; a += stepDeg) {
      // The small overlap hides hairline gaps between neighbouring pieces
      const a1 = ((-90 + a) * Math.PI) / 180;
      const a2 = ((-90 + Math.min(a + stepDeg + 0.8, toDeg)) * Math.PI) / 180;
      doc.line(dcx + dR * Math.cos(a1), dcy + dR * Math.sin(a1),
        dcx + dR * Math.cos(a2), dcy + dR * Math.sin(a2));
    }
  };
  if (totalIncome > 0) {
    drawArc(0, spentShare * 360, RED);
    drawArc(spentShare * 360, 360, BLUE);
  } else {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(dW);
    doc.circle(dcx, dcy, dR, 'S');
  }
  // Centre of the donut: the number that matters most
  const centerBig = totalIncome > 0 ? `${Math.round((totalSpent / totalIncome) * 100)}%` : '-';
  const centerSmall = totalIncome > 0 ? 'of income spent' : 'no income';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(centerBig, dcx, dcy + 1.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text(centerSmall, dcx, dcy + 6.5, { align: 'center' });

  // Right side: verdict, then what each colour means
  const vx = M + 62;
  const vw = CW - 62 - 8;
  doc.setFillColor(...verdictColor);
  doc.roundedRect(vx, panelTop + 8, 2.5, 16, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(fit(verdict, vw - 6), vx + 6, panelTop + 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(fit(verdictSub, vw - 6), vx + 6, panelTop + 21.5);

  if (totalIncome > 0) {
    const legend = [
      [RED, 'Spent', inr(totalSpent), `${Math.round((totalSpent / totalIncome) * 100)}%`],
      saved >= 0
        ? [BLUE, 'Saved', inr(saved), `${Math.round((saved / totalIncome) * 100)}%`]
        : [AMBER, 'Over income by', inr(-saved), ''],
    ];
    legend.forEach(([color, label, value, pct], i) => {
      const ly2 = panelTop + 33 + i * 9;
      doc.setFillColor(...color);
      doc.circle(vx + 2, ly2 - 1.2, 1.7, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...GREY);
      doc.text(label, vx + 7, ly2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(value, vx + 50, ly2);
      doc.text(pct, vx + vw, ly2, { align: 'right' });
    });
  }

  // ---- Eight more simple numbers, two per row ----
  const gap = 5;
  const cw = (CW - gap) / 2;
  const ch = 26;
  const top = panelTop + panelH + 7;
  const topCat = labelRows[0];
  const cards = [
    ['Savings rate', savingsPct === null ? '-' : `${savingsPct.toFixed(0)}%`, 'good is 20% or more', savingsPct !== null && savingsPct >= 20 ? GREEN : NAVY],
    ['Spent per day', inr(avgPerDay), `over ${daysPassed} day${daysPassed === 1 ? '' : 's'} so far`, NAVY],
    ['Top spending', topCat ? topCat[0] : '-', topCat && totalSpent > 0 ? `${((topCat[1] / totalSpent) * 100).toFixed(0)}% of all spending` : '', NAVY],
    ['Biggest single expense', biggestTx ? inr(amt(biggestTx)) : '-', biggestTx ? fit(biggestTx.subCategory ? `${biggestTx.category} - ${biggestTx.subCategory}` : biggestTx.category, cw - 8) : 'none', RED],
    ['Costliest day', costliest.day ? inr(costliest.amount) : '-', costliest.day ? format(new Date(costliest.day), 'EEEE, dd MMM') : 'no spending', RED],
    ['No-spend days', `${noSpendDays} of ${daysPassed}`, 'days with zero spending', GREEN],
    ['Average expense', expenseTxs.length > 0 ? inr(totalSpent / expenseTxs.length) : '-', `across ${expenseTxs.length} expense${expenseTxs.length === 1 ? '' : 's'}`, NAVY],
    ['Entries recorded', String(txs.length), 'income + expenses', NAVY],
  ];
  cards.forEach(([label, value, sub, color], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    card(M + col * (cw + gap), top + row * (ch + gap), cw, ch, label, value, sub, color);
  });

  // =====================================================================
  // PAGE 2 - where the money went
  // =====================================================================
  newPage('Where Your Money Went', totalSpent > 0 ? `${inr(totalSpent)} spent in total` : 'No expenses recorded');

  if (labelRows.length === 0) {
    note('No expenses were recorded this month.', 46);
  } else {
    // One stacked bar for the four everyday groups
    const rawGroups = [
      ['Kitchen & food', foodTotal],
      ['Bills & family', billsTotal],
      ['Petrol / travel', petrolTotal],
      ['Everything else', otherTotal],
    ].filter(([, v]) => v > 0);
    // Costliest part is red, cheapest green, the rest in between
    const gMax = Math.max(...rawGroups.map(([, v]) => v));
    const gMin = Math.min(...rawGroups.map(([, v]) => v));
    const groups = rawGroups.map(([name, v]) => [name, v, heatFor(v, gMin, gMax)]);

    sectionLabel('Your spending in four parts', 40);
    let sx = M;
    groups.forEach(([, v, color]) => {
      const w = (v / totalSpent) * CW;
      doc.setFillColor(...color);
      doc.rect(sx, 46, w, 12, 'F');
      sx += w;
    });
    let ly = 68;
    groups.forEach(([name, v, color]) => {
      doc.setFillColor(...color);
      doc.roundedRect(M, ly - 3.5, 4.5, 4.5, 1, 1, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text(name, M + 8, ly);
      doc.setFont('helvetica', 'bold');
      doc.text(`${inr(v)}  (${((v / totalSpent) * 100).toFixed(0)}%)`, W - M, ly, { align: 'right' });
      ly += 8;
    });

    // Every item, biggest first
    const listTop = ly + 8;
    sectionLabel('Item by item', listTop);
    const rowH = 11.5;
    const maxRows = Math.floor((H - 22 - (listTop + 8)) / rowH);
    const shown = labelRows.slice(0, maxRows);
    const maxVal = shown[0][1];
    const minVal = shown[shown.length - 1][1];
    shown.forEach(([label, value], i) => {
      const y = listTop + 10 + i * rowH;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text(fit(label, 40), M, y);
      bar(M + 44, y - 4, CW - 44 - 52, 5, value, maxVal, heatFor(value, minVal, maxVal));
      doc.setFont('helvetica', 'bold');
      doc.text(`${inr(value)}  ${((value / totalSpent) * 100).toFixed(0)}%`, W - M, y, { align: 'right' });
    });
  }

  // =====================================================================
  // PAGE 3 - day by day calendar
  // =====================================================================
  newPage('Day by Day', 'Green = least spent, red = most spent');
  const minDaySpend = spendValues.length > 0 ? Math.min(...spendValues) : 0;

  const offset = getDay(monthStart); // Sunday = 0
  const weekCount = Math.ceil((offset + totalDays) / 7);
  const cellW = CW / 7;
  const cellH = 25;
  const gridTop = 50;
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(d, M + i * cellW + cellW / 2, gridTop - 5, { align: 'center' });
  });

  allDays.forEach((day, i) => {
    const slot = offset + i;
    const x = M + (slot % 7) * cellW;
    const y = gridTop + Math.floor(slot / 7) * cellH;
    const key = dayKey(day);
    const isFuture = !(key in dailySpend);
    const spend = dailySpend[key] || 0;

    // Cheapest day is green, costliest red, the rest a gradient in between.
    let fill = WHITE;
    let textColor = NAVY;
    if (isFuture) {
      textColor = [148, 163, 184];
    } else {
      fill = heatFor(spend, minDaySpend, maxDaySpend);
      if (maxDaySpend > minDaySpend && (spend - minDaySpend) / (maxDaySpend - minDaySpend) > 0.75) textColor = WHITE;
    }
    doc.setFillColor(...fill);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x + 0.8, y + 0.8, cellW - 1.6, cellH - 1.6, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...(isFuture ? textColor : mix(textColor, GREY, 0.3)));
    doc.text(String(day.getDate()), x + 3.5, y + 6.5);
    if (!isFuture) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...textColor);
      doc.text(spend === 0 ? '0' : short(spend), x + cellW / 2, y + cellH - 7, { align: 'center' });
    }
  });

  // Legend: a small gradient strip from cheapest to costliest
  const legendY = gridTop + weekCount * cellH + 8;
  const stripX = M + 24;
  const stripW = 70;
  const stripSteps = 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text('least spent', M, legendY);
  for (let s = 0; s < stripSteps; s++) {
    doc.setFillColor(...heat(s / (stripSteps - 1)));
    doc.rect(stripX + (stripW / stripSteps) * s, legendY - 3.5, stripW / stripSteps + 0.2, 5, 'F');
  }
  doc.text('most spent', stripX + stripW + 4, legendY);
  doc.text('(amounts in Rs.; k = thousand)', W - M, legendY, { align: 'right' });

  const factY = legendY + 14;
  const fw = (CW - gap * 2) / 3;
  card(M, factY, fw, 28, 'Costliest day', costliest.day ? inr(costliest.amount) : '-', costliest.day ? format(new Date(costliest.day), 'EEE, dd MMM') : '', RED);
  card(M + fw + gap, factY, fw, 28, 'Lightest spending day', cheapest.day ? inr(cheapest.amount) : '-', cheapest.day ? format(new Date(cheapest.day), 'EEE, dd MMM') : '', GREEN);
  card(M + (fw + gap) * 2, factY, fw, 28, 'No-spend days', String(noSpendDays), `out of ${daysPassed} days`, GREEN);

  // =====================================================================
  // PAGE 4 - weeks and weekdays
  // =====================================================================
  newPage('Your Spending Pace', isRunning ? `Based on the ${elapsed.length} days so far` : `Based on all ${totalDays} days`);

  // Pace cards
  const pw = (CW - gap) / 2;
  const canSpend = saved > 0 && daysLeft > 0 ? saved / daysLeft : 0;
  card(M, 34, pw, 28, 'Spending per day', inr(avgPerDay), `over ${daysPassed} days`);
  if (isRunning) {
    const over = totalIncome > 0 && projectedSpend > totalIncome;
    card(M + pw + gap, 34, pw, 28, 'Likely month-end spend', inr(projectedSpend), over ? 'more than your income!' : 'if this pace continues', over ? RED : NAVY);
    card(M, 67, pw, 28, 'Safe to spend per day', saved > 0 ? inr(canSpend) : 'Rs. 0', saved > 0 ? `for the next ${daysLeft} days` : 'income already used', saved > 0 ? GREEN : RED);
    card(M + pw + gap, 67, pw, 28, 'Days left', String(daysLeft), `of ${totalDays} days`);
  } else {
    card(M + pw + gap, 34, pw, 28, 'Spent in total', inr(totalSpent), `${totalDays} days`, RED);
  }

  // Weeks
  const weeks = {};
  elapsed.forEach(d => {
    const w = Math.ceil(d.getDate() / 7);
    if (!weeks[w]) weeks[w] = { spent: 0, from: d.getDate(), to: d.getDate() };
    weeks[w].to = d.getDate();
    weeks[w].spent += dailySpend[dayKey(d)] || 0;
  });
  const weekRows = Object.entries(weeks);
  const weekTop = isRunning ? 110 : 80;
  sectionLabel('Week by week', weekTop);
  const maxWeek = Math.max(0, ...weekRows.map(([, w]) => w.spent));
  const minWeek = weekRows.length > 0 ? Math.min(...weekRows.map(([, w]) => w.spent)) : 0;
  weekRows.forEach(([n, w], i) => {
    const y = weekTop + 11 + i * 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(`Week ${n}  (${w.from}-${w.to})`, M, y);
    bar(M + 46, y - 4, CW - 46 - 36, 5, w.spent, maxWeek, heatFor(w.spent, minWeek, maxWeek));
    doc.setFont('helvetica', 'bold');
    doc.text(inr(w.spent), W - M, y, { align: 'right' });
  });

  // Weekdays: average spend on each weekday
  const wdTop = weekTop + 11 + weekRows.length * 11 + 14;
  sectionLabel('Which weekday costs the most? (average)', wdTop);
  const wdNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wdSum = [0, 0, 0, 0, 0, 0, 0];
  const wdCnt = [0, 0, 0, 0, 0, 0, 0];
  elapsed.forEach(d => {
    const w = getDay(d);
    wdSum[w] += dailySpend[dayKey(d)] || 0;
    wdCnt[w] += 1;
  });
  const wdAvg = wdSum.map((s, i) => (wdCnt[i] > 0 ? s / wdCnt[i] : 0));
  const maxWd = Math.max(0, ...wdAvg);
  const minWd = Math.min(...wdAvg);
  wdNames.forEach((name, i) => {
    const y = wdTop + 11 + i * 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(name, M, y);
    bar(M + 30, y - 4, CW - 30 - 36, 5, wdAvg[i], maxWd, heatFor(wdAvg[i], minWd, maxWd));
    doc.setFont('helvetica', 'bold');
    doc.text(inr(wdAvg[i]), W - M, y, { align: 'right' });
  });

  // =====================================================================
  // PAGE 5 - compared with last month (only when we have last month)
  // =====================================================================
  const prevStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const prevEnd = endOfMonth(prevStart);
  const prevTxs = inRange(previousTransactions || [], prevStart, prevEnd);
  if (prevTxs.length > 0) {
    // For a running month compare like-for-like: the same number of days.
    const prevSpan = isRunning ? prevTxs.filter(t => new Date(t.date).getDate() <= elapsed.length) : prevTxs;
    const prevExpenses = prevSpan.filter(t => !isIncome(t));
    const prevSpent = sumAmount(prevExpenses);
    const prevIncome = sumAmount(prevTxs.filter(isIncome));
    const prevSaved = prevIncome - prevSpent;
    const prevName = format(prevStart, 'MMMM');

    newPage('Compared with Last Month',
      isRunning ? `Spending compared for the first ${elapsed.length} days of each month` : `${prevName} vs ${format(monthDate, 'MMMM')}`);

    // Verdict
    const diff = totalSpent - prevSpent;
    let cmp;
    let cmpColor;
    if (Math.abs(diff) < 1) {
      cmp = 'Your spending is the same as last month.';
      cmpColor = GREY;
    } else if (diff > 0) {
      cmp = `You spent ${inr(diff)} MORE than last month.`;
      cmpColor = RED;
    } else {
      cmp = `You spent ${inr(-diff)} LESS than last month. Well done!`;
      cmpColor = GREEN;
    }
    doc.setFillColor(...cmpColor);
    doc.roundedRect(M, 34, CW, 13, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(fit(cmp, CW - 12), M + 6, 42.5);

    // Side-by-side bars
    const pairs = [
      // Spending up = red, spending down = green
      ['Spent', prevSpent, totalSpent, totalSpent > prevSpent ? RED : GREEN],
      ['Earned', prevIncome, totalIncome, BLUE],
      ['Saved', prevSaved, saved, BLUE],
    ];
    const maxPair = Math.max(1, ...pairs.flatMap(([, a, b]) => [Math.abs(a), Math.abs(b)]));
    let py = 62;
    pairs.forEach(([label, before, now, color]) => {
      sectionLabel(label, py);
      const bw = CW - 52;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...GREY);
      doc.text(prevName, M, py + 9);
      // A negative amount (overspent) still gets a visible bar, drawn in red
      bar(M + 22, py + 5.5, bw - 22, 5, Math.abs(before), maxPair, before < 0 ? RED : [148, 163, 184]);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(inr(before), W - M, py + 9, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GREY);
      doc.text('This month', M, py + 18);
      bar(M + 22, py + 14.5, bw - 22, 5, Math.abs(now), maxPair, now < 0 ? RED : color);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(inr(now), W - M, py + 18, { align: 'right' });
      py += 34;
    });

    // What changed the most
    const prevByLabel = {};
    prevExpenses.forEach(t => {
      const k = expenseLabel(t);
      prevByLabel[k] = (prevByLabel[k] || 0) + amt(t);
    });
    const keys = Array.from(new Set([...Object.keys(byLabel), ...Object.keys(prevByLabel)]));
    const changes = keys
      .map(k => ({ k, d: (byLabel[k] || 0) - (prevByLabel[k] || 0) }))
      .filter(c => Math.abs(c.d) >= 1)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .slice(0, 5);
    if (changes.length > 0 && py < H - 70) {
      sectionLabel('What changed the most', py + 2);
      changes.forEach((c, i) => {
        const y = py + 14 + i * 9;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...NAVY);
        doc.text(fit(c.k, 70), M, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...(c.d > 0 ? RED : GREEN));
        doc.text(`${inr(Math.abs(c.d))} ${c.d > 0 ? 'more' : 'less'}`, W - M, y, { align: 'right' });
      });
    }
  }

  // =====================================================================
  // PAGES 6-8 - the last 12 months
  // =====================================================================
  const monthSlots = [];
  for (let i = 11; i >= 0; i--) {
    const s = new Date(monthStart.getFullYear(), monthStart.getMonth() - i, 1);
    monthSlots.push({ start: s, end: endOfMonth(s), income: 0, spent: 0, items: {}, count: 0, isCurrent: i === 0 });
  }
  // The selected month always comes from `txs`; earlier months from history.
  const yearTxs = [
    ...(previousTransactions || []).filter(t => {
      const d = new Date(t.date);
      return d < monthStart || d > monthEnd;
    }),
    ...txs,
  ];
  yearTxs.forEach(t => {
    const d = new Date(t.date);
    const slot = monthSlots.find(s => d >= s.start && d <= s.end);
    if (!slot) return;
    slot.count += 1;
    if (isIncome(t)) {
      slot.income += amt(t);
    } else {
      slot.spent += amt(t);
      const k = expenseLabel(t);
      slot.items[k] = (slot.items[k] || 0) + amt(t);
    }
  });
  const activeSlots = monthSlots.filter(s => s.count > 0);

  if (activeSlots.length >= 2) {
    // A month that is still running always looks cheap, so it is left out of
    // "costliest / cheapest month" and of the averages.
    const finished = activeSlots.filter(s => !(s.isCurrent && isRunning));
    const ranked = finished.length > 0 ? finished : activeSlots;
    const monthLabel = (s) => format(s.start, 'MMM yy');
    const avgMonthSpend = ranked.reduce((sum, s) => sum + s.spent, 0) / ranked.length;
    const avgMonthIncome = ranked.reduce((sum, s) => sum + s.income, 0) / ranked.length;
    const dearest = ranked.reduce((m, s) => (s.spent > m.spent ? s : m), ranked[0]);
    const cheapestMonth = ranked.reduce((m, s) => (s.spent < m.spent ? s : m), ranked[0]);

    const monthAxis = (x0, slotW, y) => {
      monthSlots.forEach((s, i) => {
        doc.setFont('helvetica', s.isCurrent ? 'bold' : 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...(s.isCurrent ? NAVY : GREY));
        doc.text(format(s.start, 'MMM'), x0 + i * slotW + slotW / 2, y, { align: 'center' });
        if (s.start.getMonth() === 0 || i === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(...GREY);
          doc.text(format(s.start, "''yy"), x0 + i * slotW + slotW / 2, y + 4, { align: 'center' });
        }
      });
    };

    // ----- PAGE 6: earned vs spent -----
    newPage('The Last 12 Months', 'Money earned and money spent, month by month');
    const cX = M + 11;
    const cWid = CW - 11;
    const cTop = 44;
    const cH = 92;
    const base = cTop + cH;
    // Bars always start from zero so their heights can be compared honestly.
    const plotted = activeSlots.flatMap(s => [s.income, s.spent]);
    const rawMax = Math.max(1, ...plotted);
    const niceStep = rawMax >= 100000 ? 10000 : rawMax >= 10000 ? 1000 : 100;
    const axisMax = Math.ceil((rawMax * 1.1) / niceStep) * niceStep;
    const axisMin = 0;
    const axisSpan = Math.max(axisMax - axisMin, 1);
    const gw = cWid / 12;

    // Soft band behind the month this report is about
    const curIdx = monthSlots.findIndex(s => s.isCurrent);
    if (curIdx >= 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(cX + curIdx * gw, base - cH - 4, gw, cH + 4, 'F');
    }

    // Faint dotted guides: five horizontal levels and one per month
    doc.setLineCap('round');
    doc.setLineWidth(0.2);
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([0.01, 1.6], 0);
    for (let m = 0; m < 12; m++) {
      doc.line(cX + m * gw + gw / 2, base - cH - 4, cX + m * gw + gw / 2, base);
    }
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      const gy = base - cH * f;
      doc.line(cX, gy, W - M, gy);
    });
    doc.setLineDashPattern([], 0);
    doc.setLineCap('butt');
    [0, 0.5, 1].forEach(f => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GREY);
      doc.text(short(axisMin + axisSpan * f), cX - 2, base - cH * f + 1.2, { align: 'right' });
    });
    // Double bars, two colours: blue = money earned, red = money spent.
    const barW = gw * 0.34;
    const barGap = 0.7;
    monthSlots.forEach((s, i) => {
      if (s.count === 0) return;
      const left = cX + i * gw + (gw - (barW * 2 + barGap)) / 2;
      const hI = (s.income / axisSpan) * cH;
      const hS = (s.spent / axisSpan) * cH;
      if (hI > 0) {
        doc.setFillColor(...BLUE);
        doc.rect(left, base - hI, barW, hI, 'F');
      }
      if (hS > 0) {
        doc.setFillColor(...RED);
        doc.rect(left + barW + barGap, base - hS, barW, hS, 'F');
      }
      // Value on top of each bar
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(...BLUE);
      doc.text(short(s.income), left + barW / 2, base - hI - 1.3, { align: 'center' });
      doc.setTextColor(...RED);
      doc.text(short(s.spent), left + barW + barGap + barW / 2, base - hS - 1.3, { align: 'center' });
    });
    // Solid baseline
    doc.setDrawColor(...GREY);
    doc.setLineWidth(0.4);
    doc.line(cX, base, W - M, base);
    monthAxis(cX, gw, base + 6);

    // What was left each month, right under the bars it belongs to
    const stripY = base + 21;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text('Saved', M, stripY);
    doc.text('% of pay', M, stripY + 6);
    const savedVals = activeSlots.map(s => s.income - s.spent);
    monthSlots.forEach((s, i) => {
      if (s.count === 0) return;
      const v = s.income - s.spent;
      const cx = cX + i * gw + gw / 2;
      // Blue when money was left over, red when the month was overspent
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...(v < 0 ? RED : BLUE));
      doc.text(`${v < 0 ? '-' : ''}${short(Math.abs(v))}`, cx, stripY, { align: 'center' });
      if (s.income > 0) {
        const pct = (v / s.income) * 100;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...GREY);
        doc.text(`${pct.toFixed(0)}%`, cx, stripY + 6, { align: 'center' });
      }
    });

    // Legend
    const lgY = base + 42;
    // Legend swatches match the bars
    doc.setFillColor(...BLUE);
    doc.rect(M, lgY - 3.5, 5, 5, 'F');
    doc.setFillColor(...RED);
    doc.rect(M + 42, lgY - 3.5, 5, 5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('Money earned', M + 8, lgY);
    doc.text('Money spent', M + 50, lgY);
    if (isRunning) {
      doc.setTextColor(...GREY);
      doc.text(`${format(monthDate, 'MMM')} is still running`, W - M, lgY, { align: 'right' });
    }

    // Row 1: the three totals for the whole period shown above
    const tw = (CW - gap * 2) / 3;
    const cy = lgY + 10;
    const yearIncome = activeSlots.reduce((sum, s) => sum + s.income, 0);
    const yearSpent = activeSlots.reduce((sum, s) => sum + s.spent, 0);
    const yearSaved = savedVals.reduce((a, b) => a + b, 0);
    const monthsNote = `over ${activeSlots.length} month${activeSlots.length === 1 ? '' : 's'}`;
    card(M, cy, tw, 32, 'Total income', inr(yearIncome), monthsNote, BLUE);
    card(M + tw + gap, cy, tw, 32, 'Total expenditure', inr(yearSpent), monthsNote, RED);
    card(M + (tw + gap) * 2, cy, tw, 32,
      yearSaved >= 0 ? 'Total savings' : 'Total overspent',
      inr(Math.abs(yearSaved)),
      yearIncome > 0 ? `${((yearSaved / yearIncome) * 100).toFixed(0)}% of income` : monthsNote,
      yearSaved >= 0 ? BLUE : RED);

    // Row 2: what a typical month looks like
    const cy2 = cy + 32 + gap;
    card(M, cy2, tw, 30, 'Average spent a month', inr(avgMonthSpend), `earned ${inr(avgMonthIncome)} on average`);
    if (ranked.length >= 2) {
      card(M + tw + gap, cy2, tw, 30, 'Costliest month', inr(dearest.spent), monthLabel(dearest));
      card(M + (tw + gap) * 2, cy2, tw, 30, 'Cheapest month', inr(cheapestMonth.spent), monthLabel(cheapestMonth));
    } else {
      // Only one finished month so far - nothing to rank yet.
      card(M + tw + gap, cy2, tw, 30, 'Spent in the month so far', inr(totalSpent), format(monthDate, 'MMM yy'));
      card(M + (tw + gap) * 2, cy2, tw, 30, 'Months to compare', String(ranked.length), 'more months = better picture');
    }
  }

  // =====================================================================
  // PAGE 8+ - every entry
  // =====================================================================
  if (txs.length > 0) {
    newPage('All Entries', `${txs.length} entr${txs.length === 1 ? 'y' : 'ies'} in date order`);
    const ledgerFirstPage = doc.internal.getNumberOfPages();
    const sorted = [...txs].sort((a, b) => new Date(a.date) - new Date(b.date));
    autoTable(doc, {
      startY: 34,
      head: [['Date', 'Category', 'Note', 'Amount']],
      body: sorted.map(t => [
        format(new Date(t.date), 'dd MMM'),
        t.subCategory ? `${t.category} - ${t.subCategory}` : (t.category || 'Others'),
        t.description || '',
        { content: `${isIncome(t) ? '+' : '-'} ${inr(amt(t))}`, income: isIncome(t) },
      ]),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: NAVY, overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
      },
      margin: { left: M, right: M, top: 30 },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3) {
          d.cell.styles.textColor = d.cell.raw && d.cell.raw.income ? GREEN : NAVY;
        }
      },
      // Continuation pages keep the same header band as every other page
      didDrawPage: () => {
        if (doc.internal.getCurrentPageInfo().pageNumber !== ledgerFirstPage) {
          header('All Entries', 'continued');
        }
      },
    });
  }

  // ---------- totals and simple stats right after the list ----------
  if (txs.length > 0 && doc.lastAutoTable) {
    let ty = doc.lastAutoTable.finalY + 12;
    if (ty > H - 95) {
      newPage('Totals', 'Everything added up');
      ty = 38;
    }
    sectionLabel('Totals for the month', ty);
    autoTable(doc, {
      startY: ty + 5,
      body: [
        ['Total money earned', inr(totalIncome)],
        ['Total money spent', inr(totalSpent)],
        [saved >= 0 ? 'Money saved' : 'Overspent by', inr(Math.abs(saved))],
        ['Savings rate', savingsPct === null ? '-' : `${savingsPct.toFixed(0)}% of income`],
        ['Spent per day', `${inr(avgPerDay)}  (over ${daysPassed} days)`],
        ['Number of entries', `${txs.length}  (${incomeTxs.length} income, ${expenseTxs.length} expenses)`],
        ['Average expense', expenseTxs.length > 0 ? inr(totalSpent / expenseTxs.length) : '-'],
        ['Costliest day', costliest.day ? `${inr(costliest.amount)}  (${format(new Date(costliest.day), 'dd MMM')})` : '-'],
        ['No-spend days', `${noSpendDays} of ${daysPassed}`],
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3.5, textColor: NAVY, lineColor: LINE },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: SOFT, cellWidth: 70 },
        1: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: M, right: M },
    });
  }

  // =====================================================================
  // SECOND-LAST PAGE - what to do next
  // =====================================================================
  newPage('What To Do Next', 'Your action plan, built from this month');

  // ---- Goal banner: the one target for next month ----
  const target20 = totalIncome * 0.2;
  // A finished month sets the bar at what was already saved (if that beat 20%);
  // a running month has only partial savings, so it just uses the 20% rule.
  const goalSave = totalIncome > 0
    ? (isRunning ? target20 : Math.max(target20, Math.min(saved, totalIncome)))
    : 0;
  const dailyLimit = totalIncome > 0 ? Math.max(totalIncome - goalSave, 0) / totalDays : 0;
  const bannerTop = 34;
  const bannerH = 30;
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, bannerTop, CW, bannerH, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(147, 197, 253);
  doc.text('YOUR GOAL FOR NEXT MONTH', M + 8, bannerTop + 9);
  if (totalIncome > 0) {
    doc.setFontSize(17);
    doc.setTextColor(...WHITE);
    doc.text(`Save ${inr(goalSave)}`, M + 8, bannerTop + 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`${((goalSave / totalIncome) * 100).toFixed(0)}% of your income`, M + 8, bannerTop + 27);
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.4);
    doc.line(W / 2 + 10, bannerTop + 6, W / 2 + 10, bannerTop + bannerH - 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(147, 197, 253);
    doc.text('SO SPEND AT MOST', W / 2 + 18, bannerTop + 9);
    doc.setFontSize(17);
    doc.setTextColor(...WHITE);
    doc.text(`${inr(dailyLimit)} a day`, W / 2 + 18, bannerTop + 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`about ${inr(dailyLimit * 7)} a week`, W / 2 + 18, bannerTop + 27);
  } else {
    doc.setFontSize(14);
    doc.setTextColor(...WHITE);
    doc.text('Add your income to get a savings goal', M + 8, bannerTop + 21);
  }

  // ---- The steps, most important first ----
  // Each step: tag (when), title, why (with numbers), how (one concrete action)
  // and one figure to remember.
  const FLEXIBLE = [...FOOD, 'Petrol', 'Others'];
  const HOW_TO = {
    Petrol: 'Combine trips, check tyres and share rides.',
    Others: 'Note each "other" spend for a week; drop extras.',
  };
  const steps = [];

  if (isRunning && totalIncome > 0 && projectedSpend > totalIncome) {
    steps.push({
      kind: 'alert', tag: 'URGENT',
      title: 'Slow down for the rest of this month',
      why: `At this pace you will spend ${inr(projectedSpend)} against ${inr(totalIncome)} earned.`,
      how: saved > 0 ? `Keep each day under ${inr(canSpend)}.` : 'Spend only on essentials until month end.',
      figure: inr(projectedSpend - totalIncome), unit: 'over income at this pace',
    });
  } else if (isRunning && saved > 0) {
    steps.push({
      kind: 'good', tag: 'THIS MONTH',
      title: 'Stay inside your safe daily amount',
      why: `${daysLeft} days are left and ${inr(saved)} is still unspent.`,
      how: 'Check this number every morning before you spend.',
      figure: inr(canSpend), unit: 'safe to spend per day',
    });
  }

  if (!isRunning && saved < 0) {
    steps.push({
      kind: 'alert', tag: 'FIRST PRIORITY',
      title: 'Close the gap between earning and spending',
      why: `You spent ${inr(-saved)} more than you earned this month.`,
      how: 'Cut one flexible item 20% and add a no-spend day.',
      figure: inr(-saved), unit: 'to make up next month',
    });
  }

  const flexible = labelRows.find(([name]) => FLEXIBLE.includes(name));
  if (flexible && totalSpent > 0) {
    const [name, val] = flexible;
    steps.push({
      kind: 'watch', tag: 'BIGGEST SAVER',
      title: `Trim ${name} by 10%`,
      why: `${name} cost ${inr(val)} - ${((val / totalSpent) * 100).toFixed(0)}% of spending and the biggest cost you control.`,
      how: HOW_TO[name] || 'Plan the week, buy in bulk, skip impulse buys.',
      figure: inr(val * 0.1 * 12), unit: 'saved in a year',
    });
  }

  if (elapsed.length >= 14) {
    const topWd = wdAvg.indexOf(Math.max(...wdAvg));
    const others = wdAvg.filter((_, i) => i !== topWd);
    const othersAvg = others.reduce((a, b) => a + b, 0) / others.length;
    if (wdAvg[topWd] > 0 && wdAvg[topWd] >= othersAvg * 1.5) {
      steps.push({
        kind: 'watch', tag: 'WATCH OUT',
        title: `Plan ahead for ${wdNames[topWd]}s`,
        why: `You spend about ${inr(wdAvg[topWd])} on ${wdNames[topWd]}s against ${inr(othersAvg)} on other days.`,
        how: `Fix a limit for ${wdNames[topWd]} each morning.`,
        figure: inr(wdAvg[topWd] - othersAvg), unit: `extra every ${wdNames[topWd]}`,
      });
    }
  }

  if (totalIncome > 0 && billsTotal / totalIncome >= 0.4) {
    steps.push({
      kind: 'watch', tag: 'BILLS',
      title: 'Your bills take a big share',
      why: `Bills and family costs used ${((billsTotal / totalIncome) * 100).toFixed(0)}% of income. Above 40% makes saving hard.`,
      how: 'List every bill; cut, share or renegotiate.',
      figure: `${((billsTotal / totalIncome) * 100).toFixed(0)}%`, unit: 'of income on bills',
    });
  }

  if (totalSpent > 0) {
    const monthlySpend = isRunning ? projectedSpend : totalSpent;
    const cushion = monthlySpend * 3;
    const monthsToBuild = saved > 0 ? Math.ceil(cushion / saved) : null;
    steps.push({
      kind: 'info', tag: 'SAFETY NET',
      title: 'Build a 3-month safety cushion',
      why: monthsToBuild
        ? `Three months of spending is ${inr(cushion)}. Saving like this month, you reach it in about ${monthsToBuild} months.`
        : `Three months of spending is ${inr(cushion)}. Start by saving even a small amount every month.`,
      how: 'Move money to a separate account on income day.',
      figure: inr(cushion), unit: 'cushion to aim for',
    });
  }

  if (daysPassed >= 14 && noSpendDays < 4) {
    steps.push({
      kind: 'good', tag: 'HABIT',
      title: 'Add one no-spend day every week',
      why: `You had ${noSpendDays} no-spend day${noSpendDays === 1 ? '' : 's'} so far. Each one keeps a full day's spending in your pocket.`,
      how: 'Pick a fixed day, carry lunch, skip small buys.',
      figure: inr(avgPerDay * 4), unit: 'saved by 4 such days',
    });
  }

  if (steps.length === 0) {
    steps.push({
      kind: 'info', tag: 'START HERE',
      title: 'Record every expense',
      why: 'The more you record, the more useful this report becomes.',
      how: 'Add each spend the same day so nothing is forgotten.',
      figure: String(txs.length), unit: 'entries so far',
    });
  }

  const KIND_COLOR = { good: GREEN, watch: AMBER, alert: RED, info: BLUE };
  const stepH = 38;
  const stepGap = 4.5;
  const stepsTop = bannerTop + bannerH + 7;
  const figW = 46;
  steps.slice(0, 5).forEach((s, i) => {
    const y = stepsTop + i * (stepH + stepGap);
    const color = KIND_COLOR[s.kind] || BLUE;

    doc.setFillColor(...SOFT);
    doc.roundedRect(M, y, CW, stepH, 3, 3, 'F');
    doc.setFillColor(...color);
    doc.roundedRect(M, y, 3.5, stepH, 1.5, 1.5, 'F');

    // Step number
    doc.setFillColor(...color);
    doc.circle(M + 14, y + 12.5, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...WHITE);
    doc.text(String(i + 1), M + 14, y + 14.3, { align: 'center' });

    // Tag chip
    const textX = M + 25;
    const textW = CW - 25 - figW - 10;
    doc.setFontSize(6.5);
    const tagW = doc.getTextWidth(s.tag) + 6;
    doc.setFillColor(...color);
    doc.roundedRect(textX, y + 4, tagW, 5, 2.5, 2.5, 'F');
    doc.setTextColor(...WHITE);
    doc.text(s.tag, textX + tagW / 2, y + 7.6, { align: 'center' });

    // Title, why, how
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(fit(s.title, textW), textX, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(...GREY);
    doc.text(doc.splitTextToSize(s.why, textW).slice(0, 2), textX, y + 21.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(fit(`Do: ${s.how}`, textW), textX, y + 33.5);

    // The one number to remember
    const fx = W - M - figW - 4;
    doc.setFillColor(...WHITE);
    doc.roundedRect(fx, y + 6, figW, stepH - 12, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(fit(s.figure, figW - 6), fx + figW / 2, y + 18.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(doc.splitTextToSize(s.unit, figW - 6).slice(0, 2), fx + figW / 2, y + 24, { align: 'center' });
  });

  // =====================================================================
  // LAST PAGE - for the common man
  // =====================================================================
  doc.addPage();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(...BLUE);
  doc.rect(W / 2 - 25, 52, 50, 2.5, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text('FOR THE', W / 2, 78, { align: 'center' });
  doc.setFontSize(38);
  doc.text('COMMON MAN', W / 2, 98, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(203, 213, 225);
  doc.text(doc.splitTextToSize(
    'Every rupee earned with honest effort, every rupee counted with care. A household runs on small decisions made every day - and this report is here to make them easier.',
    CW - 20), W / 2, 118, { align: 'center' });

  // This month in three numbers
  const lw = (CW - 10) / 3;
  const ly3 = 150;
  [
    ['Earned', inr(totalIncome), [134, 239, 172]],
    ['Spent', inr(totalSpent), [252, 165, 165]],
    [saved >= 0 ? 'Saved' : 'Overspent', inr(Math.abs(saved)), [147, 197, 253]],
  ].forEach(([label, value, color], i) => {
    const x = M + i * (lw + 5);
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(x, ly3, lw, 30, 3, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(label, x + lw / 2, ly3 + 10, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(fit(value, lw - 6), x + lw / 2, ly3 + 22, { align: 'center' });
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225);
  doc.text(monthName, W / 2, 205, { align: 'center' });

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 30, 232, W / 2 + 30, 232);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.text('Made with care by', W / 2, 244, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text('Revanthvenkat Pasupuleti', W / 2, 256, { align: 'center' });

  // ---------- footer on every page ----------
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.4);
    doc.line(M, H - 12, W - M, H - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(`${monthName} - Monthly Money Report`, M, H - 7);
    doc.text(`Page ${i} of ${pageCount}`, W - M, H - 7, { align: 'right' });
  }

  return doc;
};

export const generateInsights = (transactions) => {
  const doc = new jsPDF();
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const monthlyTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= monthStart && transactionDate <= monthEnd;
  });

  const expenses = monthlyTransactions.filter(t => t.type === 'expense');

  // Calculate category-wise expenses
  const categoryTotals = expenses.reduce((acc, t) => {
    const categoryKey = t.subCategory ? `${t.category} - ${t.subCategory}` : t.category;
    acc[categoryKey] = (acc[categoryKey] || 0) + Number(t.amount);
    return acc;
  }, {});

  const totalExpense = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  // Add title
  doc.setFontSize(20);
  doc.text('Comprehensive Financial Insights Report', 20, 20);
  doc.setFontSize(12);
  doc.text(`Period: ${format(monthStart, 'MMMM yyyy')}`, 20, 30);

  // Add expense distribution
  doc.setFontSize(16);
  doc.text('Detailed Expense Distribution', 20, 45);
  doc.setFontSize(12);

  let yPos = 55;
  Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, total]) => {
      const percentage = ((total / totalExpense) * 100).toFixed(1);
      doc.text(`${category}: ${total.toFixed(2)} (${percentage}%)`, 20, yPos);
      yPos += 10;
    });

  return doc;
};
