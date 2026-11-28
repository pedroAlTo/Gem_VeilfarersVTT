import './space.css';
import { escapeHTML as esc, sanitizeHTML, notify } from '../ui.js';
import { ARCS, BANDS, DRIVES, MOVES, ROLES, WEAPONS, FRIENDLY_WEAPONS, bandLabel, crewEvasion, evasionSources, crewEligible, inRange, moveBand, publicEncounter, sensorDC } from './encounter.js';
import { createMap2D } from './map2d.js';

const text = value => esc(String(value ?? ''));
const btn = (act,value,label,active=false,disabled=false) =>
  `<button type="button" data-nav="${act}" data-value="${text(value)}" ${active?'aria-pressed="true"':''} ${disabled?'disabled':''}>${text(label)}</button>`;
const chips = (items,act,value) => Object.entries(items).map(([id,name])=>btn(act,id,name,id===value)).join('');
const stat = (label,val,max,color) => `<div class="nv-stat"><span>${label}</span><i style="--fill:${Math.min(100,100*val/Math.max(1,max))}%;--ink:${color}"></i><b>${val}/${max}</b></div>`;
const arcs = shield => `<div class="nv-arcs">${Object.entries(ARCS).map(([id,label])=>`<span>${label}<b>${shield[id]}/${shield.maxPerArc}</b></span>`).join('')}</div>`;

