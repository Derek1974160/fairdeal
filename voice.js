/* fairdeal.ie: a microphone on every box.
   Tap the microphone beside a box, speak, and the words go into that box.
   Amounts, dates, phone numbers, email addresses, Eircodes and PPS numbers are tidied as they arrive.
   The browser's own speech service turns the voice into text (Google on Chrome and Android, Apple on iPhone and Safari).
   Nothing said here is sent to fairdeal.ie. Where a browser has no speech service, no microphones are shown and the
   keyboard's own microphone still works. Add data-novoice to any box (or a parent) that should not get one. */
(function () {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || window.__fdVoice) return;
  window.__fdVoice = true;

  var css = document.createElement('style');
  css.textContent =
    '.fdv-wrap{position:relative;display:block;flex:1 1 auto;min-width:0}' +
    '.fdv-has{padding-right:46px!important}' +
    '.fdv-btn{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:34px;height:34px;border:0;border-radius:50%;background:transparent;color:#56606B;cursor:pointer;display:grid;place-items:center;padding:0;z-index:2}' +
    '.fdv-btn:hover{background:#F2EEE6;color:#0F2238}' +
    '.fdv-btn:focus-visible{outline:2px solid #0F2238;outline-offset:1px}' +
    '.fdv-btn svg{width:19px;height:19px;fill:currentColor}' +
    '.fdv-btn.fdv-area{top:8px;transform:none}' +
    '.fdv-btn.on{background:#B3261E;color:#fff;animation:fdvp 1.2s infinite}' +
    '@keyframes fdvp{0%{box-shadow:0 0 0 0 rgba(179,38,30,.45)}70%{box-shadow:0 0 0 9px rgba(179,38,30,0)}100%{box-shadow:0 0 0 0 rgba(179,38,30,0)}}' +
    '.fdv-tip{position:absolute;right:0;bottom:calc(100% + 6px);background:#0F2238;color:#fff;font-size:13px;line-height:1.35;padding:7px 10px;border-radius:4px;max-width:260px;z-index:5;pointer-events:none}' +
    '.fdv-heard{background:#FBF4E4!important}';
  document.head.appendChild(css);

  var MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>';
  var SKIP = '[data-novoice],.dictbox,.dict,.askbox,#dict,#ask-card,.tour-card';

  // ---------- turning speech into tidy values ----------
  var SMALL = {zero:0,oh:0,nought:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,a:1};
  var MONTHS = {january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
  var ORD = {first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10,eleventh:11,twelfth:12,thirteenth:13,fourteenth:14,fifteenth:15,sixteenth:16,seventeenth:17,eighteenth:18,nineteenth:19,twentieth:20,thirtieth:30};

  function words2num(s) {
    // "three hundred and twenty" -> 320, "twelve thousand five hundred" -> 12500, "1.5 million" -> 1500000
    var t = s.toLowerCase().replace(/,/g, '').replace(/-/g, ' ').replace(/\b(euro|euros|eur|cent)\b/g, ' ').trim();
    var m = t.match(/(\d+(?:\.\d+)?)\s*(k|grand|thousand|million|m)\b/);
    if (m) return parseFloat(m[1]) * (/^(million|m)$/.test(m[2]) ? 1000000 : 1000);
    var d = t.match(/\d+(?:\.\d+)?/); var total = 0, cur = 0, seen = false, point = null;
    if (d && !/[a-z]/.test(t.replace(/\b(a|per|each|every)\s+(week|month|year)\b|\b(weekly|monthly|yearly|annually)\b/g, '').replace(/\d/g, '').trim())) return parseFloat(d[0]);
    var toks = t.split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var w = toks[i];
      if (/^\d+(\.\d+)?$/.test(w)) { cur += parseFloat(w); seen = true; }
      else if (w in SMALL && !(w === 'a' && !/^(hundred|thousand|million)$/.test(toks[i + 1] || ''))) { if (point !== null) { point += String(SMALL[w]); } else cur += SMALL[w]; seen = true; }
      else if (w === 'hundred') { cur = (cur || 1) * 100; seen = true; }
      else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; seen = true; }
      else if (w === 'million') { total += (cur || 1) * 1000000; cur = 0; seen = true; }
      else if (w === 'point' && seen) { point = ''; }
      else if (w === 'and' || w === 'euro') { }
    }
    if (!seen) return null;
    var n = total + cur; if (point) n = parseFloat(String(n) + '.' + point);
    return n;
  }
  function money(s, el) {
    var n = words2num(s); if (n == null) return '';
    // the box says what period it wants (data-period="week" or "year"); convert what was said
    var want = el && el.getAttribute('data-period'), r = s.toLowerCase();
    var month = /\b(a|per|each|every)\s+month\b|\bmonthly\b/.test(r), year = /\b(a|per|each|every)\s+year\b|\byearly\b|\bannual|\bper annum\b/.test(r), week = /\b(a|per|each|every)\s+week\b|\bweekly\b/.test(r), fortnight = /\bfortnight/.test(r);
    if (want === 'week') { if (month) n = n * 12 / 52; else if (year) n = n / 52; else if (fortnight) n = n / 2; }
    if (want === 'year') { if (month) n = n * 12; else if (week) n = n * 52; else if (fortnight) n = n * 26; }
    return String(Math.round(n * 100) / 100);
  }
  function digits(s) {
    var out = '';
    s.toLowerCase().replace(/-/g, ' ').split(/\s+/).forEach(function (w) {
      if (/^\+?\d+$/.test(w)) out += w;
      else if (w === 'double' || w === 'treble') out += '§' + (w === 'double' ? 2 : 3);
      else if (w in SMALL && SMALL[w] < 10) out += SMALL[w];
    });
    return out.replace(/§(\d)(\d)/g, function (x, n, dgt) { return new Array(+n + 1).join(dgt); }).replace(/§\d/g, '');
  }
  function phone(s) {
    var p = digits(s).replace(/^\+?353/, '0'); if (p && p[0] !== '0' && p.length === 9) p = '0' + p;
    if (p.length === 10) return p.slice(0, 3) + ' ' + p.slice(3, 6) + ' ' + p.slice(6);
    if (p.length === 9) return p.slice(0, 3) + ' ' + p.slice(3, 6) + ' ' + p.slice(6);
    return p || s.trim();
  }
  function email(s) {
    return s.toLowerCase().replace(/\s+at\s+|\s*@\s*/g, '@').replace(/\s+dot\s+|\s*\.\s*/g, '.')
      .replace(/\s+(underscore)\s+/g, '_').replace(/\s+(dash|hyphen)\s+/g, '-').replace(/\s+/g, '').replace(/\.$/, '');
  }
  function code(s) { // Eircode, PPS: letters and digits, upper case
    var t = s.toUpperCase().replace(/\b(ZERO|OH)\b/g, '0').replace(/\bONE\b/g, '1').replace(/\bTWO\b/g, '2').replace(/\bTHREE\b/g, '3').replace(/\bFOUR\b/g, '4')
      .replace(/\bFIVE\b/g, '5').replace(/\bSIX\b/g, '6').replace(/\bSEVEN\b/g, '7').replace(/\bEIGHT\b/g, '8').replace(/\bNINE\b/g, '9').replace(/[^A-Z0-9]/g, '');
    return t;
  }
  function eircode(s) { var t = code(s); return t.length === 7 ? t.slice(0, 3) + ' ' + t.slice(3) : t; }
  function isoDate(s) {
    var r = s.toLowerCase().replace(/(\d+)(st|nd|rd|th)\b/g, '$1');
    Object.keys(ORD).forEach(function (k) { r = r.replace(new RegExp('\\b(twenty|thirty)[ -]' + k + '\\b', 'g'), function (x, tens) { return String((tens === 'twenty' ? 20 : 30) + ORD[k]); }).replace(new RegExp('\\b' + k + '\\b', 'g'), String(ORD[k])); });
    r = r.replace(/\bnineteen\s+(\w+(?:\s+\w+)?)\b/g, function (x, rest) { var n = words2num(rest); return n != null && n < 100 ? String(1900 + n) : x; })
         .replace(/\btwo thousand(?: and)?\s*(\w+)?\b/g, function (x, rest) { var n = rest ? words2num(rest) : 0; return n != null && n < 100 ? String(2000 + n) : x; });
    var mon = '(' + Object.keys(MONTHS).join('|') + ')', m;
    if ((m = r.match(/\b(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})\b/))) return iso(m[3], m[2], m[1]);
    if ((m = r.match(new RegExp('\\b(\\d{1,2})\\s+(?:of\\s+)?' + mon + '\\s*,?\\s*(\\d{4})\\b')))) return iso(m[3], MONTHS[m[2]], m[1]);
    if ((m = r.match(new RegExp('\\b' + mon + '\\s+(?:the\\s+)?(\\d{1,2})\\s*,?\\s*(\\d{4})\\b')))) return iso(m[3], MONTHS[m[1]], m[2]);
    return '';
  }
  function iso(y, mo, d) { y = String(y); if (y.length === 2) y = (+y > 30 ? '19' : '20') + y; mo = +mo; d = +d; if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return ''; return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d; }
  function sentence(s) { s = s.trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function kindOf(el) {
    var hint = ((el.getAttribute('data-path') || '') + ' ' + (el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '') + ' ' + labelText(el)).toLowerCase();
    if (el.type === 'date') return 'date';
    if (el.type === 'email' || /\bemail\b/.test(hint)) return 'email';
    if (el.type === 'tel' || /\b(phone|mobile|tel)\b/.test(hint)) return 'phone';
    if (/eircode|\beir\b|\.eir\b/.test(hint)) return 'eircode';
    if (/\bpps\b/.test(hint)) return 'pps';
    if (el.getAttribute('inputmode') === 'decimal' || el.closest('.money')) return 'money';
    if (el.getAttribute('inputmode') === 'numeric' || el.type === 'number' || /home number|\bnumber\b.*\b(1308|home)\b|years/.test(hint)) return 'number';
    if (el.tagName === 'TEXTAREA') return 'text';
    return 'line';
  }
  function labelText(el) {
    var l = el.id && document.querySelector('label[for="' + el.id + '"]'); if (l) return l.textContent;
    var p = el.closest('label,.field,.pairrow'); var lb = p && p.querySelector('label,legend'); return lb ? lb.textContent : (el.getAttribute('aria-label') || '');
  }
  function tidy(kind, said, el) {
    switch (kind) {
      case 'money': return money(said, el);
      case 'number': var n = words2num(said); return n == null ? digits(said) : String(n);
      case 'phone': return phone(said);
      case 'email': return email(said);
      case 'eircode': return eircode(said);
      case 'pps': return code(said);
      case 'date': return isoDate(said);
      case 'text': return sentence(said);
      default: return sentence(said).replace(/\.$/, '');
    }
  }

  // ---------- microphones ----------
  var active = null;
  function eligible(el) {
    if (el.__fdv || el.disabled || el.readOnly) return false;
    if (el.tagName === 'INPUT' && !/^(text|email|tel|search|number|date|)$/.test(el.type)) return false;
    if (el.autocomplete === 'one-time-code' || /code/i.test(el.id) && el.maxLength && el.maxLength <= 8) return false;
    if (el.closest(SKIP)) return false;
    return true;
  }
  function attach(el) {
    el.__fdv = true;
    if (!el.parentElement) return;
    // give the box its own wrapper so the microphone never lands on a neighbouring button
    var host = document.createElement('span'); host.className = 'fdv-wrap';
    var cs = getComputedStyle(el); if (cs.display === 'inline' || cs.display === 'inline-block') host.style.display = 'inline-block';
    el.parentElement.insertBefore(host, el); host.appendChild(el);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fdv-btn' + (el.tagName === 'TEXTAREA' ? ' fdv-area' : '');
    b.setAttribute('aria-label', 'Speak instead of typing'); b.title = 'Speak instead of typing'; b.innerHTML = MIC;
    if (el.tagName !== 'TEXTAREA') { b.style.top = (el.offsetTop + el.offsetHeight / 2) + 'px'; }
    else b.style.top = (el.offsetTop + 6) + 'px';
    el.classList.add('fdv-has');
    el.insertAdjacentElement('afterend', b);
    b.addEventListener('click', function (e) { e.preventDefault(); listen(el, b); });
    b.__field = el;
  }
  function place() { // keep each microphone level with its box after layout changes
    document.querySelectorAll('.fdv-btn').forEach(function (b) {
      var el = b.__field; if (!el || !el.isConnected) return;
      b.hidden = el.offsetParent === null;
      b.style.top = el.tagName === 'TEXTAREA' ? (el.offsetTop + 6) + 'px' : (el.offsetTop + el.offsetHeight / 2) + 'px';
    });
  }
  function tip(b, msg) { var t = document.createElement('span'); t.className = 'fdv-tip'; t.textContent = msg; b.parentElement.appendChild(t); setTimeout(function () { t.remove(); }, 4500); }
  function listen(el, b) {
    if (active) { var same = active.el === el; try { active.r.stop(); } catch (x) {} if (same) return; }
    var r = new SR(); r.lang = 'en-IE'; r.interimResults = true; r.continuous = el.tagName === 'TEXTAREA';
    var kind = kindOf(el), base = el.tagName === 'TEXTAREA' && el.value ? el.value.replace(/\s+$/, '') + ' ' : '', fin = '', got = false;
    active = { r: r, el: el }; b.classList.add('on'); b.setAttribute('aria-label', 'Stop listening');
    r.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '; else interim += e.results[i][0].transcript; }
      if (kind === 'text') { el.value = base + sentence(fin + interim).trim(); got = true; fire(el); }
      else if (fin) { var v = tidy(kind, fin, el); if (v) { el.value = v; got = true; fire(el); } else tip(b, 'Heard "' + fin.trim() + '". Please try again or type it.'); }
    };
    r.onerror = function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') tip(b, 'The microphone is blocked. Allow it in your browser settings, or use the microphone on your keyboard.'); else if (e.error === 'no-speech') tip(b, 'Nothing heard. Tap and try again.'); };
    r.onend = function () { b.classList.remove('on'); b.setAttribute('aria-label', 'Speak instead of typing'); if (active && active.r === r) active = null; if (got) { el.classList.add('fdv-heard'); setTimeout(function () { el.classList.remove('fdv-heard'); }, 2500); } };
    try { r.start(); } catch (x) { b.classList.remove('on'); active = null; }
  }
  function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }

  function scan() {
    document.querySelectorAll('input,textarea').forEach(function (el) { if (eligible(el)) attach(el); });
    place();
  }
  var pending = false;
  new MutationObserver(function () { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; scan(); }); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  window.addEventListener('resize', place);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  window.FDVoice = { tidy: tidy, kindOf: kindOf, scan: scan };
})();
