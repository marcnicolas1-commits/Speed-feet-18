'use strict';
const $=id=>document.getElementById(id), uuid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2);let db;
const DB_NAME='speedfeet-v2',DB_VERSION=1;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;['settings','sessions','markers','tasks'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})})};r.onsuccess=()=>{db=r.result;res(db)};r.onerror=()=>rej(r.error)})}
function store(name,mode='readonly'){return db.transaction(name,mode).objectStore(name)}
function all(name){return new Promise((res,rej)=>{const r=store(name).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function getOne(name,id){return new Promise((res,rej)=>{const r=store(name).get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
function put(name,obj){return new Promise((res,rej)=>{const r=store(name,'readwrite').put(obj);r.onsuccess=()=>res(obj);r.onerror=()=>rej(r.error)})}
function del(name,id){return new Promise((res,rej)=>{const r=store(name,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function formatDate(v){if(!v)return'—';const d=new Date(v);return isNaN(d)?'—':d.toLocaleString('fr-FR')}
async function go(id){
  document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===id));
  document.querySelectorAll('.navbtn').forEach(x=>x.classList.toggle('active',x.dataset.go===id));
  if(id==='home')refreshDashboard();
  if(id==='logbook')renderLogbook();
  if(id==='settings')renderStorage();
  if(id==='tasks')renderTasks();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(!b)return;if(b.dataset.go==='navigate'){beginPreparation();return}go(b.dataset.go)});
document.addEventListener('click',async e=>{const card=e.target.closest('[data-dashboard]');if(!card)return;const action=card.dataset.dashboard;if(action==='sessions'){go('logbook');return}if(action==='tasks'){go('tasks');return}if(action==='backup'){go('settings');setTimeout(()=>document.querySelector('#settings .card')?.scrollIntoView({behavior:'smooth'}),50);return}if(action==='last'){const ss=(await all('sessions')).filter(s=>s.status!=='active').sort((a,b)=>(b.startedAt||b.date||'').localeCompare(a.startedAt||a.date||''));go('logbook');if(ss[0])setTimeout(()=>openSession(ss[0].id),0)}});

const defaultChecklist=['Velocitek chargé','Téléphone chargé','Gilet','Eau à bord','Bouchons et trappes vérifiés'];
async function getSetting(id,fallback){const r=await getOne('settings',id);return r?r.value:fallback}
async function setSetting(id,value){return put('settings',{id,value,updatedAt:new Date().toISOString()})}
async function getChecklist(){
  let list=await getSetting('checklist',null);
  if(!Array.isArray(list)){list=defaultChecklist.map((t,i)=>({id:'c'+i,text:t}));await setSetting('checklist',list)}
  return list.map(x=>({id:x.id||uuid(),text:x.text||String(x),done:false}));
}
async function beginPreparation(){
  const list=await getChecklist();
  await setSetting('checklist',list.map(x=>({id:x.id,text:x.text})));
  currentNavId=null;navStart=null;lastPos=null;
  $('plannedTests').value='';$('sessionGoal').selectedIndex=0;
  $('workedWell').value='';$('workedBad').value='';$('ideas').value='';$('newTask').value='';
  $('navMarkerCount').textContent='0 marqueur';$('lastVoice').textContent='Aucun';$('navClock').textContent='00:00:00';
  $('preflight').classList.remove('hidden');$('activeNav').classList.add('hidden');$('postflight').classList.add('hidden');
  await renderPreflight();
  go('navigate');
}
async function renderPreflight(){
  const list=await getChecklist();
  $('checklist').innerHTML=list.map(x=>`<div class="checkitem"><input type="checkbox" data-check="${x.id}"><div class="tasktext">${esc(x.text)}</div><button class="iconbtn" data-delcheck="${x.id}" aria-label="Supprimer">×</button></div>`).join('');
  const tasks=(await all('tasks')).filter(x=>!x.done);
  $('openTasks').innerHTML=tasks.length?tasks.map(x=>`<div class="taskitem"><div class="tasktext">⚠️ ${esc(x.text)}</div><div class="taskactions"><button class="iconbtn" data-donetask="${x.id}">Fait</button><button class="iconbtn" data-postpone="${x.id}">Reporter</button></div></div>`).join(''):'<div class="muted">Rien à signaler.</div>';
}
$('addCheck').onclick=async()=>{const t=$('newCheck').value.trim();if(!t)return;const l=await getChecklist();l.push({id:uuid(),text:t});await setSetting('checklist',l.map(({id,text})=>({id,text})));$('newCheck').value='';renderPreflight()};
document.addEventListener('click',async e=>{
  if(e.target.dataset.delcheck){
    let l=await getChecklist();l=l.filter(x=>x.id!==e.target.dataset.delcheck);
    await setSetting('checklist',l.map(({id,text})=>({id,text})));renderPreflight();
  }
  if(e.target.dataset.donetask){
    const x=await getOne('tasks',e.target.dataset.donetask);if(x){x.done=true;x.doneAt=new Date().toISOString();await put('tasks',x);renderPreflight()}
  }
  if(e.target.dataset.postpone)toast('Rappel conservé pour la prochaine sortie');
  const card=e.target.closest('[data-open-session]');if(card)openSession(card.dataset.openSession);
});

let navStart=null,navTimer=null,watchId=null,lastPos=null,currentNavId=null,selectedMarkerType='';
$('startNav').onclick=async()=>{
  navStart=new Date();currentNavId=uuid();
  await put('sessions',{id:currentNavId,type:'navigation',title:'Navigation du '+navStart.toLocaleString('fr-FR'),startedAt:navStart.toISOString(),goal:$('sessionGoal').value,plannedTests:$('plannedTests').value,status:'active',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  $('preflight').classList.add('hidden');$('activeNav').classList.remove('hidden');$('postflight').classList.add('hidden');
  navTimer=setInterval(updateClock,1000);updateClock();
  if(navigator.geolocation)watchId=navigator.geolocation.watchPosition(p=>{lastPos={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed,heading:p.coords.heading};$('gpsStatus').textContent=`GPS ±${Math.round(p.coords.accuracy)} m`},()=>{$('gpsStatus').textContent='GPS indisponible'},{enableHighAccuracy:true,maximumAge:2000,timeout:10000});
};
function updateClock(){if(!navStart)return;const s=Math.floor((Date.now()-navStart)/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),q=s%60;$('navClock').textContent=[h,m,q].map(x=>String(x).padStart(2,'0')).join(':')}
function confirmationBeep(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.setValueAtTime(.08,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.12);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.12)}catch(_){}}
function startDictation(targetId,stateId){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('Dictée non disponible : utilise le clavier');$(targetId).focus();return}const r=new SR();r.lang='fr-FR';r.interimResults=true;r.continuous=false;let base=$(targetId).value.trim();$(stateId).textContent='Écoute en cours…';confirmationBeep();r.onresult=e=>{let text='';for(let i=e.resultIndex;i<e.results.length;i++)text+=e.results[i][0].transcript;$(targetId).value=(base+(base?' ':'')+text).trim()};r.onerror=()=>{$(stateId).textContent='Dictée interrompue — tu peux écrire au clavier.'};r.onend=()=>{$(stateId).textContent='';confirmationBeep()};r.start()}
$('markBtn').onclick=()=>{selectedMarkerType='';$('markerComment').value='';$('speechState').textContent='';document.querySelectorAll('[data-marker-type]').forEach(b=>b.classList.remove('selected'));$('markerModal').classList.remove('hidden');confirmationBeep()};
$('dictateMarker').onclick=()=>startDictation('markerComment','speechState');
document.querySelectorAll('[data-marker-type]').forEach(b=>b.onclick=()=>{selectedMarkerType=b.dataset.markerType;document.querySelectorAll('[data-marker-type]').forEach(x=>x.classList.toggle('selected',x===b))});
$('cancelMarker').onclick=()=>$('markerModal').classList.add('hidden');
$('saveMarker').onclick=async()=>{
  if(!currentNavId)return;
  navigator.vibrate?.(100);
  const now=new Date(), existing=(await all('markers')).filter(x=>x.sessionId===currentNavId);
  const typeCount=selectedMarkerType?existing.filter(x=>x.type===selectedMarkerType).length+1:null;
  const label=selectedMarkerType==='tack'?`Virement ${typeCount}`:selectedMarkerType==='gybe'?`Empannage ${typeCount}`:'Marqueur';
  const note=$('markerComment').value.trim();
  await put('markers',{id:uuid(),sessionId:currentNavId,time:now.toISOString(),type:selectedMarkerType||'note',number:typeCount,note,position:lastPos,createdAt:now.toISOString()});
  $('lastVoice').textContent=note?`${label} — ${note}`:label;
  const n=existing.length+1;$('navMarkerCount').textContent=`${n} marqueur${n>1?'s':''}`;
  $('markerModal').classList.add('hidden');confirmationBeep();toast('Marqueur enregistré');
};
$('finishNav').onclick=async()=>{
  clearInterval(navTimer);if(watchId!==null)navigator.geolocation.clearWatch(watchId);
  const s=await getOne('sessions',currentNavId);if(s){s.endedAt=new Date().toISOString();s.status='debrief';s.updatedAt=new Date().toISOString();await put('sessions',s)}
  $('activeNav').classList.add('hidden');$('postflight').classList.remove('hidden');
};
async function addTask(text,sessionId=null){if(!text.trim())return;await put('tasks',{id:uuid(),sessionId,text:text.trim(),done:false,createdAt:new Date().toISOString()})}
$('addTask').onclick=async()=>{await addTask($('newTask').value,currentNavId);$('newTask').value='';toast('Point ajouté')};
$('saveDebrief').onclick=async()=>{
  const s=await getOne('sessions',currentNavId);if(!s)return;
  s.debrief={workedWell:$('workedWell').value.trim(),workedBad:$('workedBad').value.trim(),ideas:$('ideas').value.trim()};
  s.status='finished';s.updatedAt=new Date().toISOString();await put('sessions',s);
  $('workedWell').value='';$('workedBad').value='';$('ideas').value='';$('newTask').value='';
  currentNavId=null;toast('Navigation enregistrée');go('home');
};


async function renderTasks(){
  const tasks=(await all('tasks')).filter(x=>!x.done).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const sessions=await all('sessions'),byId=Object.fromEntries(sessions.map(s=>[s.id,s]));
  $('allTasks').innerHTML=tasks.length?tasks.map(t=>{const s=byId[t.sessionId];return `<div class="taskitem"><div class="tasktext"><b>${esc(t.text)}</b><div class="muted">${s?esc(s.title||'Navigation')+' — '+formatDate(s.startedAt||s.date):'Tâche générale'}${t.postponedAt?' — reportée':''}</div></div><div class="taskactions"><button class="iconbtn" data-taskdone="${t.id}">Fait</button><button class="iconbtn" data-taskpostpone="${t.id}">Reporter</button><button class="iconbtn" data-taskdelete="${t.id}">×</button></div></div>`}).join(''):'<div class="muted">Aucun point à faire.</div>';
}
document.addEventListener('click',async e=>{if(e.target.dataset.taskdone){const t=await getOne('tasks',e.target.dataset.taskdone);if(t){t.done=true;t.doneAt=new Date().toISOString();await put('tasks',t);await renderTasks();await refreshDashboard()}}if(e.target.dataset.taskpostpone){const t=await getOne('tasks',e.target.dataset.taskpostpone);if(t){t.postponedAt=new Date().toISOString();await put('tasks',t);toast('Point reporté');await renderTasks()}}if(e.target.dataset.taskdelete){if(confirm('Supprimer définitivement ce point ?')){await del('tasks',e.target.dataset.taskdelete);await renderTasks();await refreshDashboard()}}});

async function renderLogbook(){
  $('sessionList').parentElement.classList.remove('hidden');
  $('sessionDetail').classList.add('hidden');$('sessionDetail').innerHTML='';
  const ss=(await all('sessions')).filter(s=>s.status!=='active').sort((a,b)=>(b.startedAt||b.date||'').localeCompare(a.startedAt||a.date||''));
  const markers=await all('markers');
  $('sessionList').innerHTML=ss.length?ss.map(s=>{const n=markers.filter(m=>m.sessionId===s.id).length;return `<div class="taskitem sessioncard" data-open-session="${s.id}"><div class="tasktext"><b>${esc(s.title||'Navigation')}</b><div class="muted">${formatDate(s.startedAt||s.date)}${s.duration?` — ${fmtDuration(s.duration)}`:''} — ${n} marqueur${n>1?'s':''}</div></div><div>›</div></div>`}).join(''):'Aucune sortie.';
}
async function openSession(id){
  const s=await getOne('sessions',id);if(!s)return;
  const ms=(await all('markers')).filter(m=>m.sessionId===id).sort((a,b)=>a.time.localeCompare(b.time));
  $('sessionDetail').classList.remove('hidden');
  $('sessionDetail').innerHTML=`<div class="card">
    <button id="backLog" class="btn secondary" style="margin-bottom:12px">← Retour</button>
    <label>Titre de la navigation</label><div class="row"><input id="detailTitle" class="grow" value="${esc(s.title||'Navigation')}"><button id="saveTitle" class="btn">Enregistrer</button></div>
    <div class="detailrow"><b>Date</b><div class="muted">${formatDate(s.startedAt||s.date)}</div></div>
    <div class="detailrow"><b>Objectif</b><div class="muted">${esc(s.goal||'—')}</div></div>
    <div class="detailrow"><b>Essais prévus</b><div class="muted">${esc(s.plannedTests||'—')}</div></div>
    <div class="detailrow"><b>Marqueurs (${ms.length})</b><div>${ms.length?ms.map(m=>`<div class="taskitem"><div class="tasktext"><b>${m.type==='tack'?'Virement '+m.number:m.type==='gybe'?'Empannage '+m.number:'Marqueur'}</b><div class="muted">${new Date(m.time).toLocaleTimeString('fr-FR')}${m.note?' — '+esc(m.note):''}</div></div><button class="iconbtn" data-delmarker="${m.id}" data-session="${id}">×</button></div>`).join(''):'<div class="muted">Aucun marqueur.</div>'}</div></div>
    <div class="detailrow"><b>Débriefing</b><div class="muted"><strong>Bien marché :</strong> ${esc(s.debrief?.workedWell||'—')}<br><strong>Moins bien :</strong> ${esc(s.debrief?.workedBad||'—')}<br><strong>Idées :</strong> ${esc(s.debrief?.ideas||'—')}</div></div>
    ${s.points?.length?`<div class="detailrow"><b>Analyse VCC</b><div class="muted">${esc(s.fileName||'Fichier VCC associé')} — ${s.points.length.toLocaleString('fr-FR')} points GPS</div><div class="row" style="margin-top:8px"><button id="openVccAnalysis" class="btn good">Ouvrir l’analyse</button><label class="btn secondary" style="cursor:pointer;color:white">Remplacer le VCC<input id="sessionVccFile" type="file" accept=".vcc,.xml,text/xml,application/xml" style="display:none"></label></div></div>`:`<div class="detailrow"><b>VCC et analyse</b><div class="muted">Aucun fichier VCC associé à cette navigation.</div><label class="btn good" style="display:inline-block;margin-top:8px;cursor:pointer">Ajouter un VCC et analyser<input id="sessionVccFile" type="file" accept=".vcc,.xml,text/xml,application/xml" style="display:none"></label></div>`}
    <div class="dangerzone"><button id="deleteSession" class="btn bad" style="width:100%">Supprimer cette navigation</button></div>
  </div>`;
  $('sessionList').parentElement.classList.add('hidden');
  $('backLog').onclick=()=>{$('sessionList').parentElement.classList.remove('hidden');renderLogbook()};
  $('saveTitle').onclick=async()=>{s.title=$('detailTitle').value.trim()||'Navigation';s.updatedAt=new Date().toISOString();await put('sessions',s);toast('Titre enregistré')};
  if($('openVccAnalysis'))$('openVccAnalysis').onclick=()=>loadStoredAnalysis(s);
  if($('sessionVccFile'))$('sessionVccFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{loadedFileName=f.name;allSessions=parseVcc(await f.text());current=allSessions[0];$('attachSession').value=id;go('analyze');analyzeCurrent();await saveAnalysisToSession(id);toast('VCC associé à la navigation')}catch(err){alert(err.message)}finally{e.target.value=''}};
  document.querySelectorAll('[data-delmarker]').forEach(b=>b.onclick=async()=>{if(confirm('Êtes-vous sûr de vouloir supprimer ce marqueur ?')){await del('markers',b.dataset.delmarker);openSession(b.dataset.session)}});
  $('deleteSession').onclick=async()=>{if(!confirm('Êtes-vous sûr de vouloir supprimer cette navigation et toutes ses données ?'))return;for(const m of ms)await del('markers',m.id);await del('sessions',id);toast('Navigation supprimée');$('sessionList').parentElement.classList.remove('hidden');renderLogbook();refreshDashboard()};
}
async function refreshDashboard(){
  const ss=(await all('sessions')).filter(s=>s.status!=='active'),ts=(await all('tasks')).filter(x=>!x.done);
  $('dSessions').textContent=ss.length;$('dTasks').textContent=ts.length;
  const recent=ss.sort((a,b)=>(b.startedAt||b.date||'').localeCompare(a.startedAt||a.date||'')).slice(0,5);
  $('dLastSession').textContent=recent[0]?new Date(recent[0].startedAt||recent[0].date).toLocaleDateString('fr-FR'):'Jamais';
  const lastBackup=await getSetting('lastBackup',null);$('dBackup').textContent=lastBackup?new Date(lastBackup).toLocaleDateString('fr-FR'):'Jamais';
  $('recentSessions').innerHTML=recent.length?recent.map(s=>`<div class="taskitem sessioncard" data-go="logbook" data-open-session="${s.id}"><div class="tasktext"><b>${esc(s.title||'Navigation enregistrée')}</b><div class="muted">${formatDate(s.startedAt||s.date)}</div></div><div>›</div></div>`).join(''):'Aucune sortie enregistrée.';
  await populateAttachSessions();
}
async function populateAttachSessions(){
  const sel=$('attachSession');if(!sel)return;
  const ss=(await all('sessions')).filter(s=>s.type==='navigation').sort((a,b)=>(b.startedAt||'').localeCompare(a.startedAt||''));
  sel.innerHTML='<option value="">Créer une nouvelle navigation analysée</option>'+ss.map(s=>`<option value="${s.id}">${esc(s.title||'Navigation')} — ${new Date(s.startedAt).toLocaleString('fr-FR')}</option>`).join('');
}
async function renderStorage(){const ss=await all('sessions'),ms=await all('markers'),ts=await all('tasks');$('storageInfo').textContent=`${ss.length} sortie(s), ${ms.length} marqueur(s), ${ts.length} rappel(s) dans cette base locale.`}
$('exportData').onclick=async()=>{
  const data={format:'speedfeet-backup',schemaVersion:2,exportedAt:new Date().toISOString(),stores:{settings:await all('settings'),sessions:await all('sessions'),markers:await all('markers'),tasks:await all('tasks')}};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`SpeedFeet_Backup_${new Date().toISOString().slice(0,10)}.sfbackup`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);await setSetting('lastBackup',new Date().toISOString());renderStorage();refreshDashboard();toast('Sauvegarde créée');
};
$('importData').onchange=async e=>{
  try{
    const f=e.target.files[0];if(!f)return;const d=JSON.parse(await f.text());if(d.format!=='speedfeet-backup')throw Error('Fichier incompatible');
    const mode=confirm('Appuie sur OK pour FUSIONNER avec les données présentes.\nAppuie sur Annuler pour remplacer toutes les données.')?'merge':'replace';
    if(mode==='replace'){for(const name of ['settings','sessions','markers','tasks']){for(const row of await all(name))await del(name,row.id)}}
    for(const [name,rows] of Object.entries(d.stores||{})){if(!['settings','sessions','markers','tasks'].includes(name))continue;for(const row of rows)await put(name,row)}
    toast('Sauvegarde importée');await refreshDashboard();await renderStorage();await renderPreflight();
  }catch(err){alert(err.message)}finally{e.target.value=''}
};

let allSessions=[],current=[],map=null,replayMarker=null,trail=null,timer=null,playing=false,idx=0,maneuvers=[],eventLayer=null,loadedFileName='';
const norm360=a=>((a%360)+360)%360,angDiff=(a,b)=>{let d=Math.abs(norm360(a)-norm360(b));return d>180?360-d:d},signedWindSide=(h,w)=>{let d=norm360(h-w);return d>180?d-360:d};
function parseTime(s){const d=new Date(s);return isNaN(d)?null:d}function havNm(a,b){const R=3440.065,r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLon=(b.lon-a.lon)*r,la1=a.lat*r,la2=b.lat*r,h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}function fmtDuration(sec){sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${h} h ${String(m).padStart(2,'0')} min`:`${m} min ${String(s).padStart(2,'0')} s`}
function colorForSpeed(v){const t=Math.max(0,Math.min(12,Math.floor(v*2)/2));const hue=230-(t/12)*190;return `hsl(${hue} 78% 52%)`}
function parseVcc(text){const xml=new DOMParser().parseFromString(text,'application/xml');if(xml.querySelector('parsererror'))throw Error('Le fichier VCC/XML ne peut pas être lu.');const nodes=[...xml.getElementsByTagName('*')].filter(n=>n.localName==='Trackpoint'),pts=nodes.map(n=>({lat:Number(n.getAttribute('latitude')),lon:Number(n.getAttribute('longitude')),speed:Number(n.getAttribute('speed')||0),heading:Number(n.getAttribute('heading')||0),time:parseTime(n.getAttribute('dateTime')||'')})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));if(!pts.length)throw Error('Aucun point GPS trouvé.');return splitSessions(pts)}
function splitSessions(pts){const out=[];let cur=[pts[0]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],gap=a.time&&b.time?(b.time-a.time)/1000:0;if(gap>1800){out.push(cur);cur=[b]}else cur.push(b)}out.push(cur);return out.filter(s=>s.length>3)}
function calcStats(s){let distance=0,max=0,sum=0,n=0;for(let i=1;i<s.length;i++)distance+=havNm(s[i-1],s[i]);for(const p of s){max=Math.max(max,p.speed);if(p.speed>.5){sum+=p.speed;n++}}return{distance,max,avg:n?sum/n:0,duration:s[0].time&&s.at(-1).time?(s.at(-1).time-s[0].time)/1000:0}}
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}function detectManeuvers(s,wind){const f=[];let last=-999;for(let i=5;i<s.length-5;i++){if(s[i].speed<1)continue;const b=signedWindSide(avg(s.slice(i-4,i).map(p=>p.heading)),wind),a=signedWindSide(avg(s.slice(i+1,i+5).map(p=>p.heading)),wind),bc=Math.abs(b)<105?'tack':(Math.abs(b)>125?'gybe':'mid'),ac=Math.abs(a)<105?'tack':(Math.abs(a)>125?'gybe':'mid');if(bc==='mid'||bc!==ac||Math.sign(b)===Math.sign(a)||i-last<12)continue;const rot=angDiff(avg(s.slice(i-4,i).map(p=>p.heading)),avg(s.slice(i+1,i+5).map(p=>p.heading)));if(rot<45)continue;f.push({type:bc,index:i,lat:s[i].lat,lon:s[i].lon,time:s[i].time});last=i}let t=0,g=0;f.forEach(m=>m.number=m.type==='tack'?++t:++g);return f}
$('file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;loadedFileName=f.name;allSessions=parseVcc(await f.text());$('sessionSelect').innerHTML=allSessions.map((s,i)=>`<option value="${i}">${s[0].time?s[0].time.toLocaleDateString('fr-FR'):'Session '+(i+1)} — ${fmtDuration(calcStats(s).duration)}</option>`).join('');$('sessionSelect').classList.toggle('hidden',allSessions.length<=1);$('analyzeBtn').disabled=false;$('status').textContent=`${allSessions.length} session(s) détectée(s)`}catch(err){$('status').textContent=err.message}};
$('analyzeBtn').onclick=analyzeCurrent;$('sessionSelect').onchange=analyzeCurrent;
function analyzeCurrent(){current=allSessions[Number($('sessionSelect').value)||0];const st=calcStats(current),wind=Number($('windDir').value)||0;maneuvers=detectManeuvers(current,wind);$('results').classList.remove('hidden');$('sDate').textContent=current[0].time?current[0].time.toLocaleDateString('fr-FR'):'—';$('sDuration').textContent=fmtDuration(st.duration);$('sDistance').textContent=st.distance.toFixed(2)+' nm';$('sMax').textContent=st.max.toFixed(2)+' nd';$('sAvg').textContent=st.avg.toFixed(2)+' nd';$('sTacks').textContent=maneuvers.filter(x=>x.type==='tack').length;$('sGybes').textContent=maneuvers.filter(x=>x.type==='gybe').length;$('sPoints').textContent=current.length.toLocaleString('fr-FR');$('timeline').max=current.length-1;drawMap();updateReplay(0)}
function drawMap(){if(map)map.remove();map=L.map('map',{preferCanvas:true});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);const ll=current.map(p=>[p.lat,p.lon]);map.fitBounds(ll,{padding:[20,20]});for(let i=1;i<current.length;i++)L.polyline([[current[i-1].lat,current[i-1].lon],[current[i].lat,current[i].lon]],{color:colorForSpeed((current[i-1].speed+current[i].speed)/2),weight:4,opacity:.9}).addTo(map);maneuvers.forEach(m=>{const p=m.type==='tack'?'V':'E',point=current[m.index],label=m.type==='tack'?'Virement':'Empannage',details=`<b>${label} ${m.number}</b><br>Heure : ${point?.time?point.time.toLocaleTimeString('fr-FR'):'—'}<br>Vitesse : ${Number(point?.speed||0).toFixed(1)} nd<br>Cap : ${Math.round(point?.heading||0)}°`;const icon=L.divIcon({className:'',html:`<div class="maneuver-icon maneuver-${m.type}">${p}${m.number}</div>`,iconSize:[28,28],iconAnchor:[14,14]});L.marker([m.lat,m.lon],{icon}).bindTooltip(details,{sticky:true}).bindPopup(details).addTo(map)});trail=L.polyline([],{color:'#fff',weight:5}).addTo(map);replayMarker=L.circleMarker(ll[0],{radius:9,color:'#fff',weight:3,fillColor:'#111',fillOpacity:1}).addTo(map);setTimeout(()=>map.invalidateSize(),100)}
function updateReplay(i,pan=false){idx=Math.max(0,Math.min(current.length-1,Number(i)));$('timeline').value=idx;const p=current[idx],w=Number($('windDir').value)||0;replayMarker.setLatLng([p.lat,p.lon]);trail.setLatLngs(current.slice(Math.max(0,idx-120),idx+1).map(x=>[x.lat,x.lon]));if(pan)map.panTo([p.lat,p.lon],{animate:false});$('lTime').textContent=p.time?p.time.toLocaleTimeString('fr-FR'):'—';$('lSpeed').textContent=p.speed.toFixed(1)+' nd';$('lHeading').textContent=Math.round(p.heading)+'°';$('lTwa').textContent=Math.round(angDiff(p.heading,w))+'°'}
function stopReplay(){playing=false;clearInterval(timer);$('play').textContent='▶ Lecture'}function startReplay(){playing=true;$('play').textContent='⏸ Pause';timer=setInterval(()=>{idx+=Number($('rate').value);if(idx>=current.length){idx=current.length-1;stopReplay()}updateReplay(idx,true)},100)}$('timeline').oninput=e=>{stopReplay();updateReplay(e.target.value,true)};$('play').onclick=()=>playing?stopReplay():startReplay();$('reset').onclick=()=>{stopReplay();updateReplay(0,true)};
async function saveAnalysisToSession(attachId=''){if(!current.length)return null;const st=calcStats(current),date=current[0].time?.toISOString()||new Date().toISOString();let s=attachId?await getOne('sessions',attachId):null;if(!s)s={id:uuid(),type:'navigation',title:'Navigation analysée du '+new Date(date).toLocaleString('fr-FR'),startedAt:date,createdAt:new Date().toISOString()};Object.assign(s,{fileName:loadedFileName,date,startedAt:s.startedAt||date,endedAt:current.at(-1).time?.toISOString(),distance:st.distance,duration:st.duration,maxSpeed:st.max,avgSpeed:st.avg,windDir:Number($('windDir').value)||0,windSpeed:Number($('windSpeed').value)||0,points:current.map(p=>({...p,time:p.time?.toISOString?.()||p.time})),maneuvers,status:'finished',updatedAt:new Date().toISOString()});await put('sessions',s);await refreshDashboard();await populateAttachSessions();return s}
async function loadStoredAnalysis(s){current=(s.points||[]).map(p=>({...p,time:p.time?new Date(p.time):null}));if(!current.length)return;loadedFileName=s.fileName||'';$('windDir').value=s.windDir||0;$('windSpeed').value=s.windSpeed||0;maneuvers=s.maneuvers?.length?s.maneuvers:detectManeuvers(current,Number($('windDir').value)||0);go('analyze');$('results').classList.remove('hidden');const st=calcStats(current);$('sDate').textContent=current[0].time?current[0].time.toLocaleDateString('fr-FR'):'—';$('sDuration').textContent=fmtDuration(st.duration);$('sDistance').textContent=st.distance.toFixed(2)+' nm';$('sMax').textContent=st.max.toFixed(2)+' nd';$('sAvg').textContent=st.avg.toFixed(2)+' nd';$('sTacks').textContent=maneuvers.filter(x=>x.type==='tack').length;$('sGybes').textContent=maneuvers.filter(x=>x.type==='gybe').length;$('sPoints').textContent=current.length.toLocaleString('fr-FR');$('timeline').max=current.length-1;drawMap();updateReplay(0);$('attachSession').value=s.id;$('status').textContent='Analyse chargée depuis le carnet'}
$('saveSession').onclick=async()=>{await saveAnalysisToSession($('attachSession').value);toast('Analyse enregistrée dans le carnet')};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
openDB().then(()=>{refreshDashboard();populateAttachSessions();$('dbState').textContent='Base locale prête'}).catch(e=>{$('dbState').textContent='Erreur de base';console.error(e)});