export function mountNavalScreen(viewport, store, network) {
  const root=document.createElement('section');
  root.className='naval-screen';root.setAttribute('aria-label','Combate espacial');(viewport.querySelector('.map-safe-area') || viewport).append(root);
  root.innerHTML='<div class="nv-map"></div><div class="nv-hud"></div><div class="nv-live" role="status" aria-live="polite"></div>';
  const surface=root.querySelector('.nv-map'),hud=root.querySelector('.nv-hud'),live=root.querySelector('.nv-live');
  let role='pilot',target='skarrh',move='aggressive',arc='fore',weapon='plasma',height=2,camera='orbital',engineering='cool',underFire=false;
  let view=null,busy=false,disposed=false,fallback=false,settings=false,lastMapKey='',lastLive='';
  function read() {
    const s=store.state, map=store.getActiveMap(), keeper=store.sessionRole!=='player' && s.userRole==='keeper';
    const n=keeper?map.naval:publicEncounter(map.naval);
    const ship=s.starship;
    if (!n.contacts.some(c=>c.id===target)) target=n.contacts[0]?.id || '';
    if (!keeper && role==='keeper') role='pilot';
    const contact=n.contacts.find(c=>c.id===target), actor=s.tokens.find(t=>t.id===n.crew[role]);
    const paused=!!s.roomPaused || (store.sessionRole==='player' && !s.isConnected);
    const allowed=!busy && !paused && actor && crewEligible(actor,map.id) && (keeper || store.canEditToken(actor.id)) && !n.spent[role];
    return {s,map,keeper,n,ship,contact,actor,paused,allowed};
  }
  function pick(id){target=id;refresh();}
  function useFallback() {
    if(disposed)return;
    view?.dispose();fallback=true;camera='top';view=createMap2D(surface,pick);lastMapKey='';refresh();
  }
  function refresh(){
    if(disposed || !store.getActiveMap()?.naval)return;
    const {s,n,ship,contact,actor,keeper,paused,allowed}=read();
    const mapKey=JSON.stringify([n,s.userRole,ship.name,ship.shieldArcs,role,target,move,height,arc,keeper]);
    if(view && lastMapKey!==mapKey){lastMapKey=mapKey;view.update({ n,ship,role,target,move,height,arc,keeper,preview:role==='pilot' && !n.spent.pilot });}
    const focus=document.activeElement,focusKey=hud.contains(focus)?[focus?.dataset?.nav,focus?.dataset?.value]:null;
    const evasion=evasionSources(ship,n,s.tokens);
    const ready=!!allowed && !!n.drive && ship.hull>0;
    const enemy=role==='keeper', enemyShip=keeper && contact?.privateShip;
    const stations=Object.entries(ROLES).map(([id,label])=>{
      const who=s.tokens.find(t=>t.id===n.crew[id]);
      return btn('role',id,(n.spent[id]?'✓ ':'')+label+(who?' · '+who.name.split(' ')[0]:''),role===id);
    }).join('');
    let options='',summary='',outcomes='',primary='';
    if (role==='pilot') {
      const dest=contact && moveBand(contact.band,MOVES[move].step), dc=move==='evade'&&underFire?15:MOVES[move].dc;
      options=Object.entries(MOVES).map(([id,m])=>btn('move',id,m.name,id===move)).join('');
      options+=`<div class="nv-options">${chips(ARCS,'arc',arc)}${move==='evade'?btn('fire','',underFire?'Bajo fuego ✓':'Bajo fuego',underFire):''}</div>`;
      summary=`${contact?.band||'—'} → ${dest||'—'} · ${ARCS[arc]} · Instinct ${(actor?.traits?.instinct||0)>=0?'+':''}${actor?.traits?.instinct||0} · Motor +${DRIVES[n.drive]?.bonus||0} · DC ${dc}`;
      outcomes=`<div class="nv-payout"><span><b>Éxito</b> ${MOVES[move].hit}</span><span><b>Crítico</b> Además, Ventaja al próximo disparo.</span><span><b>Fallo con Hope</b> Mantén banda y rumbo.</span><span><b>Fallo con Fear</b> ${n.drive==='Overdrive'?'+1 Calor y Primary Drive pierde 1 Integrity.':'+1 Calor y arco expuesto.'}</span></div>`;
      primary=btn('act','','Tirar maniobra',false,!ready || !dest || contact?.kind!=='ship' || (move==='broadside' && !['port','starboard'].includes(arc)));
    } else if(role==='gunner'){
      options=FRIENDLY_WEAPONS.map(w=>btn('weapon',w,WEAPONS[w].name,weapon===w)).join('')+'<div class="nv-options">'+chips(ARCS,'arc',arc)+'</div>';
      const w=WEAPONS[weapon],legal=contact?.kind==='ship' && inRange(w,contact.band);
      summary=w.qty+'d'+w.sides+' × MR '+ship.mountRating+' · '+ARCS[arc]+' · '+(legal?'En alcance':'Fuera de alcance');
      outcomes='<span class="nv-muted">'+(contact?.locked?'Sensor Lock · Ventaja en este disparo':'Finesse')+' · Artillería +'+(n.pilotEffect.attack||0)+'</span>';
      primary=btn('act','','Disparar',false,!ready||!legal||!(ship.systems?.Weapons>0));
    } else if(role==='engineer'){
      options=btn('engineering','cool','Enfriar sistemas',engineering==='cool')+btn('engineering','vent','Ventilar',engineering==='vent');
      summary='Calor '+ship.heat+' → '+Math.max(0,ship.heat-(engineering==='vent'?5:3))+' / '+ship.heatCap;
      outcomes='<span class="nv-muted">'+(engineering==='vent'?'La nave queda Visible una ronda.':'Hasta 3 de Calor menos. Una acción de Ingeniería.')+'</span>';
      primary=btn('act','','Aplicar',false,!ready);
    } else if(role==='sensors'){
      options=BANDS.map(b=>`<span class="nv-dc ${contact?.band===b?'is-current':''}">${b} <b>${sensorDC(b)}</b></span>`).join('');
      summary='Sensor Lock · Knowledge · DC '+(contact?sensorDC(contact.band):'—');
      outcomes='<span class="nv-muted">Ventaja al próximo disparo de esta nave contra el blanco fijado.</span>';
      primary=btn('act','','Fijar blanco',false,!ready || contact?.kind!=='ship' || !(ship.systems?.['Sensor Array']>0));
    } else if(enemyShip){
      const free=!busy&&!paused&&!!n.drive&&enemyShip.hull>0;
      options=btn('enemy','open','Abrir distancia',false,!free||enemyShip.acted.pilot||!moveBand(contact.band,1))+btn('enemy','close','Cerrar distancia',false,!free||enemyShip.acted.pilot||!moveBand(contact.band,-1))+
        enemyShip.weapons.map(w=>btn('enemy',w,WEAPONS[w].name,false,!free||!!enemyShip.acted[w]||!inRange(WEAPONS[w],contact.band))).join('')+
        btn('enemy','cool','Enfriar sistemas',false,!free||enemyShip.acted.system);
      summary=contact.name+' · arco objetivo '+ARCS[arc];outcomes='<div class="nv-options">'+chips(ARCS,'arc',arc)+'</div>';
    }
    if(enemy)primary=btn('round','','Cerrar ronda',false,busy||paused||!n.drive);
    const canDrive=!busy&&!paused&&(keeper || (role==='pilot' && allowed));
    const controls = !n.drive ? '<div class="nv-drives"><b>Motor</b>'+Object.keys(DRIVES).map(id=>btn('drive',id,id+' · +'+DRIVES[id].heat+' Calor',false,!canDrive)).join('')+'</div>' : '';
    const crewControls=keeper&&settings?'<div class="nv-crew">'+Object.entries(ROLES).map(([id,label])=>`<label>${label}<vf-select data-seat="${id}" class="hud-select"><option value="">Sin asignar</option>${s.tokens.filter(t=>crewEligible(t,s.activeMapId)).map(t=>`<option value="${text(t.id)}" ${n.crew[id]===t.id?'selected':''}>${text(t.name)}</option>`).join('')}</vf-select></label>`).join('')+'</div>':'';
    const contactList=n.contacts.map(c=>`<button type="button" data-nav="target" data-value="${text(c.id)}" aria-pressed="${c.id===target}" class="${c.kind}"><i>${c.kind==='ship'?'△':'◇'}</i><span>${text(c.name)}<small>${c.locked?'SENSOR LOCK':c.kind==='ship'?'Hostil':'Neutral'}</small></span><b>${bandLabel(c.band)}</b></button>`).join('');
    hud.innerHTML=sanitizeHTML(`<div class="nv-top"><div><span class="nv-overline">Combate espacial</span><strong>Ronda ${n.round}</strong>${n.drive?`<span class="nv-mode">Motor ${n.drive}</span>`:''}</div><div class="nv-cam">${btn('camera','orbital','Orbital',camera==='orbital',fallback)}${btn('camera','top','Cenital',camera==='top')}</div></div>
    <aside class="nv-contacts nv-card"><h3>Contactos</h3>${contactList}</aside>
    ${contact?.kind==='ship'?`<aside class="nv-target nv-card"><small>OBJETIVO</small><h3>${text(contact.name)}</h3><span>${bandLabel(contact.band)} · ${contact.locked?'Sensor Lock':'Sin fijar'}</span>${enemyShip?`${stat('Casco',enemyShip.hull,enemyShip.maxHull,'#f196a2')}${stat('Calor',enemyShip.heat,enemyShip.heatCap,'#d9a0d4')}<span>Evasión ${enemyShip.evasion}</span>${arcs(enemyShip.shieldArcs)}`:`<small>${contact.visibleDamage?'Daños visibles':'Sin daños visibles'}</small>`}</aside>`:''}
    <div class="nv-bottom"><section class="nv-own nv-card"><small>NAVE</small><h3>${text(ship.name)}</h3>${stat('Casco',ship.hull,ship.maxHull,'#78edfa')}${stat('Calor',ship.heat,ship.heatCap,'#dfa2ce')}<span>Evasión <b>${crewEvasion(ship,n,s.tokens)}</b></span><div class="nv-evade">Base ${evasion.base} · Instinct ${evasion.instinct} · Motor ${evasion.drive}${evasion.maneuver?' · Maniobra '+evasion.maneuver:''}</div>${arcs(ship.shieldArcs)}${n.pilotEffect.exposed?`<small>Expuesto · ${ARCS[n.pilotEffect.exposed]}</small>`:''}</section>
    <section class="nv-dock nv-card"><nav aria-label="Puestos">${stations}${keeper?btn('role','keeper','Keeper',enemy)+btn('seats','','Asignar puestos',settings):''}</nav>${crewControls}${controls}
      <div class="nv-row"><div><small>${enemy?'KEEPER':text(ROLES[role])}</small><h3>${text(role==='pilot'?MOVES[move].name:role==='gunner'?WEAPONS[weapon].name:role==='sensors'?'Sensor Lock':role==='engineer'?'Ingeniería':'Turno enemigo')}</h3></div><div class="nv-submit">${primary}</div></div>
      <div class="nv-summary">${text(summary)}</div><div class="nv-options">${options}</div>${outcomes}
      ${role==='pilot'&&!n.spent.pilot?`<div class="nv-height">Altura visual ${btn('height','-1','−',false,height<=-3)} <b>${height>0?'+':''}${height} km</b> ${btn('height','1','+',false,height>=3)}</div>`:''}
      <div class="nv-feedback">${text(paused?'Sala en pausa · esperando al Keeper':busy?'Resolviendo…':!enemy&&n.spent[role]?'Spotlight usado':!enemy&&!actor?'Puesto sin asignar':n.note)}</div>
    </section></div>`);
    if(focusKey?.[0]) [...hud.querySelectorAll('button')].find(b=>b.dataset.nav===focusKey[0] && b.dataset.value===focusKey[1])?.focus({preventScroll:true});
    if(n.note!==lastLive){live.textContent=n.note;lastLive=n.note;}
  }
  async function send(order,extra={},stationAction=false) {
    if(busy || disposed)return;
    const {map,n,actor,ship,contact}=read();
    const payload={type:stationAction?'NAVAL_STATION':'NAVAL_KEEPER',mapId:map.id,round:n.round,revision:n.revision,order,station:role,
      actorId:actor?.id,contactId:target,arc,move,weapon,underFire,...extra};
    busy=true;refresh();
    try{
      if(stationAction && order!=='drive' && role!=='engineer'){
        const groups=[{qty:1,sides:12,role:'Hope',theme:'vfHope'},{qty:1,sides:12,role:'Fear',theme:'vfFear'}];
        if(ship.hull<=2 || (role==='gunner' && (contact?.locked || n.pilotEffect.aim || (n.pilotEffect.flankId===target&&n.pilotEffect.flankArc===arc)))) groups.push({qty:1,sides:6,role:'Edge',theme:'vfNeutral'});
        const faces=await window.veilDiceRoller?.roll3D?.(groups,ROLES[role]);if(Array.isArray(faces))payload.faces=faces;
      }
      if(disposed || store.getActiveMap()?.id!==map.id)return;
      const result=await network.requestAction(payload);
      if(result.hopeVal!=null && result.dc!=null)window.veilDiceRoller?.showResult?.(result);
      if(!disposed)live.textContent=result.navalOutcome;
    }catch(error){notify(error.message,'error');if(!disposed)live.textContent=error.message;}
    finally{busy=false;refresh();}
  }
  hud.onclick=e=>{
    const b=e.target.closest('button[data-nav]');if(!b || b.disabled)return;
    const {nav,value}=b.dataset;
    if(nav==='target'){pick(value);return;}
    if(nav==='camera'){camera=value;view?.camera(camera);}
    if(nav==='role')role=value;
    if(nav==='move')move=value;
    if(nav==='arc')arc=value;
    if(nav==='weapon')weapon=value;
    if(nav==='height')height=Math.max(-3,Math.min(3,height+Number(value)));
    if(nav==='seats')settings=!settings;
    if(nav==='fire')underFire=!underFire;
    if(nav==='engineering')engineering=value;
    if(nav==='act'){send(role==='engineer'?engineering:'act',{},true);return;}
    if(nav==='drive'){send('drive',{drive:value},!read().keeper);return;}
    if(nav==='round'){send('round');return;}
    if(nav==='enemy'){if(value==='cool')send('enemyCool');else if(['open','close'].includes(value))send('enemyMove',{move:value});else send('enemyFire',{weapon:value});return;}
    refresh();
  };
  hud.onchange=e=>{const seat=e.target.closest('[data-seat]');if(seat)send('assign',{station:seat.dataset.seat,assignment:seat.value});};
  const first=read();
  if(!first.keeper)role=Object.keys(ROLES).find(id=>store.canEditToken(first.n.crew[id]))||'pilot';
  const unsubscribe=store.subscribe((_s,keys)=>{if(keys.some(k=>['maps','starship','tokens','userRole','isConnected','roomPaused','claimedTokenId'].includes(k)))refresh();});
  refresh();
  import('./map3d.js').then(({createMap3D})=>{
    if(disposed)return;
    view=createMap3D(surface,pick,useFallback);view.camera(camera);lastMapKey='';refresh();
  }).catch(()=>{if(!disposed)useFallback();});
  return {dispose(){disposed=true;unsubscribe();view?.dispose();root.remove();}};
}
