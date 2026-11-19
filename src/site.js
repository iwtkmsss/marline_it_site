(() => {
  'use strict';

  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => systemMotion.matches || document.documentElement.dataset.reducedMotion === 'true';
  const activeAnimations = new Set();
  const notifyLayout = () => document.dispatchEvent(new Event('marline:layoutchange'));

  const caseLink = document.querySelector('.case-link');
  const viewer = document.getElementById('case-viewer');
  if (caseLink && typeof viewer?.showModal === 'function') {
    caseLink.setAttribute('aria-haspopup', 'dialog');
    caseLink.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      viewer.querySelector('img').src = caseLink.href;
      viewer.showModal();
      viewer.scrollTop = 0;
    });
  }

  function animate(element, frames, options) {
    if (reducedMotion() || typeof element.animate !== 'function') return null;
    const animation = element.animate(frames, options);
    activeAnimations.add(animation);
    animation.finished.then(
      () => activeAnimations.delete(animation),
      () => activeAnimations.delete(animation),
    );
    return animation;
  }

  function cancelPresentationAnimations() {
    for (const animation of activeAnimations) animation.cancel();
    activeAnimations.clear();
  }

  // One navigation tree: inline when its actual contents fit, native popover
  // otherwise. Older browsers get a small local disclosure fallback.
  const header = document.getElementById('site-header');
  const menuButton = document.getElementById('menu-toggle');
  const navigation = document.getElementById('main-nav');
  const inner = header?.querySelector('.header-inner');
  const nativePopover = Object.hasOwn(HTMLElement.prototype, 'popover');
  let menuOpen = false;
  let previousWidth = 0;
  let measuring = false;
  let measurementFrame = 0;
  let pendingForce = false;

  function syncMenu(open) {
    menuOpen = open;
    header.dataset.menuOpen = String(menuOpen);
    menuButton.setAttribute('aria-expanded', String(menuOpen));
  }

  function closeMenu() {
    if (nativePopover) {
      if (navigation.matches(':popover-open')) navigation.hidePopover();
    } else {
      navigation.hidden = true;
      syncMenu(false);
    }
  }

  function measureNavigation(force = false) {
    if (!inner) return;
    if (measuring) {
      pendingForce ||= force;
      return;
    }
    const width = inner.clientWidth;
    const grew = width > previousWidth + .5;
    previousWidth = width;
    if (!force && !header.classList.contains('is-wide') && !grew) return;
    measuring = true;
    const wasOpen = nativePopover ? navigation.matches(':popover-open') : menuOpen;
    const focusedControl = document.activeElement;
    const focusWasInLinks = navigation.contains(focusedControl);
    header.classList.add('is-measuring', 'is-wide');
    navigation.removeAttribute('popover');
    navigation.hidden = false;
    const fits = inner.scrollWidth <= inner.clientWidth + 1;
    header.classList.toggle('is-wide', fits);
    if (fits) {
      syncMenu(false);
    } else {
      navigation.setAttribute('popover', 'auto');
      if (nativePopover) {
        if (wasOpen) navigation.showPopover({ source: menuButton });
        syncMenu(wasOpen);
      } else {
        navigation.hidden = !wasOpen;
        syncMenu(wasOpen);
      }
    }
    // Removing popover or hiding its trigger can move focus to the document.
    // Preserve the same visible link, or move from the hidden trigger to it.
    if (fits && focusedControl === menuButton) navigation.querySelector('a')?.focus();
    else if (focusWasInLinks && (fits || wasOpen)) focusedControl.focus();
    if (measurementFrame) cancelAnimationFrame(measurementFrame);
    measurementFrame = requestAnimationFrame(() => {
      header.classList.remove('is-measuring');
      measuring = false;
      measurementFrame = 0;
      if (pendingForce) {
        pendingForce = false;
        measureNavigation(true);
      } else if (Math.abs(inner.clientWidth - previousWidth) > .5) measureNavigation();
    });
  }

  if (header && menuButton && navigation && inner) {
    header.dataset.navReady = 'true';
    menuButton.hidden = false;
    navigation.addEventListener('toggle', event => {
      if (nativePopover && !header.classList.contains('is-measuring')) syncMenu(event.newState === 'open');
    });
    navigation.addEventListener('click', event => {
      if (event.target.closest('a') && !header.classList.contains('is-wide')) closeMenu();
    });
    if (!nativePopover) {
      menuButton.addEventListener('click', () => {
        if (header.classList.contains('is-wide')) return;
        navigation.hidden = menuOpen;
        syncMenu(!menuOpen);
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && menuOpen) {
          closeMenu();
          menuButton.focus();
        }
      });
      document.addEventListener('pointerdown', event => {
        if (menuOpen && !header.contains(event.target)) closeMenu();
      });
    }
    measureNavigation(true);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => measureNavigation());
      observer.observe(inner);
      observer.observe(navigation);
    } else window.addEventListener('resize', () => measureNavigation(true), { passive: true });
    document.fonts?.ready.then(() => measureNavigation(true)).catch(() => {});
  }

  // The browser owns details state and intrinsic-size transitions. Unsupported
  // browsers keep instant, searchable, fully functional native disclosures.
  for (const details of document.querySelectorAll('[data-accordion]')) {
    details.addEventListener('toggle', notifyLayout);
    details.addEventListener('transitionend', event => {
      if (event.propertyName === 'block-size' || event.propertyName === 'height') notifyLayout();
    });
  }

  const process = document.getElementById('process');
  const tabList = document.getElementById('process-tabs');
  const indicator = document.getElementById('process-current');
  const tabs = tabList ? [...tabList.querySelectorAll('.process-tab')] : [];
  const panels = process ? [...process.querySelectorAll('.process-panel')] : [];
  const nativeFocusGroup = Object.hasOwn(HTMLElement.prototype, 'focusGroup');
  let activeStep = 0;
  let tabsReady = false;
  let panelAnimation = null;
  let nearestScrollContainer = false;
  // A detached probe converts the options dictionary without scrolling a page.
  document.createElement('div').scrollIntoView({ get container() { nearestScrollContainer = true; return 'nearest'; } });

  function revealTab(tab) {
    if (nearestScrollContainer) {
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
    } else {
      const list = tabList.getBoundingClientRect();
      const bounds = tab.getBoundingClientRect();
      const delta = bounds.left < list.left + 8 ? bounds.left - list.left - 8 : bounds.right > list.right - 8 ? bounds.right - list.right + 8 : 0;
      if (delta) tabList.scrollBy({ left: delta, behavior: 'auto' });
    }
  }

  function positionIndicator() {
    if (!tabList || !indicator || tabList.hidden) return;
    const node = tabs[activeStep]?.querySelector('.process-node');
    if (!node) return;
    const parent = tabList.getBoundingClientRect();
    const bounds = node.getBoundingClientRect();
    indicator.style.transform = `translate3d(${bounds.left - parent.left + tabList.scrollLeft}px, ${bounds.top - parent.top + tabList.scrollTop}px, 0)`;
  }

  function selectStep(index, focus = false, showTransition = true) {
    if (!tabs.length || index < 0 || index >= tabs.length) return;
    if (tabsReady && index === activeStep) {
      if (focus) tabs[activeStep].focus();
      return;
    }
    const changed = index !== activeStep;
    activeStep = index;
    panelAnimation?.cancel();
    panelAnimation = null;
    tabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === activeStep;
      tab.setAttribute('aria-selected', String(selected));
      tab.toggleAttribute('focusgroupstart', selected);
      if (!nativeFocusGroup) tab.tabIndex = selected ? 0 : -1;
      panels[tabIndex].hidden = selected ? false : 'until-found';
      if (selected) panels[tabIndex].tabIndex = 0;
      else panels[tabIndex].removeAttribute('tabindex');
    });
    positionIndicator();
    if (changed && showTransition) {
      panelAnimation = animate(panels[activeStep], [
        { opacity: .35, transform: 'translateY(7px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    if (tabsReady || focus) revealTab(tabs[activeStep]);
    if (focus) tabs[activeStep].focus();
    notifyLayout();
  }

  if (process && tabList && tabs.length && tabs.length === panels.length) {
    tabList.setAttribute('focusgroup', 'tablist nomemory');
    tabList.setAttribute('aria-label', 'Етапи роботи');
    if (!nativeFocusGroup) tabList.setAttribute('role', 'tablist');
    tabs.forEach((tab, index) => {
      if (!nativeFocusGroup) tab.setAttribute('role', 'tab');
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', tab.id);
      tab.addEventListener('click', () => selectStep(index));
      tab.addEventListener('focus', () => selectStep(index));
      if (!nativeFocusGroup) {
        tab.addEventListener('keydown', event => {
          let next;
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = tabs.length - 1;
          else return;
          event.preventDefault();
          selectStep(next, true);
        });
      }
    });
    process.dataset.enhanced = 'true';
    tabList.hidden = false;
    selectStep(0, false, false);
    tabsReady = true;
    function revealHash() {
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
      const target = document.getElementById(id);
      const index = panels.findIndex(panel => target && (panel === target || panel.contains(target)));
      if (index >= 0) selectStep(index, false, false);
    }
    document.addEventListener('beforematch', event => {
      const index = panels.findIndex(panel => panel === event.target || panel.contains(event.target));
      if (index >= 0) selectStep(index, false, false);
    });
    window.addEventListener('hashchange', revealHash);
    revealHash();
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(positionIndicator);
      observer.observe(tabList);
    }
    document.fonts?.ready.then(positionIndicator).catch(() => {});
  }

  function finishStateTransitions() {
    cancelPresentationAnimations();
    positionIndicator();
    notifyLayout();
  }

  window.addEventListener('resize', finishStateTransitions, { passive: true });
  systemMotion.addEventListener('change', finishStateTransitions);
  document.addEventListener('marline:motionchange', finishStateTransitions);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishStateTransitions();
  });
})();
