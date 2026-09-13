/**
 * Visual capture for the chemical-engineering depth pass.
 *
 * Seeds a realistic project modelled on the reference drawing's conventions
 * (ISA tags + house codes + real line numbers), opens a reactor data sheet and
 * a line data sheet, and writes screenshots to /tmp/pid-chemE/.
 *
 * Not an assertion suite — this exists so a human can LOOK at the result.
 */
const fs = require('fs');
const { launch, freshPage, seedProject, URL } = require('./harness.cjs');
const OUT = '/tmp/pid-chemE';
fs.mkdirSync(OUT, { recursive: true });

const eq = (id, kind, tag, x, y, w = 90, h = 90, properties = {}) => ({
  id, type: 'equipment', position: { x, y },
  data: { kind, tag, width: w, height: h, rotation: 0, properties },
});

/**
 * Kinds and port ids below are taken from the live symbol registry, not
 * guessed — the first draft of this fixture seeded `column-trayed` and
 * `hx-shell-tube`, neither of which exists, and the canvas silently mounted
 * nothing. Port ids matter too: an edge referencing a port that is not
 * declared raises a validity error, which would make the screenshot show
 * errors that are the fixture's fault rather than the app's.
 */

const PROJECT = {
  projectName: 'ChemE Depth — demo',
  sheets: [
    {
      id: 'sh-1', name: 'Sheet 1', order: 0,
      nodes: [
        // A reactor with a genuinely filled reaction-engineering sheet.
        eq('n-r', 'reactor-jacketed', 'R-710.01', 80, 120, 110, 200, {
          service: 'Saponification', reactionType: 'Exothermic, second order',
          designPressure: '6', designTemperature: '180', operatingPressure: '2.5', operatingTemperature: '140',
          volume: '12', workingVolume: '9.6', residenceTime: '45', conversion: '98.5',
          heatOfReaction: '-180', heatDuty: '450', heatTransferArea: '18', overallCoefficient: '620',
          jacketMedium: 'Cooling water', jacketInletTemp: '28', jacketOutletTemp: '42', jacketFlow: '12.5',
          agitationPower: '11', agitatorSpeed: '85', agitatorType: 'Rushton turbine',
          material: 'SS316L', insulation: 'Mineral wool 50mm', moc: 'SS316L',
        }),
        // A column, the other deepest process-engineering item.
        eq('n-c', 'column-tray', 'C-710.01', 320, 40, 100, 260, {
          service: 'Fatty acid fractionation', columnType: 'Trayed, sieve', numberOfStages: '32',
          diameter: '1.8', height: '18.5', traySpacing: '0.5', feedStage: '14', refluxRatio: '2.4',
          designPressure: '0.5', designTemperature: '260', operatingPressure: '0.15', operatingTemperature: '245',
          topTemperature: '232', bottomTemperature: '252', condenserDuty: '-820', reboilerDuty: '910',
          material: 'SS316L',
        }),
        eq('n-p', 'pump-centrifugal', 'P-710.01A', 580, 140, 70, 70, {
          service: 'Column bottoms', pumpType: 'Centrifugal, horizontal', flowRate: '18.5',
          differentialHead: '42', npshRequired: '2.8', efficiency: '72', powerAbsorbed: '4.2',
          sealType: 'Mechanical, dual', material: 'SS316L',
        }),
        eq('n-e', 'heat-exchanger', 'E-710.01', 800, 140, 130, 60, {
          service: 'Overhead condenser', hxType: 'Shell and tube, BEM', duty: '-820',
          heatTransferArea: '42', overallCoefficient: '480', designPressure: '6', designTemperature: '180',
          tubeMaterial: 'SS316L', shellMaterial: 'CS',
        }),
        // ISA + house codes straight off the real drawing.
        eq('n-tt', 'transmitter-temp', 'TT-710.1A', 120, 470, 56, 56),
        eq('n-tic', 'controller-dcs', 'TIC-710.1A', 260, 470, 56, 56),
        eq('n-lsh', 'indicator-local', 'LSH-710.1A', 400, 470, 56, 56),
        eq('n-zsl', 'relay-diamond', 'ZSL-710.11A', 540, 470, 56, 56),
        eq('n-hs', 'relay-diamond', 'HS-710.11A', 680, 470, 56, 56),
      ],
      edges: [
        { id: 'e-1', source: 'n-r', target: 'n-c', sourceHandle: 'product', targetHandle: 'feed-lower', type: 'pipe',
          data: { lineType: 'process', lineNumber: '1 1/2"-LPS2-710.01-300-HC', lineSize: 'DN40', lineName: 'Reactor to column feed',
            materialOfConstruction: 'SS316L', jacketed: true, sourceDirection: { x: 0, y: -1 }, targetDirection: { x: 0, y: 1 } } },
        { id: 'e-2', source: 'n-c', target: 'n-p', sourceHandle: 'bottoms', targetHandle: 'suction', type: 'pipe',
          data: { lineType: 'process', lineNumber: '3"-JAC-710.20-300-HC', lineSize: 'DN80', lineName: 'Column bottoms to pump',
            materialOfConstruction: 'SS316L', sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 } } },
        { id: 'e-3', source: 'n-p', target: 'n-e', sourceHandle: 'discharge', targetHandle: 'tube-in', type: 'pipe',
          data: { lineType: 'process', lineNumber: '4"-BL-710.05B-300-HC', lineSize: 'DN100', lineName: 'Bottoms product',
            materialOfConstruction: 'SS316L', sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 } } },
        { id: 'e-4', source: 'n-tt', target: 'n-tic', sourceHandle: 'signal', targetHandle: 'signal', type: 'signal',
          data: { lineType: 'signal', sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 } } },
      ],
    },
  ],
};

(async () => {
  const { browser, page, errors } = await launch();
  try {
    // localStorage is origin-scoped, so the app must be loaded before seeding.
    await freshPage(page);
    await seedProject(page, PROJECT);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/01-canvas.png` });
    console.log('captured canvas');

    // Open the reactor's data sheet (kind selector is unique per fixture).
    await page.click('[data-testid="equipment-node-reactor-jacketed"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/02-reactor-sheet.png` });
    const reactorLabels = await page.evaluate(() =>
      [...document.querySelectorAll('.data-sheet-panel .data-sheet-field > span:first-child')].map((s) => s.textContent.trim()),
    );
    console.log(`reactor sheet: ${reactorLabels.length} fields`);
    const groups = await page.evaluate(() =>
      [...document.querySelectorAll('.data-sheet-group-heading')].map((s) => s.textContent.trim()),
    );
    console.log('groups: ' + groups.join(' | '));

    // Now a line data sheet, to show the structured line-number editor.
    await page.click('[data-testid="equipment-node-column-tray"]');
    await page.waitForTimeout(200);
    const edgeOk = await page.evaluate(() => {
      const el = document.querySelector('.react-flow__edge');
      return !!el;
    });
    if (edgeOk) {
      const box = await page.evaluate(() => {
        const el = document.querySelector('.react-flow__edge path');
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/03-line-sheet.png` });
      const lnFields = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid^="ln-"]')].map((e) => e.getAttribute('data-testid')),
      );
      const panelPresent = await page.evaluate(() => !!document.querySelector('[data-testid="line-data-sheet-panel"]'));
      console.log(`line sheet open: ${panelPresent}; structured fields: ${lnFields.join(', ')}`);
    }

    const real = errors.filter((e) => !/DevTools|favicon/i.test(e));
    console.log('page errors: ' + (real.length ? real.slice(0, 3).join(' | ') : 'none'));
  } finally {
    await browser.close();
  }
})();
