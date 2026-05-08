// ===========================================
// BLADEOPS — PDF Generator
// ===========================================

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { formatMinutes } = require('./calculations');

const OUTPUT_DIR = process.env.PDF_OUTPUT_DIR || path.join(__dirname, '../../storage/reports');

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate TECHLOG PDF for a day operation
 */
async function generateTechlogPDF(dayOp, flights, editLogs = []) {
 const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
  ],
  userDataDir: null,
});

  try {
    const page = await browser.newPage();
    const html = buildTechlogHTML(dayOp, flights, editLogs);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const filename = `TECHLOG_${dayOp.date}_${dayOp.aircraft_reg}_${Date.now()}.pdf`;
    const filepath = path.join(OUTPUT_DIR, filename);

    await page.pdf({
      path: filepath,
      format: 'A4',
      landscape: true,
      margin: { top: '10mm', right: '8mm', bottom: '10mm', left: '8mm' },
      printBackground: true,
    });

    await browser.close();
    return { filename, filepath };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

function buildTechlogHTML(dayOp, flights, editLogs) {
  const date = new Date(dayOp.date).toLocaleDateString('pt-PT');
  const totalBurn = flights.reduce((a, f) => a + (f.fuel_burn_lbs || 0), 0);
  const totalPax = flights.reduce((a, f) => a + (f.passengers_on_board || 0), 0);
  const totalDrop = flights.reduce((a, f) => a + (f.passengers_drop || 0), 0);
  const totalPick = flights.reduce((a, f) => a + (f.passengers_pickup || 0), 0);
  const totalNM = flights.reduce((a, f) => a + (f.distance_nm || 0), 0);
  const totalUpl = flights.reduce((a, f) => a + (f.fuel_uplift_lbs || 0), 0);
  const totalCargo = flights.reduce((a, f) => a + (f.cargo_on_lbs || 0), 0);
  const blockTime = formatMinutes(dayOp.total_block_minutes || 0);

  const flightRows = flights.map((f, i) => `
    <tr>
      <td class="n">${f.flight_number}</td>
      <td>${(f.fuel_remain_lbs || 0).toLocaleString()}</td>
      <td>${f.fuel_uplift_lbs || '—'}</td>
      <td>${(f.fuel_total_lbs || 0).toLocaleString()}</td>
      <td class="burn">${f.fuel_burn_lbs || 0}</td>
      <td class="after">${(f.fuel_after_lbs || 0).toLocaleString()}</td>
      <td class="bold">${f.passengers_on_board || 0}</td>
      <td class="drop">${f.passengers_drop || '—'}</td>
      <td class="pick">${f.passengers_pickup || '—'}</td>
      <td class="loc">${(f.from_name || '').replace('PSVM ', '')}</td>
      <td class="loc">${(f.to_name || '').replace('PSVM ', '')}</td>
      <td>${f.departure_time || '—'}</td>
      <td>${f.arrival_time || '—'}</td>
      <td class="dur bold">${f.duration_minutes ? formatMinutes(f.duration_minutes) : '—'}</td>
      <td>${f.distance_nm || 0}</td>
      <td>${f.cargo_on_lbs || 0}/${f.cargo_off_lbs || 0}</td>
      <td class="bold">${(f.total_weight_lbs || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  const editSection = editLogs.length > 0 ? `
    <div class="edit-log">
      <div class="edit-log-title">📝 Registo de Edições</div>
      ${editLogs.map(e => `
        <div class="edit-item">
          ${e.created_at ? new Date(e.created_at).toLocaleString('pt-PT') : ''} ·
          <strong>${e.user_name}</strong> alterou <strong>${e.field_name}</strong>
          (V${e.entity_id}): ${e.old_value} → <strong>${e.new_value}</strong> ·
          <em>"${e.reason}"</em>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #000; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: center;
      border-bottom: 3px solid #023E8A; padding-bottom: 8px; margin-bottom: 8px; }
    .title { font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #023E8A; }
    .subtitle { font-size: 8px; color: #555; margin-top: 2px; }
    .logo { border: 2px solid #0077B6; padding: 4px 10px; border-radius: 4px;
      text-align: center; color: #0077B6; font-weight: 900; font-size: 11px; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    th, td { border: 1px solid #B8D4E8; padding: 2px 3px; text-align: center; }
    th { background: #BDD7EE; font-weight: 700; color: #1F3864; }
    th.dk { background: #023E8A; color: #fff; }
    td.lg { background: #DEEAF1; }
    td.gr { background: #D9D9D9; }
    td.burn { background: #8B1A1A; color: #fff; font-weight: 700; }
    td.after { background: #1A4A7A; color: #fff; font-weight: 700; }
    td.drop { color: #8B0000; font-weight: 700; }
    td.pick { color: #0A3622; font-weight: 700; }
    td.bold { font-weight: 700; }
    td.dur { color: #023E8A; }
    td.n { font-weight: 700; color: #023E8A; }
    td.loc { text-align: left; font-weight: 600; }
    .tot { background: #BDD7EE !important; font-weight: 700; color: #1F3864; }
    .tot-dk { background: #023E8A !important; color: #fff !important; font-weight: 700; }
    .info-band { background: #E2EFDA; font-weight: 700; text-align: right;
      font-size: 8px; padding: 2px 6px; }
    .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 10px; }
    .sig { border-top: 1.5px solid #023E8A; padding-top: 3px; font-size: 8px; color: #555; text-align: center; }
    .footer { text-align: center; font-size: 7px; color: #aaa; margin-top: 8px;
      padding-top: 4px; border-top: 1px solid #eee; }
    .edit-log { margin-top: 8px; background: #FFF8E7; border: 1px solid #FFDD9E;
      border-radius: 4px; padding: 6px 8px; }
    .edit-log-title { font-weight: 700; color: #664D03; margin-bottom: 4px; }
    .edit-item { font-size: 8px; margin-bottom: 2px; color: #333; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">TECHLOG</div>
      <div class="subtitle">Relatório oficial de operações · BladeOps</div>
    </div>
    <div class="logo">SKYVORA<br><span style="font-size:8px;letter-spacing:1px">AVIATION</span></div>
  </div>

  <table>
    <tr>
      <th>DATA</th><th>REGISTO</th><th>TIPO</th>
      <th>COMANDANTE</th><th>COPILOTO</th><th>MOTOR ON</th><th>MOTOR OFF</th>
    </tr>
    <tr>
      <td><strong>${date}</strong></td>
      <td>${dayOp.aircraft_reg || '—'}</td>
      <td>${dayOp.aircraft_type || 'AW169'}</td>
      <td><strong>${dayOp.commander_name || '—'}</strong></td>
      <td><strong>${dayOp.copilot_name || '—'}</strong></td>
      <td>${dayOp.motor_on_time || '—'}</td>
      <td>${dayOp.motor_off_time || flights[flights.length - 1]?.arrival_time || '—'}</td>
    </tr>
  </table>

  <table>
    <tr><td colspan="5" class="info-band">Weight &amp; Balance Information (lbs)</td></tr>
    <tr>
      <th>EMPTY WT</th><th>CREW/EQUIP</th><th>OP. WEIGHT</th><th>MTOW</th><th>PAX STD WT</th>
    </tr>
    <tr>
      <td>6 834</td><td>1 074</td><td>7 908</td><td><strong>10 560</strong></td><td>187</td>
    </tr>
  </table>

  <table>
    <tr>
      <th class="dk" rowspan="2" style="width:3%">Nº</th>
      <th class="dk" colspan="5">COMBUSTÍVEL (lbs)</th>
      <th class="dk" colspan="3">PASSAGEIROS</th>
      <th class="dk" colspan="5">VOOS</th>
      <th class="dk" colspan="3">CARGA / PESO</th>
    </tr>
    <tr>
      <th>REMAIN</th><th>UPLIFT</th><th>TOTAL</th>
      <th style="background:#8B1A1A;color:#fff">BURN</th>
      <th style="background:#1A4A7A;color:#fff">APÓS</th>
      <th>BORDO</th><th>DEIXOU</th><th>RECOLHEU</th>
      <th>DE</th><th>PARA</th><th>SAÍDA</th><th>CHEGADA</th><th>DURAÇÃO</th>
      <th>NM</th><th>CARGA ↑/↓</th><th>PESO TOTAL</th>
    </tr>
    ${flightRows}
    <tr>
      <td class="tot-dk"><strong>∑</strong></td>
      <td class="tot">—</td>
      <td class="tot"><strong>${totalUpl.toLocaleString()}</strong></td>
      <td class="tot">—</td>
      <td style="background:#8B1A1A;color:#fff;font-weight:700">${totalBurn.toLocaleString()}</td>
      <td style="background:#1A4A7A;color:#fff;font-weight:700">${(flights[flights.length - 1]?.fuel_after_lbs || 0).toLocaleString()}</td>
      <td class="tot"><strong>${totalPax}</strong></td>
      <td class="tot"><strong>${totalDrop}</strong></td>
      <td class="tot"><strong>${totalPick}</strong></td>
      <td class="tot" colspan="2">—</td>
      <td class="tot-dk" colspan="3"><strong>BLOCK TIME: ${blockTime}</strong></td>
      <td class="tot"><strong>${totalNM} NM</strong></td>
      <td class="tot"><strong>${totalCargo.toLocaleString()} lbs</strong></td>
      <td class="tot">—</td>
    </tr>
  </table>

  <table>
    <tr>
      <th>FUEL INICIAL (lbs)</th><th>TOTAL UPLIFT (lbs)</th>
      <th>TOTAL BURN (lbs)</th><th>FUEL FINAL (lbs)</th>
      <th>NM TOTAL</th><th>BLOCK TIME</th>
    </tr>
    <tr>
      <td>${(flights[0]?.fuel_remain_lbs || dayOp.initial_fuel_lbs || 0).toLocaleString()}</td>
      <td>${totalUpl.toLocaleString()}</td>
      <td><strong>${totalBurn.toLocaleString()}</strong></td>
      <td><strong>${(dayOp.final_fuel_lbs || flights[flights.length - 1]?.fuel_after_lbs || 0).toLocaleString()}</strong></td>
      <td><strong>${totalNM} NM</strong></td>
      <td><strong>${blockTime}</strong></td>
    </tr>
  </table>

  ${editSection}

  <div class="sigs">
    <div class="sig">
      <div style="height:22px"></div>
      Comandante: <strong>${dayOp.commander_name || '—'}</strong><br>
      <span style="color:#999">${date}</span>
    </div>
    <div class="sig">
      <div style="height:22px"></div>
      Copiloto: <strong>${dayOp.copilot_name || '—'}</strong><br>
      <span style="color:#999">${date}</span>
    </div>
    <div class="sig">
      <div style="height:22px"></div>
      Aprovado: <strong>Administrador</strong><br>
      <span style="color:#999">${date}</span>
    </div>
  </div>

  <div class="footer">
    BladeOps · Documento gerado automaticamente · ${date} · Confidencial
  </div>
</body>
</html>`;
}

module.exports = { generateTechlogPDF };
