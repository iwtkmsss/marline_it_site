'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { navigation } from '../lib/content';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// One navigation tree: inline when its contents fit, native popover otherwise.
export default function Header() {
  const [wide, setWide] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const headerRef = useRef(null);
  const innerRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useIsomorphicLayoutEffect(() => {
    const header = headerRef.current;
    const inner = innerRef.current;
    const menu = menuRef.current;
    const supportsPopover = Object.hasOwn(HTMLElement.prototype, 'popover');
    let previousWidth = 0;
    let isWide = false;
    let frame = 0;

    function measure() {
      const width = inner.clientWidth;
      const grew = width > previousWidth + 0.5;
      previousWidth = width;
      // A collapsed menu is only worth measuring again when there is more room.
      if (!isWide && !grew) return;
      const wasOpen = supportsPopover && menu.matches(':popover-open');
      const hadFocus = header.contains(document.activeElement) ? document.activeElement : null;
      header.classList.add('is-measuring', 'is-wide');
      menu.removeAttribute('popover');
      isWide = inner.scrollWidth <= inner.clientWidth + 1;
      header.classList.toggle('is-wide', isWide);
      if (!isWide) {
        menu.setAttribute('popover', 'auto');
        if (wasOpen) menu.showPopover({ source: buttonRef.current });
      }
      if (hadFocus === buttonRef.current && isWide) menu.querySelector('a')?.focus();
      else if (hadFocus && hadFocus !== document.activeElement) hadFocus.focus();
      setWide(isWide);
      setReady(true);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => header.classList.remove('is-measuring'));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    observer.observe(menu);
    document.fonts?.ready.then(() => {
      previousWidth = 0;
      measure();
    }).catch(() => {});
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const menu = menuRef.current;
    const onToggle = event => setOpen(event.newState === 'open');
    menu.addEventListener('toggle', onToggle);
    return () => menu.removeEventListener('toggle', onToggle);
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setSolid(window.scrollY > 24);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  function closeMenu(event) {
    const menu = menuRef.current;
    if (event.target.closest('a') && menu.matches('[popover]:popover-open')) menu.hidePopover();
  }

  return (
    <header
      className={`site-header${wide ? ' is-wide' : ''}`}
      id="site-header"
      ref={headerRef}
      data-nav-ready={ready ? 'true' : undefined}
      data-menu-open={!wide && open}
      data-solid={solid ? '' : undefined}
    >
      <div className="header-inner shell" ref={innerRef}>
        <a className="wordmark" href="#site-header" aria-label="Marline — на початок">
          <span className="brand-pixel" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span>marline</span>
        </a>
        <nav className="site-navigation" aria-label="Основна">
          <button className="menu-toggle" type="button" ref={buttonRef} popoverTarget="main-nav" popoverTargetAction="toggle" aria-controls="main-nav">
            <span>Меню</span>
            <span className="menu-icon" aria-hidden="true"><i /><i /></span>
          </button>
          <ul className="main-nav" id="main-nav" ref={menuRef} popover={wide ? undefined : 'auto'} onClick={closeMenu}>
            {navigation.map(item => <li key={item.href}><a href={item.href}>{item.label}</a></li>)}
            <li className="menu-contact"><a href="#contact">Контакти</a></li>
          </ul>
        </nav>
        <a className="header-action" href="#contact">Контакти</a>
      </div>
    </header>
  );
}
