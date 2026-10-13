/* fairdeal.ie: "Easier to read" (13 October 2026).
   One switch at the top of the tracker, the form and the checklist that makes everything larger and higher-contrast:
   20px text, 1.7 line spacing, navy on cream, full-width buttons, the microphone spelled out as "Speak", one question
   per page on the form, and a plain "what this means" line under the hard questions. The setting lives on this device
   only (localStorage) and is never sent; the rules are in theme.css under html.easy.
   Pages listen for the 'fd-easy' event to re-draw themselves. */
(function () {
  var KEY = 'fd_easy';
  var html = document.documentElement;
  function isOn() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return html.classList.contains('easy'); } }
  function apply(on, announce) {
    html.classList.toggle('easy', on);
    var b = document.getElementById('easy-switch');
    if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.querySelector('b').textContent = on ? 'On' : 'Off'; }
    if (announce) { try { document.dispatchEvent(new CustomEvent('fd-easy', { detail: { on: on } })); } catch (e) {} }
  }
  function set(on) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    apply(on, true);
  }
  // the switch, just under the top bar
  function mount() {
    if (document.getElementById('easy-switch')) return;
    var nav = document.querySelector('.nav');
    var bar = document.createElement('div'); bar.className = 'easybar';
    bar.innerHTML = '<div class="wrap"><button type="button" id="easy-switch" aria-pressed="false"><span class="easy-ico" aria-hidden="true">Aa</span> Easier to read: <b>Off</b></button><span class="easy-note">Bigger text, one question at a time. Remembered on this device only.</span></div>';
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling); else document.body.insertBefore(bar, document.body.firstChild);
    document.getElementById('easy-switch').addEventListener('click', function () { set(!isOn()); });
    apply(isOn(), false);
  }
  // apply the class as early as possible so the page never flashes small
  if (isOn()) html.classList.add('easy');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.FDEasy = { on: isOn, set: set };
})();
