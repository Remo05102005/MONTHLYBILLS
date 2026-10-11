import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import {
  buildMonthly,
  summarizeMeasurements,
  summarizeNotes,
  buildBadges,
  MOODS,
} from './weightAnalytics';
import { summarizeDaily, bodyComposition, detectPlateau } from './weightCoach';

const NAVY = [15, 23, 42];
const BLUE = [59, 130, 246];
const ROW = [248, 250, 252];

const kg = (n, signed = false) => {
  if (n == null || Number.isNaN(n)) return '--';
  const s = Math.abs(n).toFixed(1);
  if (!signed) return `${s} kg`;
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${s} kg`;
};

/**
 * Weight-loss journey report.
 * @param {object} p
 *  weights      entries { date: Date, weight, note?, mood?, tags? } (any order)
 *  journey      result of computeJourney (may be null)
 *  measurements array from subscribeToMeasurements
 *  height       cm
 *  idealRange   { min, max } healthy weight range in kg
 *  chartEl      DOM node of the trend chart to embed (optional)
 */
export const generateWeightReport = async ({
  weights = [],
  journey = null,
  measurements = [],
  daily = {},
  height = null,
  gender = 'male',
  idealRange = null,
  selectedDays = 30,
  chartEl = null,
}) => {
  const valid = weights.filter((w) => w.weight && !Number.isNaN(w.weight));
  if (valid.length === 0) throw new Error('No weight data available');
  const asc = [...valid].sort((a, b) => a.date - b.date);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  const ensure = (need) => {
    if (y + need > pageH - 18) {
      doc.addPage();
      y = 18;
    }
  };

  const section = (title) => {
    ensure(24);
    doc.setFillColor(...BLUE);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, margin + 4, y + 5.6);
    doc.setTextColor(...NAVY);
    y += 12;
  };

  const table = (head, body, opts = {}) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      theme: 'grid',
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 10, fontStyle: 'bold' },
      styles: { fontSize: 9.5, cellPadding: 3, textColor: NAVY },
      alternateRowStyles: { fillColor: ROW },
      margin: { left: margin, right: margin },
      ...opts,
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  const bullets = (lines) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(`• ${line}`, contentW);
      ensure(wrapped.length * 5.5 + 2);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5.5 + 1.5;
    });
    y += 4;
  };

  // ---- Header band ----
  const latest = asc[asc.length - 1];
  const first = asc[0];
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Weight Loss Journey Report', margin, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `${format(first.date, 'd MMM yyyy')}  to  ${format(latest.date, 'd MMM yyyy')}   |   Generated ${format(new Date(), 'd MMM yyyy')}`,
    margin,
    24,
  );
  y = 44;

  // ---- Journey summary ----
  section('JOURNEY SUMMARY');
  const startW = journey ? journey.startWeight : first.weight;
  const current = latest.weight;
  const target = journey?.target ?? null;
  const bmi = height ? current / ((height / 100) ** 2) : null;
  const rows = [
    ['Starting weight', kg(startW)],
    ['Current weight', kg(current)],
    ['Total change', kg(current - startW, true)],
  ];
  if (target != null) {
    rows.push(['Goal weight', kg(target)]);
    rows.push(['Still to go', kg(journey.remaining)]);
    rows.push(['Progress', journey.progressPct != null ? `${journey.progressPct.toFixed(0)}%` : '--']);
  }
  if (journey) {
    rows.push(['Weekly pace (last 4 weeks)', journey.weeklyRate == null ? '--' : `${journey.weeklyRate > 0 ? '+' : ''}${journey.weeklyRate.toFixed(2)} kg/week`]);
    let eta = '--';
    if (journey.etaState === 'reached') eta = 'Goal reached';
    else if (journey.etaState === 'date') eta = format(journey.etaDate, 'd MMM yyyy');
    else if (journey.etaState === 'wrong-way') eta = 'Trend is moving away from goal';
    else if (journey.etaState === 'no-pace') eta = 'Need more data';
    rows.push(['Projected finish', eta]);
    if (journey.goalDate) rows.push(['Goal date', format(journey.goalDate, 'd MMM yyyy')]);
    rows.push(['Logging streak', `${journey.streak} days (best ${journey.bestStreak})`]);
    rows.push(['Days logged in last 30', `${journey.logged30}/30`]);
  }
  rows.push(['Lowest / highest', `${kg(Math.min(...asc.map((w) => w.weight)))} / ${kg(Math.max(...asc.map((w) => w.weight)))}`]);
  if (bmi) rows.push(['BMI', `${bmi.toFixed(1)}${idealRange ? `   (healthy range ${idealRange.min.toFixed(1)}-${idealRange.max.toFixed(1)} kg)` : ''}`]);
  table(['Metric', 'Value'], rows, {
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold', textColor: BLUE } },
  });

  // ---- Chart ----
  if (chartEl) {
    try {
      const canvas = await html2canvas(chartEl, { backgroundColor: '#ffffff', scale: 1.5, useCORS: true });
      const ratio = canvas.height / canvas.width;
      const h = Math.min(75, contentW * ratio);
      section(`WEIGHT vs 7-DAY TREND (last ${selectedDays} days)`);
      ensure(h + 4);
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, contentW, h);
      y += h + 8;
    } catch (e) {
      console.warn('Could not capture chart for report:', e);
    }
  }

  // ---- Monthly ----
  const monthly = buildMonthly(asc);
  if (monthly.length > 0) {
    section('MONTH BY MONTH');
    table(
      ['Month', 'Start', 'End', 'Change', 'Average', 'Logs'],
      monthly.slice(0, 12).map((m) => [m.label, kg(m.first), kg(m.last), kg(m.change, true), kg(m.avg), String(m.count)]),
      { columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' }, 4: { halign: 'right' }, 5: { halign: 'center' } } },
    );
  }

  // ---- Weekly ----
  if (journey && journey.weekly.length > 0) {
    section('WEEKLY AVERAGES (last 8 weeks)');
    table(
      ['Week of', 'Average', 'vs previous', 'Logs'],
      journey.weekly.map((w) => [
        format(w.start, 'd MMM yyyy'),
        kg(w.avg),
        w.change == null ? '--' : kg(w.change, true),
        `${w.count}/7`,
      ]),
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'center' } } },
    );
  }

  // ---- Milestones & insights ----
  if (journey && journey.milestones.length > 0) {
    section('MILESTONES');
    table(
      ['Milestone', 'Weight', 'Reached'],
      journey.milestones.map((m) => [
        m.isGoal ? 'Goal' : `${m.kg} kg lost`,
        kg(m.level),
        m.reachedOn ? format(m.reachedOn, 'd MMM yyyy') : 'Pending',
      ]),
      { columnStyles: { 1: { halign: 'right' } } },
    );
  }

  const insights = journey ? journey.insights.map((i) => i.text) : [];
  const badges = buildBadges(journey, measurements).filter((b) => b.earned);
  if (insights.length > 0) {
    section('INSIGHTS');
    bullets(insights);
  }
  if (badges.length > 0) {
    section('BADGES EARNED');
    bullets([badges.map((b) => b.title).join(', ')]);
  }

  // ---- Measurements ----
  const meas = summarizeMeasurements(measurements);
  if (meas.length > 0) {
    section('BODY MEASUREMENTS (cm)');
    table(
      ['Area', 'First', 'Latest', 'Change'],
      meas.map((m) => [m.label, String(m.first), String(m.latest), `${m.change > 0 ? '+' : ''}${m.change}`]),
      { columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } } },
    );
  }

  // ---- Habits & body composition ----
  const d7 = summarizeDaily(daily, 7);
  const d30 = summarizeDaily(daily, 30);
  if (d30.loggedDays > 0) {
    section('DAILY HABITS (averages)');
    table(
      ['Habit', 'Last 7 days', 'Last 30 days', 'Goal'],
      [
        ['Water (glasses)', String(d7.water ?? '--'), String(d30.water ?? '--'), '8'],
        ['Steps', String(d7.steps ?? '--'), String(d30.steps ?? '--'), '8000'],
        ['Sleep (hours)', String(d7.sleep ?? '--'), String(d30.sleep ?? '--'), '7.5'],
        ['Workout (min/day)', String(d7.workout ?? '--'), String(d30.workout ?? '--'), '30'],
        ['Active days', String(d7.activeDays), String(d30.activeDays), '3-4 / week'],
      ],
      { columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } },
    );
  }
  const comp = bodyComposition({ measurements, height, gender, weight: current });
  if (comp) {
    section('BODY COMPOSITION (estimate)');
    const lines = [];
    if (comp.bodyFat != null) lines.push(`Body fat about ${comp.bodyFat}% (fat ${comp.fatMass} kg, lean ${comp.leanMass} kg), US Navy tape method`);
    if (comp.whtr != null) lines.push(`Waist-to-height ratio ${comp.whtr} (${comp.whtr < 0.5 ? 'healthy, under 0.5' : 'above 0.5, bring the waist down'})`);
    bullets(lines);
  }
  if (detectPlateau(asc)) {
    section('PLATEAU ALERT');
    bullets(['Weight has been flat for 2 weeks. Add steps or a strength session and sleep more before changing anything else.']);
  }

  // ---- Notes & mood ----
  const notes = summarizeNotes(asc);
  if (notes.avgMood != null || notes.tagCounts.length > 0 || notes.notes.length > 0) {
    section('NOTES & MOOD');
    const lines = [];
    if (notes.avgMood != null) {
      const m = MOODS.reduce((best, cur) => (Math.abs(cur.value - notes.avgMood) < Math.abs(best.value - notes.avgMood) ? cur : best));
      lines.push(`Average mood: ${notes.avgMood}/4 (${m.label})`);
    }
    if (notes.tagCounts.length > 0) {
      lines.push(`Most common tags: ${notes.tagCounts.slice(0, 5).map(([t, c]) => `${t} x${c}`).join(', ')}`);
    }
    if (lines.length) bullets(lines);
    if (notes.notes.length > 0) {
      table(
        ['Date', 'Weight', 'Note'],
        notes.notes.slice(0, 15).map((w) => [format(w.date, 'd MMM yy'), kg(w.weight), w.note]),
        { columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 25, halign: 'right' } } },
      );
    }
  }

  // ---- Footer on every page ----
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Weight Loss Journey Report', margin, pageH - 7);
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 7, { align: 'right' });
  }

  return doc;
};
