'use client';

import { useEffect, useRef } from 'react';

export default function AsciiPortrait() {
  const portraitRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const portrait = portraitRef.current;
    const root = document.documentElement;
    const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const toggle = document.getElementById('motion-toggle');
    const note = document.getElementById('motion-note');
    let manualReduction = false;
    let cancelled = false;
    let scene = null;
    let stopDissolve = null;
    const getReduced = () => systemMotion.matches || manualReduction;

    function updatePreference() {
      const reduced = getReduced();
      root.dataset.reducedMotion = String(reduced);
      if (toggle) {
        toggle.hidden = false;
        toggle.disabled = systemMotion.matches;
        toggle.setAttribute('aria-pressed', String(reduced));
      }
      if (note) note.textContent = systemMotion.matches ? 'Увімкнено в системі' : reduced ? 'Рух зменшено' : '';
      document.dispatchEvent(new CustomEvent('marline:motionchange', { detail: { reduced } }));
    }
    function toggleReduction() {
      manualReduction = !manualReduction;
      updatePreference();
    }

    updatePreference();
    toggle?.addEventListener('click', toggleReduction);
    systemMotion.addEventListener('change', updatePreference);
    import('../lib/ascii-scene')
      .then(({ startAsciiScene }) => startAsciiScene({
        stage: portrait,
        canvas: canvasRef.current,
        getReduced,
        isCancelled: () => cancelled,
        onReady: () => { portrait.dataset.live = ''; },
        onLost: () => {
          stopDissolve?.();
          delete portrait.dataset.live;
        },
      }))
      .then(started => {
        scene = started;
        return started && import('../lib/ascii-dissolve');
      })
      .then(dissolve => {
        if (!dissolve || cancelled) return;
        stopDissolve = dissolve.startDissolve({ scene, stage: portrait, portraitCanvas: canvasRef.current, getReduced });
      })
      // The static portrait stays in place when WebGL or the assets fail.
      .catch(error => console.warn('ASCII portrait stays static:', error));

    return () => {
      cancelled = true;
      stopDissolve?.();
      scene?.dispose();
      delete portrait.dataset.live;
      toggle?.removeEventListener('click', toggleReduction);
      systemMotion.removeEventListener('change', updatePreference);
      delete root.dataset.reducedMotion;
    };
  }, []);

  return (
    <div className="portrait-stage ascii-portrait-stage">
      <div className="ascii-portrait" ref={portraitRef}>
        <img src="/assets/mascot/marilyn-ascii-preview.webp" alt="ASCII-портрет Мерилін Монро" width={1200} height={1200} fetchPriority="high" decoding="async" />
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
    </div>
  );
}
