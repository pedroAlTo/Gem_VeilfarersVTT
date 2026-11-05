import { store } from './state.js';

export function initWaterControls() {
  const panel=document.getElementById('water_flyout');
  if (!panel) return () => {};
  const shapes=[...panel.querySelectorAll('[data-water-shape]')];
  const finish=panel.querySelector('#water_finish'), cancel=panel.querySelector('#water_cancel'), hint=panel.querySelector('#water_hint');
  for (const button of shapes) button.onclick=()=>store.update({activeTool:'water',waterDrawMode:button.dataset.waterShape});
  finish.onclick=()=>window.veilCanvas?.finishWaterPolygon();
  cancel.onclick=()=>window.veilCanvas?.cancelWaterDrawing();
  const update=()=>{
    const s=store.state, active=s.activeTool==='water'&&s.userRole==='keeper', polygon=s.waterDrawMode==='polygon';
    panel.style.display=active?'flex':'none';
    for (const button of shapes) {
      const selected=button.dataset.waterShape===(s.waterDrawMode||'box');
      button.classList.toggle('active',selected); button.setAttribute('aria-pressed',String(selected));
    }
    document.getElementById('tool_water')?.classList.toggle('active',active);
    const count=window.veilCanvas?.waterPolyPoints?.length||0;
    finish.hidden=!polygon; finish.disabled=count<3||!window.veilCanvas?.canDrawWater();
    cancel.disabled=!count&&!window.veilCanvas?.waterStart;
    hint.textContent=s.layerVisibility.water===false ? 'Activa la visibilidad de Agua en Capas para dibujar.' : s.layerLocked.water ? 'Desbloquea Agua en Capas para dibujar.' : polygon
      ? `${count} vértices · Clic para añadir. Cierra en el primer punto, con doble clic, Enter o Cerrar. Retroceso quita el último. Esc o clic derecho cancela.`
      : 'Arrastra para dibujar un rectángulo. Esc o clic derecho cancela. Cambiar de herramienta descarta el trazado pendiente.';
  };
  const unsubscribe=store.subscribe((_,keys)=>{if(keys.some(k=>['activeTool','waterDrawMode','userRole','layerVisibility','layerLocked'].includes(k)))update();});
  window.addEventListener('veil:water-draft',update);update();
  return ()=>{unsubscribe();window.removeEventListener('veil:water-draft',update);};
}
