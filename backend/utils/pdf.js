// ===========================================
// BLADEOPS — Techlog PDF Generator v2
// ===========================================
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const C = {
  navy:      '#0a1628',
  navyMid:   '#0f2040',
  blue:      '#1a5fa8',
  blueMid:   '#2176c0',
  blueLight: '#d6eaf8',
  bluePale:  '#eaf4fc',
  green:     '#1a7a4a',
  greenBg:   '#e8f5ee',
  amber:     '#8a5200',
  amberBg:   '#fff8e6',
  red:       '#c0222a',
  redBg:     '#fdecea',
  white:     '#ffffff',
  black:     '#0a1628',
  grey:      '#5a6e82',
  greyLight: '#f4f7fa',
  greyMid:   '#e8edf2',
  border:    '#c8d8e8',
};

function fmtMin(m) {
  if (!m && m !== 0) return '—';
  const h = Math.floor(m/60), mn = m%60;
  return h > 0 ? `${h}h ${String(mn).padStart(2,'0')}m` : `${mn}m`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
}
function safe(v, fallback='—') {
  return (v !== null && v !== undefined && String(v).trim() !== '') ? String(v) : fallback;
}
function safeNum(v, unit='') {
  if (!v && v !== 0) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return `${n.toLocaleString('en-US')}${unit ? ' '+unit : ''}`;
}

