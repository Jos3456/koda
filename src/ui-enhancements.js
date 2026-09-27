/* Small progressive UI enhancements for Koda. Load after app.js. */
(function () {
  'use strict';

  const input = document.getElementById('search-input');
  const wrap = document.getElementById('search-wrap');
  if (!input || !wrap) return;

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.id = 'search-clear';
  clear.className = 'search-clear hidden';
  clear.title = 'Clear search';
  clear.setAttribute('aria-label', 'Clear search');
  clear.textContent = '×';
  wrap.appendChild(clear);

  const update = () => clear.classList.toggle('hidden', input.value.length === 0);
  clear.addEventListener('click', () => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    update();
  });
  input.addEventListener('input', update);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' && input.value) {
      clear.click();
      event.stopPropagation();
    }
  });
  update();
})();
