/*
 * Collaborators: a quick mobile check of the page shown, run in the browser
 * (devtools console, or a browser tool's "execute JavaScript") at phone width
 * (e.g. 390x844). It lists what usually goes wrong on phones:
 *
 * - the page scrolls sideways (something wider than the screen);
 * - elements sticking out of the screen on the right or the left;
 * - buttons and links smaller than 32x32px (hard to tap);
 * - text smaller than 12px.
 *
 * It returns a plain object; nothing on the page is changed.
 */
(() => {
  const width = window.innerWidth;
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = (el.className && typeof el.className === 'string'
      ? el.className.split(/\s+/).filter((c) => c.startsWith('--')).slice(0, 2)
      : []
    )
      .map((c) => `.${c}`)
      .join('');
    const text = (el.getAttribute('aria-label') || el.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  };
  const visible = (el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    if (el.closest('[inert], [aria-hidden="true"]')) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const all = [...document.body.querySelectorAll('*')].filter(visible);

  const overflowing = all
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.right > width + 1 || rect.left < -1;
    })
    // Keep the outermost ones only
    .filter((el, _, list) => !list.some((other) => other !== el && other.contains(el)))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return `${describe(el)} (left ${Math.round(rect.left)}, right ${Math.round(rect.right)})`;
    });

  const smallTargets = all
    .filter((el) => el.matches('a[href], button, [role="button"], [role="switch"], input, select'))
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width < 32 || rect.height < 32;
    })
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return `${describe(el)} (${Math.round(rect.width)}x${Math.round(rect.height)})`;
    });

  const smallText = all
    .filter((el) =>
      [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      ),
    )
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
    .map((el) => `${describe(el)} (${getComputedStyle(el).fontSize})`);

  return {
    url: location.pathname + location.search,
    viewport: `${width}x${window.innerHeight}`,
    scrollsSideways: document.documentElement.scrollWidth > width + 1,
    overflowing: overflowing.slice(0, 20),
    smallTargets: smallTargets.slice(0, 30),
    smallText: smallText.slice(0, 20),
  };
})();
