import DiceBox from './dice-box.es.min.js';
import DisplayResults from './display-results.js';

const THEME_COLORS = {
  vfHope: '#f4c542', vfFear: '#8b5cf6', vfDamage: '#c92a38', vfNeutral: '#168ca8',
  vfBioHope: '#ffffff', vfBioFear: '#ffffff', vfBioDamage: '#ffffff', vfDiscarded: '#ffffff',
  vfPlainHope: '#ffffff', vfPlainFear: '#ffffff', vfPlainDamage: '#ffffff', vfPlainNeutral: '#ffffff'
};
const PRELOAD_THEMES = [
  'vfHope','vfFear','vfDamage','vfNeutral','vfBioHope','vfBioFear','vfBioDamage','vfDiscarded',
  'vfPlainHope','vfPlainFear','vfPlainDamage','vfPlainNeutral'
];
const ASSET_PATH = new URL('./assets/', import.meta.url).href;

const VF_DICE_RELEASE = 'v59.81';
async function assertWebAssemblyExecutionAllowed(){
  if (typeof WebAssembly === 'undefined' || typeof WebAssembly.compile !== 'function') {
    const error=new Error('3D dice require WebAssembly, but this browser does not expose WebAssembly.compile().');
    error.code='VF_WASM_UNAVAILABLE';
    throw error;
  }
  // Minimal valid empty WebAssembly module. Compilation is intentionally tested before
  // Ammo starts so a stale/overridden CSP fails immediately instead of timing out.
  const emptyModule=new Uint8Array([0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00]);
  try { await WebAssembly.compile(emptyModule); }
  catch (cause) {
    const error=new Error("3D dice WebAssembly is blocked by the effective Content Security Policy. Deploy v59.81 from the package root and verify the HTML response contains X-VeilFarers-Release: v59.81 and script-src 'wasm-unsafe-eval'.");
    error.code='VF_WASM_CSP_BLOCKED';
    error.cause=cause;
    window.dispatchEvent(new CustomEvent('veilfarers:dice3d-error',{detail:{code:error.code,release:VF_DICE_RELEASE,message:error.message}}));
    throw error;
  }
}
console.info(`[VeilFarers ${VF_DICE_RELEASE}] 3D dice loader active`, {assetPath: ASSET_PATH, cspProfile:'wasm-3d-dice-v2'});

let box = null;
let display = null;
let initPromise = null;
let stage = null;
let labelNode = null;
let outcomeNode = null;
let analysisNode = null;
let cueLayer = null;
let trackingLayer = null;
let settledLayer = null;
let resizeObserver = null;
let resizeRaf = 0;
let cueRefreshRaf = 0;
let trackingRaf = 0;
let telemetryAt = 0;
let closeTimer = null;
let lastError = null;
let currentStyle = 'overlay';
let currentCritical = false;
let lastFlat = [];
let cueTransitionToken = 0;
let activeCueSpecs = [];
let trackingSpecs = [];
let trackerNodes = new Map();
let projectionWarningShown = false;
let lastRendererVisuals = [];
let rollPending = false;
let rollHasResult = false;
let userDismissed = false;
let activeRollController = null;
let rollSequence = 0;

function normalizeStyle(value){ return value === 'box' ? 'box' : 'overlay'; }
function valuesEqual(a,b){ return String(a) === String(b); }
function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
function escapeHtml(value){
  return String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}
