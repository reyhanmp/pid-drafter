
const { chromium } = require('/home/reyhanmp/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const mk=(id,kind,tag,x,y,w,h)=>({id,type:'equipment',position:{x,y},data:{kind,tag,width:w,height:h,rotation:0,properties:{}}});
    localStorage.setItem('pid-drafter.project.autosave.v2', JSON.stringify({
      schema:'pid-drafter/project',version:2,savedAt:new Date().toISOString(),projectName:'DbgE',
      sheets:[{id:'sh-1',name:'Sheet 1',order:0,nodes:[mk('n-v','vessel-vertical','V-101',150,120,90,180)],
        edges:[{id:'freeline-1234-1-2',source:'',target:'',type:'free-line',
          data:{lineType:'process',freePipe:true,freeStart:{x:300,y:300},freeEnd:{x:600,y:500}}}]}]}));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => {
    const grp = document.querySelector('[data-testid^="free-line-"]');
    const paths = grp ? [...grp.querySelectorAll('path')].map(p=>({stroke:p.getAttribute('stroke'),d:p.getAttribute('d'),pe:getComputedStyle(p).pointerEvents})) : null;
    return {present: !!grp, testid: grp?.getAttribute('data-testid'), paths,
      svgPE: getComputedStyle(document.querySelector('[data-testid^="free-line-"]')?.closest('svg')||document.body).pointerEvents};
  });
  console.log('INFO', JSON.stringify(info,null,1));
  // click midpoint of the line
  const hit = await page.$('[data-testid^="free-line-"] path[stroke="transparent"]');
  if (hit) {
    const bb = await hit.boundingBox();
    console.log('BB', JSON.stringify(bb));
    await page.mouse.click(bb.x + bb.width/2, bb.y + bb.height/2);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
      deleteBtn: !!document.querySelector('[data-testid^="free-line-delete-"]'),
      selStroke: document.querySelector('[data-testid^="free-line-"] path:nth-child(2)')?.getAttribute('stroke'),
    }));
    console.log('AFTER_CLICK', JSON.stringify(after));
    const del = await page.$('[data-testid^="free-line-delete-"]');
    if (del) {
      const db = await del.boundingBox();
      console.log('DEL_BB', JSON.stringify(db));
      const inView = db && db.x > 0 && db.y > 0 && db.x < 1600 && db.y < 1000;
      console.log('DEL_IN_VIEW', inView);
      if (inView) {
        await page.mouse.click(db.x + db.width/2, db.y + db.height/2);
        await page.waitForTimeout(1200);
        console.log('AFTER_DELETE', await page.evaluate(() => ({
          count: document.querySelectorAll('[data-testid^="free-line-"]').length,
          stored: (JSON.parse(localStorage.getItem('pid-drafter.project.autosave.v2')).sheets[0].edges||[]).length,
        })));
      }
    }
  } else console.log('NO HIT TARGET');
  await b.close();
})();
