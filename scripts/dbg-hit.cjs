
const { chromium } = require('/home/reyhanmp/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const mk=(id,kind,tag,x,y,w,h)=>({id,type:'equipment',position:{x,y},data:{kind,tag,width:w,height:h,rotation:0,properties:{}}});
    localStorage.setItem('pid-drafter.project.autosave.v2', JSON.stringify({
      schema:'pid-drafter/project',version:2,savedAt:new Date().toISOString(),projectName:'DbgHit',
      sheets:[{id:'sh-1',name:'Sheet 1',order:0,nodes:[mk('n-v','vessel-vertical','V-101',150,120,90,180)],
        edges:[{id:'freeline-1234-1-2',source:'',target:'',type:'free-line',
          data:{lineType:'process',freePipe:true,freeStart:{x:320,y:320},freeEnd:{x:620,y:520}}}]}]}));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const hit = document.querySelector('[data-testid^="free-line-"] path[stroke="transparent"]');
    const bb = hit.getBoundingClientRect();
    const mx = bb.x + bb.width/2, my = bb.y + bb.height/2;
    const top = document.elementFromPoint(mx, my);
    // walk up from the top element
    const chain = [];
    let n = top;
    while (n && chain.length < 8) { chain.push(n.tagName + '.' + (typeof n.className==='string'?n.className:n.className?.baseVal||'')); n = n.parentElement; }
    // also: what does the overlay svg's own hit testing say?
    const svg = hit.ownerSVGElement;
    const svgBB = svg.getBoundingClientRect();
    // elementFromPoint limited to overlay: check if overlay is visually on top
    const overlayZ = getComputedStyle(svg.parentElement).zIndex;
    const paneZ = getComputedStyle(document.querySelector('.react-flow__pane')).zIndex;
    const vpChildren = [...document.querySelector('.react-flow__viewport').children].map(c => c.tagName + '.' + (typeof c.className==='string'?c.className:c.className?.baseVal||''));
    return { mx, my, topTag: top?.tagName, topCls: typeof top?.className==='string'?top.className:top?.className?.baseVal, chain,
      svgRect: {x:svgBB.x,y:svgBB.y,w:svgBB.width,h:svgBB.height},
      overlayZ, paneZ, vpChildren, isTopInsideOverlay: !!(top && svg.contains(top)) };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