function roleKind(role,theme){
  const source=`${role || ''} ${theme || ''}`.toLowerCase();
  if (source.includes('hope')) return 'hope';
  if (source.includes('fear')) return 'fear';
  if (source.includes('damage')) return 'damage';
  return 'neutral';
}
function tinyHex(){ return Math.floor(Math.random()*0xffff).toString(16).toUpperCase().padStart(4,'0'); }
function telemetryText(spec){
  const px=(20+Math.random()*160).toFixed(2);
  const py=(20+Math.random()*160).toFixed(2);
  const vector=(Math.random()).toFixed(3);
  const entropy=(35+Math.random()*63).toFixed(1);
  return `QSTATE ${tinyHex()} · X ${px} · Y ${py} · VEC ${vector} · ENT ${entropy} · SIG ${spec.kind.toUpperCase()}`;
}
function scheduleCueRefresh(){
  cancelAnimationFrame(cueRefreshRaf);
  cueRefreshRaf=requestAnimationFrame(()=>requestAnimationFrame(()=>{
    renderTrackingFrame(true);
    renderActiveCues();
  }));
}
function scheduleResize(){
  cancelAnimationFrame(resizeRaf);
  resizeRaf=requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      try { box && typeof box.resizeWorld === 'function' && box.resizeWorld(); }
      catch(error){ console.warn('3D dice resize failed:', error); }
      scheduleCueRefresh();
    });
  });
}
function applyStyle(value){
  currentStyle = normalizeStyle(value);
  if (!stage) return;
  stage.classList.toggle('is-overlay', currentStyle === 'overlay');
  stage.classList.toggle('is-boxed', currentStyle !== 'overlay');
  stage.dataset.style = currentStyle;
  stage.classList.toggle('is-critical', currentCritical);
  scheduleResize();
}
function applyCritical(value){
  currentCritical = !!value;
  if (stage) stage.classList.toggle('is-critical', currentCritical);
}
function ensureStage(){
  if (stage) return stage;
  stage=document.createElement('section');
  stage.id='vf-dice3d-stage';
  stage.className='vf-dice3d-stage is-hidden is-overlay';
  stage.setAttribute('aria-label','VeilFarers 3D dice roller');
  stage.innerHTML=`
    <div class="vf-dice3d-shell">
      <div id="vf-dice3d-box" class="vf-dice3d-box"></div>
      <header class="vf-dice3d-hud">
        <div><span class="vf-dice3d-kicker">3D ROLL</span><strong id="vf-dice3d-label">Rolling…</strong><span id="vf-dice3d-outcome" class="vf-dice3d-outcome is-hidden"></span></div>
        <button type="button" id="vf-dice3d-close" aria-label="Close 3D dice">×</button>
      </header>
      <aside id="vf-dice3d-analysis" class="vf-dice3d-analysis is-hidden" aria-live="polite"></aside>
      <footer>Powered by @3d-dice/dice-box + DisplayResults · MIT</footer>
    </div>`;
  document.body.append(stage);
  labelNode=stage.querySelector('#vf-dice3d-label');
  outcomeNode=stage.querySelector('#vf-dice3d-outcome');
  analysisNode=stage.querySelector('#vf-dice3d-analysis');
  const closeButton=stage.querySelector('#vf-dice3d-close');
  closeButton.addEventListener('pointerdown',event=>{
    event.preventDefault();
    event.stopPropagation();
    hide({reason:'user',fallback2D:rollPending && !rollHasResult});
  },true);
  const dismissFromPointer=event=>{
    if (!stage || stage.classList.contains('is-hidden')) return;
    if (event.target && event.target.closest && event.target.closest('#vf-dice3d-close')) return;
    // En modo overlay, no interrumpir la física de los dados mientras ruedan
    if (currentStyle === 'overlay' && rollPending && !rollHasResult) return;
    // Permitir descartar tras asentarse haciendo clic en el banner o resultado
    if (!rollPending || rollHasResult) {
      if (event.target && (event.target.closest('.vf-results') || event.target.closest('.vf-dice3d-outcome') || currentStyle !== 'overlay')) {
        event.preventDefault();
        event.stopPropagation();
        hide({reason:'user'});
      }
    }
  };
  stage.addEventListener('pointerdown',dismissFromPointer,true);
  display=new DisplayResults('#vf-dice3d-box');
  cueLayer=document.createElement('div');
  cueLayer.className='vf-dice-cue-layer';
  cueLayer.setAttribute('aria-hidden','true');
  trackingLayer=document.createElement('div');
  trackingLayer.className='vf-dice-tracking-layer';
  settledLayer=document.createElement('div');
  settledLayer.className='vf-dice-settled-layer';
  cueLayer.append(trackingLayer,settledLayer);
  stage.querySelector('#vf-dice3d-box').append(cueLayer);
  const shell=stage.querySelector('.vf-dice3d-shell');
  if ('ResizeObserver' in window && shell) {
    resizeObserver=new ResizeObserver(scheduleResize);
    resizeObserver.observe(shell);
  }
  window.addEventListener('resize',scheduleResize,{passive:true});
  window.addEventListener('orientationchange',scheduleResize,{passive:true});
  applyStyle(currentStyle);
  return stage;
}
async function init(){
  if (box) return box;
  if (initPromise) return initPromise;
  ensureStage();
  initPromise=(async()=>{
    await assertWebAssemblyExecutionAllowed();
    box=new DiceBox({
      container:'#vf-dice3d-box', assetPath:ASSET_PATH, origin:'', theme:'vfNeutral', preloadThemes:PRELOAD_THEMES,
      scale:5.4, gravity:1.6, mass:1.2, friction:0.88, restitution:0.35, spinForce:4.5, throwForce:5.2,
      startingHeight:7.5, settleTimeout:2800, delay:10, lightIntensity:1.15, enableShadows:true,
      shadowTransparency:0.72, offscreen:false
    });
    await box.init();
    scheduleResize();
    lastError=null;
    return box;
  })().catch(err=>{
    box=null; initPromise=null; lastError=err;
    console.error('VeilFarers 3D dice initialization failed:', err);
    throw err;
  });
  return initPromise;
}
function show(label, style, options={}){
  ensureStage();
  if (options.newRoll !== false) userDismissed=false;
  applyStyle(style || currentStyle);
  if (labelNode) labelNode.textContent=label || 'Rolling…';
  stage.classList.remove('is-hidden');
  stage.classList.add('is-visible');
  clearTimeout(closeTimer);
  try { box && box.show(); } catch(_) {}
  scheduleResize();
}
function clearOutcomeCues(){
  cueTransitionToken++;
  activeCueSpecs=[];
  if (settledLayer) settledLayer.replaceChildren();
  trackerNodes.forEach(node=>{
    node.classList.remove('is-locking','is-winner','is-critical','is-rejected','is-discarding','is-discarded');
    const state=node.querySelector('.vf-tracker-state');
    if (state) state.textContent=node.classList.contains('is-settled')?'SCAN COMPLETE':'GATHERING DATA';
  });
  try { box && typeof box.setDiceVisuals === 'function' && box.setDiceVisuals([]); }
  catch(error) { console.warn('Could not reset settled 3D die visuals:', error); }
  lastRendererVisuals=[];
  if (stage) stage.classList.remove('has-discarded-die','has-winner-cue');
}
function clearSettledCues(){
  clearOutcomeCues();
  cancelAnimationFrame(trackingRaf);
  trackingRaf=0;
  trackingSpecs=[];
  trackerNodes.clear();
  if (trackingLayer) trackingLayer.replaceChildren();
  if (stage) stage.classList.remove('is-acquiring','is-resolving');
}
function hide(options={}){
  if (!stage) return;
  const manual=options && options.reason==='user';
  const fallback2D=manual && rollPending && !rollHasResult && (!options || options.fallback2D!==false);
  if (manual) userDismissed=true;
  const cancelled=manual && rollPending && !rollHasResult ? cancelActiveRoll(fallback2D?'user-fallback-2d':'user-dismissed') : false;
  clearSettledCues();
  stage.classList.remove('is-visible');
  stage.classList.add('is-hidden');
  if (!rollPending && !cancelled) { try { box && box.clear(); } catch(_) {} }
  if (outcomeNode) { outcomeNode.textContent=''; outcomeNode.className='vf-dice3d-outcome is-hidden'; }
  if (analysisNode) { analysisNode.className='vf-dice3d-analysis is-hidden'; analysisNode.replaceChildren(); }
  if (stage) delete stage.dataset.dualityWinner;
  if (manual) window.dispatchEvent(new CustomEvent('veilfarers:dice3d-closed',{detail:{rollPending,cancelled,fallback2D,resultPreserved:rollHasResult}}));
}
function flattenResults(result){
  const flat=[];
  const addRoll=(roll,groupIndex,rollIndex,group)=>{
    if (!roll || typeof roll !== 'object') return;
    const value=Number(roll.value ?? roll.result ?? roll.roll);
    const sides=Number(roll.sides ?? roll.die);
    if (!Number.isFinite(value)) return;
    flat.push({
      value, sides:Number.isFinite(sides)?sides:null,
      groupIndex:Number.isFinite(Number(roll.groupId))?Number(roll.groupId):groupIndex,
      rollIndex:Number.isFinite(Number(roll.rollId))?Number(roll.rollId):rollIndex,
      theme:roll.theme || (group && group.theme) || '', raw:roll
    });
  };
  const groups=Array.isArray(result)?result:[result];
  groups.filter(Boolean).forEach((group,groupIndex)=>{
    if (Array.isArray(group)) return group.forEach((roll,rollIndex)=>addRoll(roll,groupIndex,rollIndex,null));
    if (Array.isArray(group.rolls)) return group.rolls.forEach((roll,rollIndex)=>addRoll(roll,groupIndex,rollIndex,group));
    if (group.rolls && typeof group.rolls === 'object') return Object.values(group.rolls).forEach((roll,rollIndex)=>addRoll(roll,groupIndex,rollIndex,group));
    addRoll(group,groupIndex,0,null);
  });
  return flat;
}
function trackingSpecsFromGroups(groups,offset=0){
  const specs=[];
  let index=offset;
  (groups || []).forEach((group,groupIndex)=>{
    const qty=Math.max(1,Number(group.qty)||1);
    for(let dieIndex=0;dieIndex<qty;dieIndex++){
      const role=String(group.role || 'Die');
      specs.push({index:index++,groupIndex,dieIndex,role,kind:roleKind(role,group.theme),theme:group.theme,sides:Number(group.sides)||null});
    }
  });
  return specs;
}
function trackerMarkup(spec){
  const id=`vf-track-path-${spec.index}-${Math.random().toString(36).slice(2,7)}`;
  return `
    <svg class="vf-tracker-svg" viewBox="0 0 200 200" aria-hidden="true">
      <defs><path id="${id}" d="M100 100 m-82 0 a82 82 0 1 1 164 0 a82 82 0 1 1 -164 0"/></defs>
      <circle class="vf-track-circle vf-track-circle-a" cx="100" cy="100" r="75"/>
      <circle class="vf-track-circle vf-track-circle-b" cx="100" cy="100" r="61"/>
      <circle class="vf-track-dashes" cx="100" cy="100" r="86"/>
      <text class="vf-track-arc-text"><textPath href="#${id}" startOffset="0%">${escapeHtml(telemetryText(spec))}</textPath></text>
    </svg>
    <i class="vf-track-orbit"></i><i class="vf-track-crosshair"></i><i class="vf-track-sweep"></i>
    <span class="vf-tracker-role">${escapeHtml(spec.role)}</span>
    <span class="vf-tracker-state">GATHERING DATA</span>
    <span class="vf-tracker-readout"><b>QSTATE</b><em>${tinyHex()}</em><b>VECTOR</b><em>${(Math.random()).toFixed(3)}</em></span>
    <span class="vf-scan-aperture">${Array.from({length:8},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</span>`;
}
function createTrackerNode(spec){
  if (!trackingLayer) return null;
  const node=document.createElement('span');
  node.className=`vf-dice-tracker is-gathering role-${spec.kind}`;
  node.dataset.dieIndex=String(spec.index);
  node.innerHTML=trackerMarkup(spec);
  trackingLayer.append(node);
  trackerNodes.set(spec.index,node);
  return node;
}
function readSettledPositions(){
  if (!box || typeof box.getDiceScreenPositions !== 'function') return [];
  try { return box.getDiceScreenPositions() || []; }
  catch(error){
    if (!projectionWarningShown) {
      projectionWarningShown=true;
      console.warn('Could not project 3D dice for visual cues:',error);
    }
    return [];
  }
}
function positionForDie(index,positions){
  const source=lastFlat[index] && lastFlat[index].raw;
  if (source) {
    const exact=positions.find(item=>valuesEqual(item.rollId,source.rollId) && (item.groupId == null || source.groupId == null || valuesEqual(item.groupId,source.groupId)));
    if (exact) return exact;
    const byRoll=positions.find(item=>valuesEqual(item.rollId,source.rollId));
    if (byRoll) return byRoll;
  }
  return positions[index] || null;
}
function updateTrackerTelemetry(node,spec){
  const text=node.querySelector('.vf-track-arc-text textPath');
  if (text) text.textContent=telemetryText(spec);
  const values=node.querySelectorAll('.vf-tracker-readout em');
  if (values[0]) values[0].textContent=tinyHex();
  if (values[1]) values[1].textContent=(Math.random()).toFixed(3);
}
function renderTrackingFrame(force=false){
  if (!trackingSpecs.length || !trackingLayer) return;
  const positions=readSettledPositions();
  const now=performance.now();
  const shouldUpdateTelemetry=now >= telemetryAt;
  if (shouldUpdateTelemetry) telemetryAt=now+84;
  trackingSpecs.forEach(spec=>{
    const node=trackerNodes.get(spec.index);
    if (!node) return;
    const position=positionForDie(spec.index,positions);
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      node.classList.add('is-unlocated');
      return;
    }
    node.classList.remove('is-unlocated');
    const radius=clamp(Number(position.radius)||42,24,106);
    const size=clamp(radius*3.05,86,286);
    node.style.width=`${size}px`;
    node.style.height=`${size}px`;
    node.style.transform=`translate3d(${position.x-size/2}px,${position.y-size/2}px,0)`;
    node.style.setProperty('--die-radius',`${radius}px`);
    if (shouldUpdateTelemetry) updateTrackerTelemetry(node,spec);
  });
  if (!force && stage && stage.classList.contains('is-acquiring')) trackingRaf=requestAnimationFrame(()=>renderTrackingFrame(false));
}
function startTracking(groups,{append=false}={}){
  ensureStage();
  const offset=append?trackingSpecs.length:0;
  if (!append) {
    trackingSpecs=[];
    trackerNodes.clear();
    if (trackingLayer) trackingLayer.replaceChildren();
  }
  const next=trackingSpecsFromGroups(groups,offset);
  trackingSpecs.push(...next);
  next.forEach(createTrackerNode);
  if (stage) { stage.classList.add('is-acquiring'); stage.classList.remove('is-resolving'); }
  cancelAnimationFrame(trackingRaf);
  trackingRaf=requestAnimationFrame(()=>renderTrackingFrame(false));
  return next;
}
function markTrackingSettled(indices){
  if (stage) { stage.classList.remove('is-acquiring'); stage.classList.add('is-resolving'); }
  cancelAnimationFrame(trackingRaf);
  trackingRaf=0;
  renderTrackingFrame(true);
  const wanted=Array.isArray(indices)?new Set(indices):null;
  trackerNodes.forEach((node,index)=>{
    if (wanted && !wanted.has(index)) return;
    node.classList.remove('is-gathering');
    node.classList.add('is-settled');
    const state=node.querySelector('.vf-tracker-state');
    if (state) state.textContent='SCAN COMPLETE';
  });
}
function prepareGroups(groups){
  return (Array.isArray(groups)?groups:[groups]).map(group=>{
    const theme=group.theme || 'vfNeutral';
    return {...group, theme, themeColor:group.themeColor || THEME_COLORS[theme] || '#ffffff'};
  });
}
function createFallbackResult(groups, reason='user-dismissed'){
  const flat=[];
  (groups || []).forEach((group,groupIndex)=>{
    const qty=Math.max(1,Number(group.qty)||1);
    const sides=Math.max(2,Number(group.sides)||20);
    for(let dieIndex=0;dieIndex<qty;dieIndex++){
      const value=Math.floor(Math.random()*sides)+1;
      flat.push({
        value,sides,groupIndex,rollIndex:dieIndex,theme:group.theme||'',
        raw:{value,sides,groupId:groupIndex,rollId:`vf-cancel-${rollSequence}-${groupIndex}-${dieIndex}`,cancelled:true}
      });
    }
  });
  return {kind:'cancelled',cancelled:true,reason,flat,values:flat.map(item=>item.value)};
}
function settlePendingDiceBoxPromises(){
  try {
    const pending=box && box.rollCollectionData && typeof box.rollCollectionData==='object'
      ? Object.values(box.rollCollectionData) : [];
    pending.forEach(collection=>{
      if (collection && typeof collection.resolve==='function') collection.resolve([]);
    });
  } catch(error) { console.warn('Could not settle dismissed DiceBox promises:',error); }
}
function cancelActiveRoll(reason='user-dismissed'){
  const controller=activeRollController;
  if (!controller || controller.cancelled) return false;
  controller.cancelled=true;
  const fallback=createFallbackResult(controller.groups,reason);
  controller.fallback=fallback;
  // DiceBox.clear() stops the current worker simulation but does not resolve its
  // internal Promise. The wrapper-owned cancellation Promise resolves the game
  // roll immediately, so closing the HUD can never leave Player Tool waiting.
  settlePendingDiceBoxPromises();
  try { box && box.clear(); } catch(error) { console.warn('Could not stop dismissed 3D dice physics:',error); }
  controller.resolve(fallback);
  return true;
}
function beginCancellableRoll(groups){
  const token=++rollSequence;
  let resolveCancel;
  const cancellation=new Promise(resolve=>{ resolveCancel=resolve; });
  activeRollController={token,groups,cancelled:false,fallback:null,resolve:resolveCancel};
  return {token,cancellation};
}
function endCancellableRoll(token){
  if (activeRollController && activeRollController.token===token) activeRollController=null;
  rollPending=!!activeRollController;
}
async function roll(groups, options={}){
  const roller=await init();
  if (userDismissed) { try { box && box.clear(); } catch(_) {} }
  clearSettledCues();
  applyCritical(false);
  show(options.label || 'Rolling…', options.style, {newRoll:true});
  rollHasResult=false;
  const prepared=prepareGroups(groups);
  const {token,cancellation}=beginCancellableRoll(prepared);
  rollPending=true;
  try {
    const rendererPromise=Promise.resolve(roller.roll(prepared)).then(result=>({kind:'renderer',result}));
    startTracking(prepared);
    let outcome=await Promise.race([rendererPromise,cancellation]);
    const controller=activeRollController && activeRollController.token===token ? activeRollController : null;
    if (controller && controller.cancelled && controller.fallback) outcome=controller.fallback;
    if (outcome && outcome.kind==='cancelled') {
      lastFlat=outcome.flat.slice();
      return {raw:null,flat:outcome.flat,values:outcome.values,cancelled:true,reason:outcome.reason};
    }
    const result=outcome.result;
    const flat=flattenResults(result);
    lastFlat=flat.slice();
    rollHasResult=flat.length>0;
    if (!flat.length) throw new Error('The 3D engine completed without readable die results.');
    markTrackingSettled(flat.map((_,index)=>index));
    if (!options.deferResults) display.showResults({
      rolls:flat.map((item,index)=>({value:item.value,sides:item.sides,role:trackingSpecs[index] && trackingSpecs[index].role})),
      value:flat.reduce((n,item)=>n+item.value,0), label:options.label || ''
    });
    closeTimer=setTimeout(hide,9800);
    return {raw:result, flat, values:flat.map(item=>item.value)};
  } finally { endCancellableRoll(token); }
}
async function add(groups, options={}){
  const roller=await init();
  if (!userDismissed) show(options.label || 'Additional dice', options.style, {newRoll:false});
  const prepared=prepareGroups(groups);
  rollHasResult=false;
  const offset=lastFlat.length;
  const {token,cancellation}=beginCancellableRoll(prepared);
  rollPending=true;
  try {
    const rendererPromise=Promise.resolve(roller.add(prepared)).then(result=>({kind:'renderer',result}));
    const newSpecs=startTracking(prepared,{append:true});
    let outcome=await Promise.race([rendererPromise,cancellation]);
    const controller=activeRollController && activeRollController.token===token ? activeRollController : null;
    if (controller && controller.cancelled && controller.fallback) outcome=controller.fallback;
    if (outcome && outcome.kind==='cancelled') {
      lastFlat=lastFlat.concat(outcome.flat);
      return {raw:null,flat:outcome.flat,values:outcome.values,offset,cancelled:true,reason:outcome.reason};
    }
    const result=outcome.result;
    const flat=flattenResults(result);
    rollHasResult=flat.length>0;
    lastFlat=lastFlat.concat(flat);
    const indices=flat.map((_,index)=>offset+index);
    markTrackingSettled(indices);
    if (!options.deferResults) display.showResults({
      rolls:flat.map((item,index)=>({value:item.value,sides:item.sides,role:newSpecs[index] && newSpecs[index].role})),
      value:flat.reduce((n,item)=>n+item.value,0), label:options.label || ''
    });
    closeTimer=setTimeout(hide,9800);
    return {raw:result, flat, values:flat.map(item=>item.value), offset};
  } finally { endCancellableRoll(token); }
}
function cueKey(spec){ return `${spec.type}:${spec.index}`; }
function applyRendererCues(){
  if (!box || typeof box.setDiceVisuals !== 'function') return [];
  const visuals=activeCueSpecs.filter(spec=>spec.type!=='rejected').map(spec=>{
    const raw=lastFlat[spec.index] && lastFlat[spec.index].raw;
    return { index:spec.index, type:spec.type, rollId:raw && raw.rollId, groupId:raw && raw.groupId };
  });
  try { lastRendererVisuals=box.setDiceVisuals(visuals) || []; return lastRendererVisuals; }
  catch(error){ lastRendererVisuals=[]; console.warn('Could not apply settled 3D die visuals:',error); return []; }
}
function animateTrackerCue(spec){
  const node=trackerNodes.get(spec.index);
  if (!node) return false;
  const state=node.querySelector('.vf-tracker-state');
  if (spec.type==='winner' || spec.type==='critical') {
    node.classList.add('is-locking');
    if (state) state.textContent='IDENTIFYING VECTOR';
    setTimeout(()=>{
      if (!node.isConnected) return;
      node.classList.remove('is-locking');
      node.classList.add(spec.type==='critical'?'is-critical':'is-winner');
      if (state) state.textContent=spec.type==='critical'?'DUALITY CONVERGENCE':'OUTCOME VECTOR LOCKED';
    },420);
  } else if (spec.type==='rejected') {
    node.classList.add('is-rejected');
    if (state) state.textContent='PROBABILITY BRANCH REJECTED';
  } else if (spec.type==='discard') {
    node.classList.add('is-discarding');
    if (state) state.textContent='DEACTIVATING DAMAGE VECTOR';
    setTimeout(()=>{
      if (!node.isConnected) return;
      node.classList.remove('is-discarding');
      node.classList.add('is-discarded');
      if (state) state.textContent='QUANTUM PROBABILITY FAILED';
    },520);
  }
  return true;
}
function activateCue(spec){
  const key=cueKey(spec);
  if (!activeCueSpecs.some(item=>cueKey(item)===key)) activeCueSpecs.push(spec);
  const handled=animateTrackerCue(spec);
  if (!handled) renderActiveCues();
  if (spec.type==='winner' || spec.type==='critical') {
    setTimeout(applyRendererCues,340);
  } else if (spec.type==='discard') {
    setTimeout(applyRendererCues,500);
  } else {
    applyRendererCues();
  }
}
function renderActiveCues(){
  if (!settledLayer || !activeCueSpecs.length) {
    if (settledLayer) settledLayer.replaceChildren();
    return;
  }
  const positions=readSettledPositions();
  if (!positions.length) return;
  settledLayer.replaceChildren();
  activeCueSpecs.forEach(spec=>{
    if (trackerNodes.has(spec.index)) return;
    const position=positionForDie(spec.index,positions);
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    const radius=clamp(Number(position.radius)||42,22,118);
    const cue=document.createElement('span');
    cue.className=`vf-dice-settled-cue is-${spec.type}`;
    cue.style.left=`${position.x-radius}px`; cue.style.top=`${position.y-radius}px`;
    cue.style.width=`${radius*2}px`; cue.style.height=`${radius*2}px`;
    const visibleValue=lastFlat[spec.index] && lastFlat[spec.index].value;
    cue.innerHTML=`<b>${Number.isFinite(Number(visibleValue))?Number(visibleValue):''}</b><small>${escapeHtml(spec.label||'')}</small>`;
    settledLayer.append(cue);
    requestAnimationFrame(()=>cue.classList.add('is-active'));
  });
  if (stage) {
    stage.classList.toggle('has-discarded-die',activeCueSpecs.some(spec=>spec.type==='discard'));
    stage.classList.toggle('has-winner-cue',activeCueSpecs.some(spec=>spec.type==='winner'||spec.type==='critical'));
  }
}
function scheduleSettledCues(data){
  const rolls=Array.isArray(data && data.rolls)?data.rolls:[];
  const outcome=String((data && data.outcome)||'').toUpperCase();
  const critical=!!(data && data.crit) || /CRITICAL/.test(outcome);
  const token=cueTransitionToken;
  const winnerSpecs=[];
  const rejectedSpecs=[];
  if (critical) {
    rolls.forEach((roll,index)=>{
      const role=String((roll && roll.role)||'').toLowerCase();
      if (role==='hope' || role==='fear') winnerSpecs.push({index,type:'critical',label:'CRIT'});
    });
    if (!winnerSpecs.length && rolls.length===2) winnerSpecs.push({index:0,type:'critical',label:'CRIT'},{index:1,type:'critical',label:'CRIT'});
  } else if (/^WITH (HOPE|FEAR)$/.test(outcome)) {
    const roleWanted=outcome.includes('HOPE')?'hope':'fear';
    const winnerIndex=rolls.findIndex(roll=>String((roll && roll.role)||'').toLowerCase()===roleWanted);
    const loserRole=roleWanted==='hope'?'fear':'hope';
    const loserIndex=rolls.findIndex(roll=>String((roll && roll.role)||'').toLowerCase()===loserRole);
    if (winnerIndex>=0) winnerSpecs.push({index:winnerIndex,type:'winner',label:roleWanted.toUpperCase()});
    if (loserIndex>=0) rejectedSpecs.push({index:loserIndex,type:'rejected',label:'REJECTED'});
  }
  const discardSpecs=[];
  rolls.forEach((roll,index)=>{
    if (roll && (roll.drop || roll.status==='discarded' || String(roll.role||'').toUpperCase()==='DROP')) {
      discardSpecs.push({index,type:'discard',label:'DROP'});
    }
  });
  if (winnerSpecs.length) setTimeout(()=>{
    if (token!==cueTransitionToken) return;
    winnerSpecs.forEach(activateCue);
  },180);
  if (rejectedSpecs.length) setTimeout(()=>{
    if (token!==cueTransitionToken) return;
    rejectedSpecs.forEach(activateCue);
  },620);
  if (discardSpecs.length) setTimeout(()=>{
    if (token!==cueTransitionToken) return;
    discardSpecs.forEach(activateCue);
  },760);
}
function renderAnalysisPanel(data){
  if (!analysisNode) return;
  const outcome=String((data && data.outcome)||'').trim();
  const hope=Number(data && data.hope);
  const fear=Number(data && data.fear);
  const damageDice=Array.isArray(data && data.damageDiceResults)?data.damageDiceResults:[];
  const damage=Number(data && data.damage);
  if (!outcome && !damageDice.length) {
    analysisNode.className='vf-dice3d-analysis is-hidden';
    analysisNode.replaceChildren();
    return;
  }
  const outcomeClass=/HOPE/i.test(outcome)?'hope':/FEAR/i.test(outcome)?'fear':/CRITICAL/i.test(outcome)?'critical':'neutral';
  const duality=Number.isFinite(hope)&&Number.isFinite(fear)
    ? `<div class="vf-analysis-duality"><span>HOPE <b>${hope}</b></span><i>${hope===fear?'=':hope>fear?'&gt;':'&lt;'}</i><span>FEAR <b>${fear}</b></span></div>` : '';
  const damageRows=damageDice.length?`<div class="vf-analysis-damage"><small>DAMAGE VECTOR</small><div>${damageDice.map(die=>`<span class="${die.status==='discarded'?'is-drop':'is-keep'}">${escapeHtml(die.status==='discarded'?'DROP':'KEEP')} <b>${Number(die.value)}</b></span>`).join('')}</div>${Number.isFinite(damage)?`<strong>${damage}</strong>`:''}</div>`:'';
  analysisNode.className=`vf-dice3d-analysis is-${outcomeClass}`;
  analysisNode.innerHTML=`<span class="vf-analysis-kicker">TACTICAL SOLUTION</span><b class="vf-analysis-outcome">${escapeHtml(outcome || 'DAMAGE RESOLVED')}</b>${duality}${damageRows}<small class="vf-analysis-status">VECTOR TELEMETRY LOCKED · Q-FLUX ${(Math.random()*9).toFixed(3)}e-3</small>`;
}
function showResults(data){
  ensureStage();
  if (!userDismissed) show(data && data.label, data && data.style, {newRoll:false});
  clearOutcomeCues();
  const outcome=String((data && data.outcome)||'');
  const winner=/WITH HOPE/i.test(outcome)?'hope':/WITH FEAR/i.test(outcome)?'fear':/CRITICAL/i.test(outcome)?'critical':'';
  if (stage) { if (winner) stage.dataset.dualityWinner=winner; else delete stage.dataset.dualityWinner; }
  if (outcomeNode) {
    outcomeNode.textContent=outcome;
    outcomeNode.className=`vf-dice3d-outcome ${winner?`is-${winner}`:'is-hidden'}`;
  }
  applyCritical(!!(data && data.crit));
  renderAnalysisPanel(data || {});
  display.showResults(data || {});
  scheduleSettledCues({...(data||{}),rolls:Array.isArray(data && data.cueRolls)?data.cueRolls:(data && data.rolls)});
  scheduleResize();
  clearTimeout(closeTimer);
  closeTimer=setTimeout(hide,9800);
}

window.VFDice3D={
  init,roll,add,showResults,hide,setStyle:applyStyle,setCritical:applyCritical,
  status:()=>({
    ready:!!box,assetPath:ASSET_PATH,style:currentStyle,critical:currentCritical,
    rendererVisuals:lastRendererVisuals.slice(),tracking:trackingSpecs.length,rollPending,rollHasResult,userDismissed,activeRoll:activeRollController?activeRollController.token:null,error:lastError?String(lastError.message||lastError):null
  }),
  version:'@3d-dice/dice-box 1.1.4 + DisplayResults 0.5.2 + VeilFarers quantum HUD v59.81'
};
