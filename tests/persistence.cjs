// Run with NODE_PATH pointing to the runtime dependencies and a local HTTP server.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const server=require('node:http').createServer((req,res)=>{
   const path=require('node:path').join(process.cwd(),new URL(req.url,'http://localhost').pathname === '/' ? 'index.html' : new URL(req.url,'http://localhost').pathname);
   const mime=path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html';
   try {res.setHeader('Content-Type',mime);res.end(fs.readFileSync(path));} catch {res.statusCode=404;res.end();}
 });
 await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
 const launchOptions = {headless:true};
 if (process.env.CHROMIUM_EXECUTABLE) launchOptions.executablePath=process.env.CHROMIUM_EXECUTABLE;
 const browser = await chromium.launch(launchOptions);
 const context = await browser.newContext();
 await context.route('**/app.js?*', route => {
   let source = fs.readFileSync('app.js','utf8');
   source = source.replace('    if (\n        document.readyState ===', `    globalThis.testApp = {state, navigationStore, startNavigation, finishNavigation, persistNavigation, persistAchievements, buildBackup, applyImportedBackup, abandonCurrentNavigationAndPrepare};\n    if (\n        document.readyState ===`);
   return route.fulfill({body:source,contentType:'application/javascript'});
 });
 await context.route('**/unpkg.com/**',route=>route.abort());
 await context.addInitScript(() => {
   navigator.geolocation.watchPosition = () => 1;
   navigator.geolocation.clearWatch = () => {};
 });
 let page = await context.newPage();
 page.on('dialog',dialog=>dialog.dismiss());
 const url='http://127.0.0.1:8765';
 await page.goto(url);
 await page.waitForFunction(()=>globalThis.testApp?.state.currentPage === 'homePage');
 await page.evaluate(async()=>{
   await testApp.startNavigation({windAverage:10,windDirection:90});
   const n=testApp.state.currentNavigation;
   n.startedAt=new Date(Date.now()-3*3600000).toISOString();
   for(let i=0;i<10800;i++) {
     n.track.push({latitude:48.3+i/1000000,longitude:-4.4,timestamp:new Date(Date.now()-10800000+i*1000).toISOString(),speedKn:6,heading:0});
     if(i%5===4) await testApp.navigationStore.checkpoint(n);
   }
   n.distanceNm=18.5;n.maxSpeedKn=9.5;
   await testApp.navigationStore.checkpoint(n);
   testApp.persistAchievements();
 });
 const savedIds=await page.evaluate(()=>JSON.parse(localStorage.getItem('speedfeet_achievements')));
 assert(savedIds.includes('single-180'));
 await page.close(); // No finish action; new page has new JS heap.
 page=await context.newPage(); page.on('dialog',d=>d.dismiss());
 await page.goto(url);
 await page.waitForFunction(()=>globalThis.testApp?.state.currentNavigation?.track.length===10800);
 assert.equal(await page.evaluate(()=>testApp.state.history.length),0);
 // Abort final transaction: neither history nor current journal may be lost.
 await page.evaluate(async()=>{
   const store=testApp.navigationStore;
   const original=store.transaction.bind(store);
   store.transaction=action=>original((state,points)=>{action(state,points);state.transaction.abort();});
   await testApp.finishNavigation();
   store.transaction=original;
 });
 assert.equal(await page.evaluate(()=>testApp.state.currentNavigation.track.length),10800);
 assert.equal(await page.evaluate(()=>testApp.state.history.length),0);
 assert.match(await page.locator('#navigationStorageStatus').textContent(),/non finalisée/);
 await page.close();
 page=await context.newPage(); page.on('dialog',d=>d.dismiss()); await page.goto(url);
 await page.waitForFunction(()=>globalThis.testApp?.state.currentNavigation?.track.length===10800);
 await page.evaluate(()=>testApp.finishNavigation());
 assert.equal(await page.evaluate(()=>testApp.state.currentNavigation),null);
 assert.equal(await page.evaluate(()=>testApp.state.history[0].track.length),10800);
 await page.close();
 page=await context.newPage(); await page.goto(url);
 await page.waitForFunction(()=>globalThis.testApp?.state.history.length===1);
 assert.equal(await page.evaluate(()=>testApp.state.currentNavigation),null);
 assert.deepEqual(await page.evaluate(()=>testApp.buildBackup().data.achievementIds),savedIds);
 // Verify legacy migration separately, including large data stored under old keys.
 const legacy=await browser.newContext();
 await legacy.addInitScript(()=>{
   if (!localStorage.getItem('seeded')) {
     localStorage.setItem('speedfeet_history',JSON.stringify([{id:'old',status:'completed',track:[]}])) ;
     localStorage.setItem('speedfeet_current_navigation',JSON.stringify({id:'legacy',status:'running',track:[{latitude:48,longitude:-4}],markers:[],trimRecords:[],windRecords:[],startedAt:new Date().toISOString()}));
     localStorage.setItem('seeded','yes');
   }
 });
 const lp=await legacy.newPage();await lp.goto(url);
 await lp.waitForFunction(()=>!localStorage.getItem('speedfeet_current_navigation'));
 const journal=await lp.evaluate(async()=>{ const store=new NavigationStore();await store.open();return store.load(); });
 assert.equal(journal.current.track.length,1); assert.equal(journal.history[0].id,'old');
 // Checkpoint abort preserves prior points and retries the missing suffix once.
 await lp.evaluate(async()=>{
   const store=new NavigationStore('retry-test');await store.open();
   const n={id:'retry',status:'running',track:[{n:0}]};
   await store.replace(n,[]);
   const original=store.transaction.bind(store);
   n.track.push({n:1});
   store.transaction=action=>original((state,points)=>{action(state,points);state.transaction.abort();});
   try { await store.checkpoint(n); throw new Error('Expected abort'); }
   catch(error) { if(error.message==='Expected abort') throw error; }
   const before=await store.load();
   if(before.current.track.length!==1) throw new Error('Aborted checkpoint leaked');
   store.transaction=original;
   await store.checkpoint(n);await store.checkpoint(n);
   if((await store.load()).current.track.length!==2) throw new Error('Duplicate/missing suffix');
   await store.replace(null,[]);
   if((await store.load()).current!==null) throw new Error('Abandon resurrected');
 });
 // If startup cannot open storage, old navigation must remain untouched.
 const blocked=await browser.newContext();
 await blocked.addInitScript(()=>{
   localStorage.setItem('speedfeet_current_navigation',JSON.stringify({id:'protected',status:'running',track:[]}));
   indexedDB.open=()=>{throw new Error('Storage unavailable')};
 });
 const bp=await blocked.newPage();await bp.goto(url);
 await bp.waitForFunction(()=>document.getElementById('navigationStorageStatus')?.textContent.includes('indisponible'));
 assert.equal(await bp.evaluate(()=>JSON.parse(localStorage.getItem('speedfeet_current_navigation')).id),'protected');
 console.log('PASS: 3h / 10800 points, abrupt close, independent achievements, failed finalization, retry without duplicates, migration, aborted checkpoint retry, abandon, unavailable storage.');
 await browser.close();
 server.close();
})().catch(error=>{console.error(error);process.exit(1)});
