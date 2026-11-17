// A repeating timer that keeps its pace when the tab is hidden. Browsers slow down timers in
// background tabs (Chrome to once a minute after a few minutes), which let a room's heartbeat
// lapse and the session "expire" while the person was still at the table. Timers inside a
// Worker are not throttled that way. Falls back to setInterval where Workers are unavailable.
export function every(ms, fn) {
  let worker = null, timer = null;
  try {
    if (typeof Worker === 'function' && typeof Blob === 'function' && typeof URL?.createObjectURL === 'function') {
      const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${Math.max(100, Number(ms) || 1000)});`], { type: 'text/javascript' }));
      worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = () => fn();
      worker.onerror = () => { worker?.terminate(); worker = null; if (!timer) timer = setInterval(fn, ms); };
    }
  } catch { worker = null; }
  if (!worker) timer = setInterval(fn, ms);
  return () => { worker?.terminate(); worker = null; clearInterval(timer); timer = null; };
}
