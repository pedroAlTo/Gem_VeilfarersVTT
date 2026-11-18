import { store } from './state.js';

export function initWaterControls() {
  const panel=document.getElementById('water_flyout');
  if (!panel) return () => {};
  const shapes=[...panel.querySelectorAll('[data-water-shape]')];
  const finish=panel.querySelector('#water_finish'), cancel=panel.querySelector('#water_cancel'), hint=panel.querySelector('#water_hint');
  const rainBtn=panel.querySelector('#water_rain_toggle');
  const rainIntensityBtn=panel.querySelector('#water_rain_intensity_btn');
  const fogBtn=panel.querySelector('#water_fog_toggle');
  const fogDensityBtn=panel.querySelector('#water_fog_density_btn');

  for (const button of shapes) button.onclick=()=>store.update({activeTool:'water',waterDrawMode:button.dataset.waterShape});
  // Zones: water or lava.
  const kinds=[...panel.querySelectorAll('[data-water-kind]')];
  for (const button of kinds) button.onclick=()=>store.update({waterKind:button.dataset.waterKind});
  // Day and night (Foundry-like): the buttons move the scene's darkness over 10 s on every screen;
  // the slider sets it at once.
  const timeButtons=[...panel.querySelectorAll('[data-weather-time]')];
  const darknessInput=panel.querySelector('#weather_darkness'), darknessValue=panel.querySelector('#weather_darkness_value');
  for (const button of timeButtons) button.onclick=()=>store.updateActiveMap({darkness:Number(button.dataset.weatherTime), lightTransitionMs:10000});
  // Dragging previews on this screen; releasing saves it and sends it to the table (one write,
  // not one per step).
  if (darknessInput) {
    darknessInput.oninput=()=>{ if (window.veilCanvas) window.veilCanvas.previewDarkness=Number(darknessInput.value); if (darknessValue) darknessValue.textContent=`${Math.round(Number(darknessInput.value)*100)} %`; };
    darknessInput.onchange=()=>{ store.updateActiveMap({darkness:Number(darknessInput.value), lightTransitionMs:0}); if (window.veilCanvas) window.veilCanvas.previewDarkness=null; };
  }
  if (rainBtn) {
    rainBtn.onclick = () => {
      const next = !(store.getActiveMap()?.showRain || store.state.showRain);
      store.updateActiveMap({ showRain: next });
      store.update({ showRain: next });
    };
  }
  if (rainIntensityBtn) {
    rainIntensityBtn.onclick = () => {
      const current = store.getActiveMap()?.rainIntensity || store.state.rainIntensity || 'rain';
      const cycle = { drizzle: 'rain', rain: 'storm', storm: 'drizzle' };
      const next = cycle[current] || 'rain';
      store.updateActiveMap({ rainIntensity: next });
      store.update({ rainIntensity: next });
    };
  }
  if (fogBtn) {
    fogBtn.onclick = () => {
      const next = !(store.getActiveMap()?.showFog || store.state.showFog);
      store.updateActiveMap({ showFog: next });
      store.update({ showFog: next });
    };
  }
  if (fogDensityBtn) {
    fogDensityBtn.onclick = () => {
      const current = store.getActiveMap()?.fogDensity || store.state.fogDensity || 'medium';
      const cycle = { light: 'medium', medium: 'dense', dense: 'light' };
      const next = cycle[current] || 'medium';
      store.updateActiveMap({ fogDensity: next });
      store.update({ fogDensity: next });
    };
  }
  finish.onclick=()=>window.veilCanvas?.finishWaterPolygon();
  cancel.onclick=()=>window.veilCanvas?.cancelWaterDrawing();
  const update=()=>{
    const s=store.state, active=s.activeTool==='water'&&s.userRole==='keeper', polygon=s.waterDrawMode==='polygon';
    panel.style.display=active?'flex':'none';
    for (const button of kinds) { const on=button.dataset.waterKind===(s.waterKind||'water'); button.classList.toggle('active',on); button.setAttribute('aria-pressed',String(on)); }
    const map=store.getActiveMap(), set=Number.isFinite(map?.darkness);
    const darkness=Math.max(0,Math.min(1,set?map.darkness:s.fogOfWar!==false?0:1-(map?.ambientLight??0.25)));
    if (darknessInput && document.activeElement!==darknessInput) darknessInput.value=String(darkness);
    if (darknessValue) darknessValue.textContent=set?`${Math.round(darkness*100)} %${darkness<0.5?' · día':' · noche'}`:'sin ajustar';
    for (const button of timeButtons) { const on=set&&Math.abs(Number(button.dataset.weatherTime)-darkness)<0.03; button.classList.toggle('active',on); button.setAttribute('aria-pressed',String(on)); }
    for (const button of shapes) {
      const selected=button.dataset.waterShape===(s.waterDrawMode||'box');
      button.classList.toggle('active',selected); button.setAttribute('aria-pressed',String(selected));
    }
    if (rainBtn) {
      const isRain = !!(store.getActiveMap()?.showRain || s.showRain);
      rainBtn.classList.toggle('active', isRain);
      rainBtn.setAttribute('aria-pressed', String(isRain));
      rainBtn.textContent = isRain ? '🌧️ Lluvia [ON]' : '🌧️ Lluvia';
    }
    if (rainIntensityBtn) {
      const intensity = store.getActiveMap()?.rainIntensity || s.rainIntensity || 'rain';
      const labels = { drizzle: '🌦️ Llovizna', rain: '🌧️ Normal', storm: '⛈️ Tormenta' };
      rainIntensityBtn.textContent = labels[intensity] || '🌧️ Normal';
    }
    if (fogBtn) {
      const isFog = !!(store.getActiveMap()?.showFog || s.showFog);
      fogBtn.classList.toggle('active', isFog);
      fogBtn.setAttribute('aria-pressed', String(isFog));
      fogBtn.textContent = isFog ? '🌫️ Niebla [ON]' : '🌫️ Niebla';
    }
    if (fogDensityBtn) {
      const density = store.getActiveMap()?.fogDensity || s.fogDensity || 'medium';
      const labels = { light: 'Bruma', medium: 'Media', dense: 'Densa' };
      fogDensityBtn.textContent = labels[density] || 'Media';
    }
    document.getElementById('tool_water')?.classList.toggle('active',active);
    const count=window.veilCanvas?.waterPolyPoints?.length||0;
    finish.hidden=!polygon; finish.disabled=count<3||!window.veilCanvas?.canDrawWater();
    cancel.disabled=!count&&!window.veilCanvas?.waterStart;
    hint.textContent=s.layerVisibility.water===false ? 'Activa la visibilidad de Agua en Capas para dibujar.' : s.layerLocked.water ? 'Desbloquea Agua en Capas para dibujar.' : s.waterDrawMode==='free' ? 'Arrastra para dibujar el contorno de la zona; al soltar se cierra. Esc cancela.' : polygon
      ? `${count} vértices · Clic para añadir. Cierra en el primer punto, con doble clic, Enter o Cerrar. Retroceso quita el último. Esc o clic derecho cancela.`
      : 'Arrastra para dibujar un rectángulo. Esc o clic derecho cancela. Cambiar de herramienta descarta el trazado pendiente.';
  };
  const unsubscribe=store.subscribe((_,keys)=>{if(keys.some(k=>['activeTool','waterDrawMode','waterKind','maps','activeMapId','fogOfWar','userRole','layerVisibility','layerLocked','showRain','rainIntensity','showFog','fogDensity'].includes(k)))update();});
  window.addEventListener('veil:water-draft',update);update();
  return ()=>{unsubscribe();window.removeEventListener('veil:water-draft',update);};
}
