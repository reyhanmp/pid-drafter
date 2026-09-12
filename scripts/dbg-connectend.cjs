
const { chromium } = require('/home/reyhanmp/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const mk=(id,kind,tag,x,y,w,h)=>({id,type:'equipment',position:{x,y},data:{kind,tag,width:w,height:h,rotation:0,properties:{}}});
    localStorage.setItem('pid-drafter.project.autosave.v2', JSON.stringify({
      schema:'pid-drafter/project',version:2,savedAt:new Date().toISOString(),projectName:'Dbg2',
      sheets:[{id:'sh-1',name:'Sheet 1',order:0,edges:[],nodes:[mk('n-v','vessel-vertical','V-101',150,120,90,180)]}]}));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="equipment-node-vessel-vertical"]');
  // instrument onConnectEnd by wrapping the ReactFlow store? simpler: watch DOM + storage over time
  const h = await page.$('[data-testid="equipment-node-vessel-vertical"] [data-handleid="right"]');
  const bx = await h.boundingBox();
  const sx = bx.x + bx.width/2, sy = bx.y + bx.height/2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx+260, sy+300, { steps: 12 });
  await page.mouse.up();
  const samples = [];
  for (const t of [300, 800, 1500, 2500]) {
    await page.waitForTimeout(t - (samples.length ? samples[samples.length - 1].t : 0));
    samples.push({
      t,
      ...(await page.evaluate(() => ({
        dom: document.querySelectorAll('[data-testid^="free-line-freeline"]').length,
        edges: JSON.parse(localStorage.getItem('pid-drafter.project.autosave.v2')).sheets[0].edges.length,
        free: JSON.parse(localStorage.getItem('pid-drafter.project.autosave.v2')).sheets[0].edges.filter(e=>e.data&&e.data.freePipe).length,
        notice: (document.querySelector('button[aria-label*="Autosave"], .autosave') || {}).innerText || '',
      }))),
    });
  }
  console.log(JSON.stringify(samples, null, 1));
  await b.close();
})();