async function generateTechlogPDF(dayOp, trips, flights, uplifts, editLogs) {
  const storageDir = path.join(__dirname, '../../storage/reports');
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

  const filename = `techlog-${dayOp.aircraft_reg}-${String(dayOp.date).slice(0,10)}-${Date.now()}.pdf`;
  const filepath = path.join(storageDir, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top:36, bottom:36, left:36, right:36 },
      bufferPages: true,
      info: {
        Title:   `Techlog — ${dayOp.aircraft_reg} — ${fmtDate(dayOp.date)}`,
        Author:  'BladeOps',
        Subject: 'Daily Flight Operations Report',
      },
    });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    const PW  = doc.page.width;   // 595
    const PH  = doc.page.height;  // 842
    const ML  = 36;
    const MR  = 36;
    const W   = PW - ML - MR;     // 523
    let   Y   = 36;

    // ── Computed totals ─────────────────────────────────────────────
    const totalBlockMin = trips.reduce((a,t)  => a+(t.block_minutes||0), 0);
    const totalPax      = flights.reduce((a,f) => a+(f.passengers_drop||0), 0);
    const totalCargo    = flights.reduce((a,f) => a+(f.cargo_on_lbs||0), 0);
    const totalFuelBurn = flights.reduce((a,f) => a+(f.fuel_burn_lbs||0), 0);
    const totalUplift   = uplifts.reduce((a,u) => a+(u.uplift_lbs||0), 0);
    const finalFuel     = dayOp.current_fuel_lbs || dayOp.final_fuel_lbs || dayOp.initial_fuel_lbs || 0;

    // ════════════════════════════════════════════════════════════════
    // HEADER
    // ════════════════════════════════════════════════════════════════
    // Top dark bar
    doc.rect(0, 0, PW, 70).fill(C.navy);

    // Logo + title
    doc.fillColor('#4da6d9').font('Helvetica-Bold').fontSize(22)
       .text('BLADEOPS', ML, 14);
    doc.fillColor('#8ab8d4').font('Helvetica').fontSize(8.5)
       .text('AVIATION OPERATIONS — OFFSHORE TECHLOG', ML, 38);

    // Aircraft + date (right)
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(16)
       .text(safe(dayOp.aircraft_reg), 0, 14, { align:'right', width: PW-ML });
    doc.fillColor('#8ab8d4').font('Helvetica').fontSize(9)
       .text(`${safe(dayOp.aircraft_type)}  ·  ${fmtDate(dayOp.date)}`, 0, 34, { align:'right', width: PW-ML });

    // Status badge
    const statusColors = { signed:[C.green,'#e8f5ee'], closed:[C.blue,'#d6eaf8'], open:['#8a5200','#fff8e6'] };
    const [sc, sbg] = statusColors[dayOp.status] || [C.grey, C.greyLight];
    const statusLabel = (dayOp.status||'open').toUpperCase();
    doc.rect(0, 50, PW, 20).fill(C.navyMid);
    doc.fillColor('#8ab8d4').font('Helvetica').fontSize(8)
       .text('STATUS:', ML, 56);
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(9)
       .text(statusLabel, ML+42, 56);

    Y = 78;

    // ── Crew bar ─────────────────────────────────────────────────────
    doc.rect(ML, Y, W, 32).fill(C.bluePale).stroke(C.border);
    const cw = W/3;

    doc.fillColor(C.grey).font('Helvetica').fontSize(7.5)
       .text('COMMANDER', ML+10, Y+5);
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(10)
       .text(safe(dayOp.commander_name), ML+10, Y+14, { width: cw-20 });

    doc.fillColor(C.grey).font('Helvetica').fontSize(7.5)
       .text('COPILOT', ML+cw+10, Y+5);
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(10)
       .text(safe(dayOp.copilot_name), ML+cw+10, Y+14, { width: cw-20 });

    doc.fillColor(C.grey).font('Helvetica').fontSize(7.5)
       .text('AIRCRAFT', ML+cw*2+10, Y+5);
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(10)
       .text(`${safe(dayOp.aircraft_reg)}  ·  ${safe(dayOp.aircraft_type)}`, ML+cw*2+10, Y+14, { width: cw-20 });

    Y += 40;

    // ════════════════════════════════════════════════════════════════
    // DAILY SUMMARY
    // ════════════════════════════════════════════════════════════════
    secHeader(doc, ML, Y, W, 'DAILY SUMMARY');
    Y += 22;

    const summaryData = [
      { label:'BLOCK TIME',        value:fmtMin(totalBlockMin),                     color:C.navy  },
      { label:'TRIPS',             value:`${trips.length}`,                          color:C.navy  },
      { label:'LEGS',              value:`${flights.filter(f=>f.arrival_time).length}`, color:C.navy },
      { label:'PAX TRANSPORTED',   value:safeNum(totalPax),                          color:C.green },
      { label:'CARGO LOADED',      value:safeNum(totalCargo,'lbs'),                  color:C.amber },
      { label:'FUEL INITIAL',      value:safeNum(dayOp.initial_fuel_lbs,'lbs'),      color:C.grey  },
      { label:'UPLIFT TOTAL',      value:totalUplift>0?`+${Number(totalUplift).toLocaleString()} lbs`:'—', color:C.blue },
      { label:'FUEL BURNED',       value:safeNum(totalFuelBurn,'lbs'),               color:C.red   },
      { label:'FUEL FINAL',        value:safeNum(finalFuel,'lbs'),                   color:C.navy  },
    ];

    const cols   = 3;
    const cellW  = W / cols;
    const cellH  = 30;
    summaryData.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = ML + col * cellW;
      const y   = Y  + row * cellH;
      const bg  = (row + col) % 2 === 0 ? C.white : C.greyLight;
      doc.rect(x, y, cellW, cellH).fill(bg).stroke(C.border);
      doc.fillColor(C.grey).font('Helvetica').fontSize(7)
         .text(item.label, x+8, y+5, { width: cellW-16 });
      doc.fillColor(item.color).font('Helvetica-Bold').fontSize(12)
         .text(item.value, x+8, y+13, { width: cellW-16 });
    });

    const summaryRows = Math.ceil(summaryData.length / cols);
    Y += summaryRows * cellH + 14;

    // ════════════════════════════════════════════════════════════════
    // OPERATIONS DETAIL
    // ════════════════════════════════════════════════════════════════
    secHeader(doc, ML, Y, W, 'OPERATIONS DETAIL');
    Y += 22;

    // Column definitions — carefully sized to fit A4 width (523pt)
    const LEG_COLS = [
      { label:'#',        w:18,  align:'center' },
      { label:'FROM',     w:80,  align:'left'   },
      { label:'TO',       w:80,  align:'left'   },
      { label:'DEP',      w:36,  align:'center' },
      { label:'ARR',      w:36,  align:'center' },
      { label:'DUR',      w:36,  align:'center' },
      { label:'PAX',      w:24,  align:'center' },
      { label:'PAX WT',   w:46,  align:'center' },
      { label:'CARGO ON', w:46,  align:'center' },
      { label:'FUEL REM', w:50,  align:'center' },
      { label:'BURN',     w:46,  align:'center' },
    ];
    // Total: 18+80+80+36+36+36+24+46+46+50+46 = 498 → fits in 523

    trips.forEach((trip) => {
      if (Y > PH - 100) { doc.addPage(); Y = 36; }

      // ── Trip header ──────────────────────────────────────────────
      doc.rect(ML, Y, W, 18).fill(C.navy);

      const rotorOn  = trip.rotor_on_time  ? trip.rotor_on_time.slice(0,5)  : '—';
      const rotorOff = trip.rotor_off_time ? trip.rotor_off_time.slice(0,5) : 'ACTIVE';
      const tripInfo = `TRIP #${trip.trip_number}   ·   ROTOR ON ${rotorOn}   ·   ROTOR OFF ${rotorOff}   ·   BLOCK ${fmtMin(trip.block_minutes)}   ·   LEGS ${trip.leg_count||0}   ·   PAX ${trip.trip_pax||0}   ·   BURN ${safeNum(trip.trip_fuel_burn,'lbs')}`;

      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(8)
         .text(tripInfo, ML+8, Y+5, { width: W-16, ellipsis: true });
      Y += 18;

      const tripLegs = flights.filter(f => f.trip_id === trip.id);

      if (tripLegs.length === 0) {
        doc.rect(ML, Y, W, 16).fill(C.greyLight).stroke(C.border);
        doc.fillColor(C.grey).font('Helvetica').fontSize(8)
           .text('No legs recorded for this trip', ML+8, Y+4);
        Y += 16;
      } else {
        // ── Column header ──────────────────────────────────────────
        doc.rect(ML, Y, W, 14).fill(C.blueMid);
        let cx = ML;
        LEG_COLS.forEach(col => {
          doc.fillColor(C.white).font('Helvetica-Bold').fontSize(6.5)
             .text(col.label, cx+2, Y+3.5, { width:col.w-4, align:col.align });
          cx += col.w;
        });
        Y += 14;

        // ── Leg rows ───────────────────────────────────────────────
        tripLegs.forEach((leg, li) => {
          if (Y > PH - 70) { doc.addPage(); Y = 36; }

          const rowH  = 22;
          const detailH = 10;
          const totalH = rowH + detailH;
          const rowBg = li % 2 === 0 ? C.white : C.greyLight;

          doc.rect(ML, Y, W, totalH).fill(rowBg).stroke(C.border);

          const paxWt  = leg.passengers_weight_lbs  ? `${Number(leg.passengers_weight_lbs).toLocaleString()} lbs`  : '—';
          const cargo  = leg.cargo_on_lbs             ? `${Number(leg.cargo_on_lbs).toLocaleString()} lbs`           : '—';
          const fuelRm = leg.fuel_remaining_after     ? `${Number(leg.fuel_remaining_after).toLocaleString()} lbs`   : '—';
          const burn   = leg.fuel_burn_lbs             ? `${Number(leg.fuel_burn_lbs).toLocaleString()} lbs`          : '—';
          const dep    = leg.departure_time ? leg.departure_time.slice(0,5) : '—';
          const arr    = leg.arrival_time   ? leg.arrival_time.slice(0,5)   : '—';
          const dur    = leg.duration_minutes ? fmtMin(leg.duration_minutes) : '—';

          const mainData = [
            String(leg.flight_number),
            safe(leg.from_name),
            safe(leg.to_name),
            dep, arr, dur,
            String(leg.passengers_on_board||0),
            paxWt, cargo, fuelRm, burn,
          ];

          cx = ML;
          LEG_COLS.forEach((col, ci) => {
            const textColor = ci === 6 ? C.blue : ci === 9 ? C.green : ci === 10 ? C.red : C.navy;
            const fw = ci >= 7 ? 'Helvetica-Bold' : 'Helvetica';
            doc.fillColor(textColor).font(fw).fontSize(7.5)
               .text(mainData[ci], cx+2, Y+5, { width:col.w-4, align:col.align, ellipsis:true });
            cx += col.w;
          });

          // Detail row — PAX off/on, cargo off, PAX weight remaining
          const details = [];
          if (leg.passengers_drop   > 0) details.push(`↓ PAX off: ${leg.passengers_drop}`);
          if (leg.passengers_pickup > 0) details.push(`↑ PAX on: ${leg.passengers_pickup}`);
          if (leg.passengers_weight_after_lbs > 0) details.push(`PAX wt rem: ${leg.passengers_weight_after_lbs} lbs`);
          if (leg.cargo_off_lbs     > 0) details.push(`Cargo off: ${leg.cargo_off_lbs} lbs`);

          if (details.length > 0) {
            doc.fillColor(C.grey).font('Helvetica').fontSize(6.5)
               .text(details.join('   ·   '), ML+22, Y+rowH, { width: W-30 });
          }

          Y += totalH;
        });
      }

      Y += 6;
    });

    // ════════════════════════════════════════════════════════════════
    // UPLIFTS
    // ════════════════════════════════════════════════════════════════
    if (uplifts.length > 0) {
      if (Y > PH - 100) { doc.addPage(); Y = 36; }
      secHeader(doc, ML, Y, W, `FUEL UPLIFTS  ·  Total Added: +${Number(totalUplift).toLocaleString()} lbs`);
      Y += 22;

      const UCW = [50, 40, 100, 90, 100, W-380];
      const ULBLS = ['TIME','TRIP','BEFORE','ADDED','AFTER','NOTES'];

      doc.rect(ML, Y, W, 14).fill(C.blueMid);
      let ux = ML;
      ULBLS.forEach((l, i) => {
        doc.fillColor(C.white).font('Helvetica-Bold').fontSize(7)
           .text(l, ux+4, Y+3.5, { width:UCW[i]-8, align:'center' });
        ux += UCW[i];
      });
      Y += 14;

      uplifts.forEach((u, ui) => {
        if (Y > PH - 50) { doc.addPage(); Y = 36; }
        const bg = ui%2===0 ? C.white : C.greyLight;
        doc.rect(ML, Y, W, 18).fill(bg).stroke(C.border);

        const uData = [
          u.uplift_time ? u.uplift_time.slice(0,5) : '—',
          u.trip_number ? `#${u.trip_number}` : '—',
          safeNum(u.fuel_before_lbs,'lbs'),
          `+${Number(u.uplift_lbs||0).toLocaleString()} lbs`,
          safeNum(u.fuel_after_lbs,'lbs'),
          safe(u.notes),
        ];

        ux = ML;
        UCW.forEach((w, ci) => {
          const color = ci === 3 ? C.green : C.navy;
          const font  = ci === 3 ? 'Helvetica-Bold' : 'Helvetica';
          doc.fillColor(color).font(font).fontSize(8)
             .text(uData[ci], ux+4, Y+5, { width:w-8, align: ci<5?'center':'left', ellipsis:true });
          ux += w;
        });
        Y += 18;
      });
      Y += 10;
    }

    // ════════════════════════════════════════════════════════════════
    // EDIT LOG
    // ════════════════════════════════════════════════════════════════
    if (editLogs && editLogs.length > 0) {
      if (Y > PH - 100) { doc.addPage(); Y = 36; }
      secHeader(doc, ML, Y, W, 'EDIT LOG — AUDIT TRAIL');
      Y += 22;

      const ECW = [90, 80, 70, 70, 70, W-380];
      const ELBLS = ['DATE/TIME','USER','FIELD','OLD','NEW','REASON'];

      doc.rect(ML, Y, W, 14).fill(C.navyMid);
      let ex = ML;
      ELBLS.forEach((l, i) => {
        doc.fillColor(C.white).font('Helvetica-Bold').fontSize(7)
           .text(l, ex+4, Y+3.5, { width:ECW[i]-8 });
        ex += ECW[i];
      });
      Y += 14;

      editLogs.forEach((e, ei) => {
        if (Y > PH - 50) { doc.addPage(); Y = 36; }
        doc.rect(ML, Y, W, 16).fill(ei%2===0?C.white:C.greyLight).stroke(C.border);
        const dt = e.created_at ? new Date(e.created_at).toLocaleString('en-GB') : '—';
        const eData = [dt, safe(e.user_name), safe(e.field_name), safe(e.old_value), safe(e.new_value), safe(e.reason)];
        ex = ML;
        ECW.forEach((w, ci) => {
          doc.fillColor(C.navy).font('Helvetica').fontSize(7)
             .text(eData[ci], ex+4, Y+4, { width:w-8, ellipsis:true });
          ex += w;
        });
        Y += 16;
      });
      Y += 10;
    }

    // ════════════════════════════════════════════════════════════════
    // SIGNATURES
    // ════════════════════════════════════════════════════════════════
    if (Y > PH - 120) { doc.addPage(); Y = 36; }
    secHeader(doc, ML, Y, W, 'SIGNATURES & CERTIFICATION');
    Y += 22;

    const sigW = W / 3;
    const sigH = 72;
    const sigRoles  = ['COMMANDER', 'COPILOT', 'OPERATIONS CONTROL'];
    const sigNames  = [dayOp.commander_name, dayOp.copilot_name, 'Admin'];
    const sigSigned = [dayOp.signed_by_commander, dayOp.signed_by_copilot, dayOp.signed_by_admin];

    sigRoles.forEach((role, i) => {
      const x = ML + i * sigW;
      doc.rect(x, Y, sigW, sigH).fill(C.white).stroke(C.border);

      // Role header
      doc.rect(x, Y, sigW, 14).fill(C.navyMid);
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(7.5)
         .text(role, x+8, Y+3.5, { width: sigW-16 });

      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(10)
         .text(safe(sigNames[i]), x+8, Y+20, { width: sigW-16 });

      if (sigSigned[i]) {
        doc.rect(x+8, Y+38, sigW-16, 22).fill(C.greenBg).stroke('#a8d5b8');
        doc.fillColor(C.green).font('Helvetica-Bold').fontSize(9)
           .text('✓  SIGNED', x+8, Y+44, { width: sigW-16, align:'center' });
      } else {
        doc.rect(x+8, Y+38, sigW-16, 22).fill(C.greyLight).stroke(C.border);
        doc.fillColor(C.grey).font('Helvetica').fontSize(8.5)
           .text('Pending Signature', x+8, Y+44, { width: sigW-16, align:'center' });
      }
    });

    Y += sigH + 10;

    // Note at bottom
    doc.fillColor(C.grey).font('Helvetica').fontSize(7.5)
       .text('This document is an official operational record. Any amendments must be approved by Operations Control.', ML, Y, { width:W, align:'center' });

    // ════════════════════════════════════════════════════════════════
    // FOOTER on every page
    // ════════════════════════════════════════════════════════════════
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.rect(0, PH-24, PW, 24).fill(C.navy);
      doc.fillColor('#4d84a8').font('Helvetica').fontSize(7.5)
         .text(
           `BladeOps Aviation Ops  ·  ${safe(dayOp.aircraft_reg)} — ${fmtDate(dayOp.date)}  ·  Generated ${new Date().toLocaleString('en-GB')}`,
           ML, PH-16, { width: PW-ML-60 }
         );
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(8)
         .text(`${i+1} / ${range.count}`, 0, PH-16, { align:'right', width: PW-ML });
    }

    doc.end();
    stream.on('finish', () => resolve({ filename, filepath }));
    stream.on('error',  reject);
  });
}

function secHeader(doc, x, y, w, title) {
  doc.rect(x, y, w, 18).fill('#0f2040');
  doc.fillColor('#4da6d9').font('Helvetica-Bold').fontSize(8)
     .text(`  ${title}`, x, y+5, { width: w });
}

module.exports = { generateTechlogPDF };