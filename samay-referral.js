/*!
 * SAMAY Refer & Earn - drop-in script for the website  (OTP version)
 *
 * 1. Put this file next to your index.html and add before </body>:
 *      <script>window.SAMAY_REFERRAL = { apiUrl: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE" };</script>
 *      <script src="/samay-referral.js"></script>
 * 2. In your cart / checkout, add an empty box:  <div id="referral-box"></div>
 *      and after the page loads call:  SamayReferral.mountCodeBox("#referral-box");
 * 3. Take the discount off your total:  total = subtotal - SamayReferral.discount();
 *      (re-calculate whenever the "samay:referral-change" event fires on window)
 * 4. When the customer confirms the order:
 *      SamayReferral.placeOrder({ items: [{name, qty, price}], address }).then(function(res){ ... });
 *
 * Sign up needs: name, email, phone, full address (all required) + an OTP e-mailed to the customer. Log in needs: email (or phone) + OTP.
 * The customer's own referral code is shown only if the owner has switched it on for that customer.
 * With apiUrl left empty the script runs in DEMO mode (fake database in the browser, OTP is always 123456).
 */
(function () {
  'use strict';

  var CFG = Object.assign({
    apiUrl: '',
    discountText: 'Rs 100',
    cashbackText: 'Rs 100',
    showButton: true,          // floating "Refer & Earn" button
    buttonPosition: 'left',    // 'left' or 'right'
    siteUrl: location.origin
  }, window.SAMAY_REFERRAL || {});

  var USER_KEY = 'samay_ref_user2', APPLIED_KEY = 'samay_ref_applied';
  var MIN_ADDR = 10;
  var boxes = [];

  /* ---------- storage ---------- */
  function read(store, key) { try { return JSON.parse(store.getItem(key)); } catch (e) { return null; } }
  function write(store, key, val) { try { if (val == null) store.removeItem(key); else store.setItem(key, JSON.stringify(val)); } catch (e) {} }
  var user = read(localStorage, USER_KEY);
  var applied = read(sessionStorage, APPLIED_KEY);
  if (user && !user.token) { user = null; write(localStorage, USER_KEY, null); }   // old sessions (before OTP) must log in again

  function emit() {
    window.dispatchEvent(new CustomEvent('samay:referral-change', { detail: { user: user, discount: discount(), code: applied ? applied.code : '' } }));
    boxes.forEach(renderBox);
  }
  function discount() { return applied ? applied.discount : 0; }
  function setUser(u) { user = u; write(localStorage, USER_KEY, u); if (!u) setApplied(null); }
  function setApplied(a) { applied = a; write(sessionStorage, APPLIED_KEY, a); }

  /* ---------- API ---------- */
  function api(action, data) {
    var body = Object.assign({ action: action }, data || {});
    var p = !CFG.apiUrl ? mockApi(body)
      : fetch(CFG.apiUrl, { method: 'POST', body: JSON.stringify(body) })   // plain-text body: no CORS preflight
          .then(function (r) { return r.json(); })
          .catch(function () { return { ok: false, error: 'Could not reach the server. Please check your internet and try again.' }; });
    return p.then(function (res) {
      if (res && res.relogin && user) { setUser(null); emit(); }              // session ended: ask for a fresh OTP login
      return res;
    });
  }
  function auth() { return user ? { token: user.token } : {}; }

  /* ---------- public actions ---------- */
  function applyCode(code) {
    if (!user) { open('login'); return Promise.resolve({ ok: false, error: 'Please log in first.' }); }
    return api('checkCode', Object.assign(auth(), { code: code })).then(function (res) {
      if (res.ok) { setApplied({ code: res.code, discount: res.discount, referrer: res.referrerName }); emit(); }
      return res;
    });
  }
  function removeCode() { setApplied(null); emit(); }

  function placeOrder(opts) {
    if (!user) { open('login'); return Promise.resolve({ ok: false, error: 'Please log in first.' }); }
    var address = (opts.address || user.address || '').trim();
    if (address.length < MIN_ADDR) return Promise.resolve({ ok: false, error: 'Please enter your full delivery address.' });
    var payload = Object.assign(auth(), { items: opts.items, address: address, code: applied ? applied.code : '' });
    return api('placeOrder', payload).then(function (res) {
      if (res.ok) { user.address = address; setUser(user); setApplied(null); emit(); }
      else if (applied && /referral|first-time|Diwali|own/i.test(res.error || '')) { setApplied(null); emit(); }
      return res;
    });
  }

  /* ---------- small DOM helper ---------- */
  function h(tag, props, kids) {
    var e = document.createElement(tag); props = props || {};
    for (var k in props) {
      if (k === 'class') e.className = props[k];
      else if (k === 'text') e.textContent = props[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), props[k]);
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  /* ---------- styles ---------- */
  /* Neumorphic theme: uses the website's own colour variables (--bg, --ink, --brass, --sh-d, --sh-l ...), so it follows light / dark mode automatically. */
  var css = [
    '.sr-btn,.sr-box,.sr-ov,.sr-cb{--b:var(--bg,#eef1f2);--i:var(--ink,#1b2440);--m:var(--muted,#5b6479);--br:var(--brass,#8f6a2a);--d:var(--sh-d,#c2c9ce);--l:var(--sh-l,#fff);--ln:var(--line,#d3d9de)}',
    '.sr-btn{position:fixed;bottom:18px;z-index:9998;background:var(--b);color:var(--br);border:0;border-radius:99px;padding:13px 22px;font:700 .9rem/1 "DM Sans",system-ui,sans-serif;letter-spacing:.04em;cursor:pointer;box-shadow:6px 6px 14px var(--d),-6px -6px 14px var(--l);transition:box-shadow .2s,transform .2s}',
    '.sr-btn:hover{transform:translateY(-1px);box-shadow:8px 8px 18px var(--d),-8px -8px 18px var(--l)}',
    '.sr-btn:active{transform:scale(.98);box-shadow:inset 4px 4px 9px var(--d),inset -4px -4px 9px var(--l)}',
    '.sr-ov{position:fixed;inset:0;background:rgba(10,14,25,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}',
    '.sr-box{background:var(--b);color:var(--i);border-radius:24px;width:100%;max-width:420px;max-height:92vh;overflow:auto;padding:26px 24px;font:15px/1.5 "DM Sans",system-ui,sans-serif;position:relative;box-shadow:12px 12px 30px rgba(0,0,0,.35),-6px -6px 18px rgba(255,255,255,.06)}',
    '.sr-x{position:absolute;top:12px;right:12px;width:36px;height:36px;border:0;border-radius:50%;background:var(--b);color:var(--i);font-size:22px;line-height:1;cursor:pointer;box-shadow:4px 4px 9px var(--d),-4px -4px 9px var(--l)}',
    '.sr-x:active{box-shadow:inset 3px 3px 6px var(--d),inset -3px -3px 6px var(--l)}',
    '.sr-box h3{margin:0 40px 4px 0;font:600 1.75rem/1.15 "Cormorant Garamond",Georgia,serif;color:var(--i)}',
    '.sr-sub{margin:0 0 16px;color:var(--m);font-size:.9rem}',
    '.sr-tabs{display:flex;gap:10px;margin:4px 0 16px}',
    '.sr-tabs button{flex:1;padding:10px;border:0;border-radius:99px;background:var(--b);color:var(--i);font:600 .9rem "DM Sans",system-ui,sans-serif;cursor:pointer;box-shadow:5px 5px 11px var(--d),-5px -5px 11px var(--l)}',
    '.sr-tabs button.on{color:var(--br);box-shadow:inset 4px 4px 9px var(--d),inset -4px -4px 9px var(--l)}',
    '.sr-box label{display:block;font-size:.82rem;font-weight:600;margin:12px 0 6px;color:var(--m)}',
    '.sr-box input,.sr-box textarea,.sr-cb input{width:100%;box-sizing:border-box;padding:12px 14px;border:0;border-radius:14px;font:inherit;color:var(--i);background:var(--b);box-shadow:inset 4px 4px 9px var(--d),inset -4px -4px 9px var(--l);outline:none}',
    '.sr-box input:focus,.sr-box textarea:focus,.sr-cb input:focus{box-shadow:inset 4px 4px 9px var(--d),inset -4px -4px 9px var(--l),0 0 0 2px var(--br)}',
    '.sr-box input.sr-otp{font:700 1.6rem "DM Sans",monospace;letter-spacing:.45em;text-align:center;padding-left:.45em}',
    '.sr-go{width:100%;margin-top:18px;padding:14px;border:0;border-radius:99px;background:linear-gradient(145deg,#171c28,#0a0d14);color:#f4f6fb;font:700 .82rem "DM Sans",system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;cursor:pointer;box-shadow:8px 8px 18px var(--d),-6px -6px 14px var(--l),inset 1px 1px 2px rgba(255,255,255,.1);transition:box-shadow .2s,transform .2s}',
    '.sr-go:hover{transform:translateY(-1px)}',
    '.sr-go:active{transform:scale(.985);box-shadow:inset 5px 5px 11px rgba(0,0,0,.6),inset -4px -4px 9px rgba(255,255,255,.08)}',
    '.sr-go[disabled]{opacity:.6;cursor:default}',
    '.sr-msg{margin-top:12px;font-size:.88rem;min-height:18px}.sr-err{color:#b3261e}.sr-ok{color:#2e7d4f}',
    '.sr-code{margin:14px 0;padding:18px 14px;background:var(--b);color:var(--br);text-align:center;border-radius:16px;font:700 1.35rem/1.2 "DM Sans",monospace;letter-spacing:.12em;word-break:break-all;box-shadow:inset 5px 5px 11px var(--d),inset -5px -5px 11px var(--l)}',
    '.sr-row{display:flex;gap:12px}',
    '.sr-row button{flex:1;padding:11px;border:0;border-radius:14px;background:var(--b);color:var(--i);font:600 .88rem "DM Sans",system-ui,sans-serif;cursor:pointer;box-shadow:5px 5px 11px var(--d),-5px -5px 11px var(--l);transition:box-shadow .2s}',
    '.sr-row button:active{box-shadow:inset 4px 4px 8px var(--d),inset -4px -4px 8px var(--l)}',
    '.sr-row button.wa{color:#2e7d4f}',
    '.sr-how{font-size:.86rem;color:var(--m);background:var(--b);border-radius:14px;padding:12px 14px;margin-top:16px;border-left:3px solid var(--br);box-shadow:inset 3px 3px 7px var(--d),inset -3px -3px 7px var(--l)}',
    '.sr-link{background:none;border:0;color:var(--br);text-decoration:underline;cursor:pointer;font:inherit;font-weight:600;margin-top:12px;padding:0}.sr-link[disabled]{opacity:.5;cursor:default;text-decoration:none}',
    '.sr-demo{display:inline-block;max-width:calc(100% - 48px);background:var(--b);color:#b3261e;font-size:.68rem;font-weight:700;letter-spacing:.05em;padding:4px 12px;border-radius:99px;margin-bottom:10px;box-shadow:inset 2px 2px 5px var(--d),inset -2px -2px 5px var(--l)}',
    '.sr-cb{border-radius:18px;padding:14px;margin:12px 0;background:var(--b);color:var(--i);font:.92rem/1.45 "DM Sans",system-ui,sans-serif;box-shadow:inset 5px 5px 11px var(--d),inset -5px -5px 11px var(--l)}',
    '.sr-cb .sr-row{align-items:stretch;margin-top:8px}',
    '.sr-cb .sr-row input{flex:2;width:auto;min-width:0;text-transform:uppercase;letter-spacing:.06em;box-sizing:border-box;padding:11px 14px}',
    '.sr-cb .sr-row button{flex:1}',
    '@media(prefers-reduced-motion:reduce){.sr-btn,.sr-go,.sr-row button{transition:none}}'
  ].join('');
  document.head.appendChild(h('style', { text: css }));

  /* ---------- modal ---------- */
  var overlay = null;
  var pending = null;     // sign-up / log-in details while the OTP is being entered
  function open(view) {
    close();
    overlay = h('div', { class: 'sr-ov', onclick: function (e) { if (e.target === overlay) close(); } });
    document.body.appendChild(overlay);
    render(view || (user ? 'account' : 'signup'));
    if (user && (view === 'account' || !view)) refreshMe();
  }
  function refreshMe() {
    api('me', auth()).then(function (res) {
      if (!res || !res.ok || !user) return;
      user.code = res.code || ''; user.codeVisible = !!res.codeVisible; user.name = res.name || user.name; user.address = res.address || user.address;
      setUser(user); if (overlay) render('account');
    });
  }
  function close() { if (overlay) { overlay.remove(); overlay = null; } pending = null; }

  function field(id, label, type, ph, attrs) {
    var input = type === 'textarea' ? h('textarea', { id: id, rows: '2', placeholder: ph || '' }) : h('input', Object.assign({ id: id, type: type || 'text', placeholder: ph || '' }, attrs || {}));
    return [h('label', { 'for': id, text: label }), input];
  }
  function val(id) { var el = overlay && overlay.querySelector('#' + id); return el ? el.value.trim() : ''; }
  function d10(p) { return String(p || '').replace(/\D/g, '').slice(-10); }

  function render(view) {
    var box = h('div', { class: 'sr-box' });
    box.appendChild(h('button', { class: 'sr-x', 'aria-label': 'Close', text: '\u00d7', onclick: close }));
    if (!CFG.apiUrl) box.appendChild(h('div', { class: 'sr-demo', text: 'DEMO MODE - not connected to your sheet (OTP is 123456)' }));
    var msg = h('div', { class: 'sr-msg' });
    function say(t, ok) { msg.className = 'sr-msg ' + (ok ? 'sr-ok' : 'sr-err'); msg.textContent = t; }

    if (view === 'account' && user) {
      box.appendChild(h('h3', { text: 'Hi ' + user.name.split(' ')[0] + '!' }));
      if (user.code) {
        box.appendChild(h('p', { class: 'sr-sub', text: 'Your personal referral code' }));
        box.appendChild(h('div', { class: 'sr-code', text: user.code }));
        var shareText = 'Use my SAMAY referral code ' + user.code + ' and get ' + CFG.discountText + ' off your first watch! ' + CFG.siteUrl;
        box.appendChild(h('div', { class: 'sr-row' }, [
          h('button', { text: 'Copy code', onclick: function (e) { copy(user.code); e.target.textContent = 'Copied \u2713'; } }),
          h('button', { class: 'wa', text: 'Share on WhatsApp', onclick: function () { window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank'); } })
        ]));
        box.appendChild(h('div', { class: 'sr-how', text: 'Give this code to a friend. They sign up, enter it at checkout and get ' + CFG.discountText + ' off instantly. You get ' + CFG.cashbackText + ' cashback after their return period ends - SAMAY will contact you on your registered phone number to pay it.' }));
      } else {
        box.appendChild(h('div', { class: 'sr-how', text: 'You are signed in. If a friend gave you a referral code, enter it at checkout to get ' + CFG.discountText + ' off your first order.' }));
      }
      box.appendChild(h('button', { class: 'sr-link', text: 'Log out', onclick: function () { setUser(null); emit(); close(); } }));

    } else if (view === 'otp' && pending) {
      box.appendChild(h('h3', { text: 'Enter the OTP' }));
      box.appendChild(h('p', { class: 'sr-sub', text: 'We emailed a 6-digit code to ' + (pending.hint || 'your email') + '. It is valid for 5 minutes. Please check your Spam folder too.' }));
      box.appendChild(h('label', { 'for': 'sr-otp', text: 'OTP' }));
      box.appendChild(h('input', { id: 'sr-otp', class: 'sr-otp', type: 'text', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code', placeholder: '------' }));
      var verify = h('button', { class: 'sr-go', text: pending.mode === 'signup' ? 'Verify & create my account' : 'Verify & log in' });
      verify.addEventListener('click', function () {
        var otp = val('sr-otp').replace(/\D/g, '');
        if (otp.length !== 6) return say('Please enter the 6-digit OTP.', false);
        verify.disabled = true; say('Checking...', true);
        var p = pending.mode === 'signup'
          ? api('register', { name: pending.name, email: pending.email, phone: pending.phone, address: pending.address, otp: otp })
          : api('login', { id: pending.id, otp: otp });
        p.then(function (res) {
          verify.disabled = false;
          if (!res.ok) return say(res.error, false);
          setUser({ name: res.name, email: res.email || pending.email || '', phone: res.phone || pending.phone || '', address: res.address || pending.address || '', code: res.code || '', codeVisible: !!res.codeVisible, token: res.token });
          pending = null; emit(); render('account');
        });
      });
      box.appendChild(verify);
      var resend = h('button', { class: 'sr-link', text: 'Resend OTP' });
      var left = 30;
      function tick() { if (!overlay || !resend.isConnected) return; if (left > 0) { resend.disabled = true; resend.textContent = 'Resend OTP in ' + left + 's'; left--; setTimeout(tick, 1000); } else { resend.disabled = false; resend.textContent = 'Resend OTP'; } }
      tick();
      resend.addEventListener('click', function () {
        resend.disabled = true; say('Sending...', true);
        api('sendOtp', { id: pending.id, purpose: pending.mode === 'signup' ? 'register' : 'login', name: pending.name, email: pending.email, phone: pending.phone, address: pending.address })
          .then(function (res) { if (!res.ok) { resend.disabled = false; return say(res.error, false); } say(res.message || 'OTP sent.', true); left = 30; tick(); });
      });
      box.appendChild(h('div', {}, [resend, h('br'), h('button', { class: 'sr-link', text: 'Change details', onclick: function () { render(pending.mode); } })]));

    } else {
      var isSignup = view !== 'login';
      box.appendChild(h('h3', { text: isSignup ? 'Join SAMAY Refer & Earn' : 'Welcome back' }));
      box.appendChild(h('p', { class: 'sr-sub', text: isSignup ? 'Sign up to use a friend\u2019s referral code and keep your orders in one place. We will email you an OTP to verify your email.' : 'Enter the email (or phone number) you signed up with. We will email you an OTP.' }));
      box.appendChild(h('div', { class: 'sr-tabs' }, [
        h('button', { class: isSignup ? 'on' : '', text: 'Sign up', onclick: function () { render('signup'); } }),
        h('button', { class: isSignup ? '' : 'on', text: 'Log in', onclick: function () { render('login'); } })
      ]));
      var nodes = [];
      if (isSignup) {
        nodes = nodes.concat(field('sr-name', 'Full name *', 'text', 'e.g. Rahul Sen', { autocomplete: 'name' }));
        nodes = nodes.concat(field('sr-email', 'Email address * (we send the OTP here)', 'email', 'you@example.com', { autocomplete: 'email' }));
        nodes = nodes.concat(field('sr-phone', 'Phone number (10 digits) *', 'tel', '98300 12345', { autocomplete: 'tel', inputmode: 'numeric' }));
        nodes = nodes.concat(field('sr-addr', 'Full delivery address *', 'textarea', 'House no, street, city, PIN'));
      } else {
        nodes = nodes.concat(field('sr-id', 'Email or phone number', 'text', 'you@example.com or 98300 12345', { autocomplete: 'username' }));
      }
      nodes.forEach(function (n) { box.appendChild(n); });
      if (pending) {            // coming back from the OTP screen: keep what was typed
        var fv = function (id, v) { var el = box.querySelector('#' + id); if (el) el.value = v || ''; };
        fv('sr-name', pending.name); fv('sr-email', pending.email); fv('sr-phone', pending.phone); fv('sr-addr', pending.address); fv('sr-id', pending.id);
      }
      var go = h('button', { class: 'sr-go', text: 'Send OTP' });
      go.addEventListener('click', function () {
        var name = val('sr-name'), email = val('sr-email').toLowerCase(), phone = d10(val('sr-phone')), address = val('sr-addr'), id = val('sr-id');
        if (isSignup) {
          if (name.length < 2) return say('Please enter your full name.', false);
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return say('Please enter a valid email address.', false);
          if (phone.length !== 10) return say('Please enter a valid 10-digit phone number.', false);
          if (address.length < MIN_ADDR) return say('Please enter your full delivery address (house no, street, city, PIN).', false);
        } else if (!id) return say('Please enter your email or phone number.', false);
        go.disabled = true; say('Sending OTP...', true);
        api('sendOtp', { id: id, purpose: isSignup ? 'register' : 'login', name: name, email: email, phone: phone, address: address }).then(function (res) {
          go.disabled = false;
          if (!res.ok) return say(res.error, false);
          pending = { mode: isSignup ? 'signup' : 'login', name: name, email: email, phone: phone, address: address, id: id, hint: res.hint || '' };
          render('otp');
        });
      });
      box.appendChild(go);
    }
    box.appendChild(msg);
    overlay.innerHTML = ''; overlay.appendChild(box);
  }

  function copy(t) {
    if (navigator.clipboard) navigator.clipboard.writeText(t).catch(function () {});
    else { var i = h('input'); i.value = t; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); }
  }

  /* ---------- referral-code box for cart / checkout ---------- */
  function mountCodeBox(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    if (boxes.indexOf(el) < 0) boxes.push(el);
    renderBox(el);
  }
  function renderBox(el) {
    if (!el.isConnected) { var i = boxes.indexOf(el); if (i >= 0) boxes.splice(i, 1); return; }
    el.innerHTML = '';
    var wrap = h('div', { class: 'sr-cb' });
    if (!user) {
      wrap.appendChild(h('div', { text: 'Have a friend\u2019s referral code? Log in (email OTP) to get ' + CFG.discountText + ' off your first order.' }));
      wrap.appendChild(h('button', { class: 'sr-link', text: 'Log in / Sign up', onclick: function () { open('login'); } }));
    } else if (applied) {
      wrap.appendChild(h('div', { class: 'sr-ok', text: '\u2713 Code ' + applied.code + ' applied - Rs ' + applied.discount + ' off' + (applied.referrer ? ' (referred by ' + applied.referrer + ')' : '') }));
      wrap.appendChild(h('button', { class: 'sr-link', text: 'Remove', onclick: removeCode }));
    } else {
      var inp = h('input', { placeholder: 'Referral code', 'aria-label': 'Referral code' });
      var m = h('div', { class: 'sr-msg' });
      var b = h('button', { text: 'Apply' });
      b.addEventListener('click', function () {
        if (!inp.value.trim()) { m.className = 'sr-msg sr-err'; m.textContent = 'Please enter a code.'; return; }
        b.disabled = true;
        applyCode(inp.value).then(function (res) { b.disabled = false; if (!res.ok) { m.className = 'sr-msg sr-err'; m.textContent = res.error; } });
      });
      wrap.appendChild(h('div', { text: 'Referral code (from a friend)' }));
      wrap.appendChild(h('div', { class: 'sr-row' }, [inp, b]));
      wrap.appendChild(m);
    }
    el.appendChild(wrap);
  }

  /* ---------- floating button ---------- */
  if (CFG.showButton) {
    var fb = h('button', { class: 'sr-btn', text: '\uD83C\uDF81 Refer & Earn', onclick: function () { open(); } });
    fb.style[CFG.buttonPosition === 'right' ? 'right' : 'left'] = '18px';
    document.body.appendChild(fb);
  }

  /* ---------- DEMO mode: a fake database inside the browser (OTP is always 123456) ---------- */
  function mockApi(req) {
    var db = read(localStorage, 'samay_mock_db') || { customers: [{ name: 'Rahul Sen', email: 'rahul@example.com', phone: '9830012345', address: '12 Park Street, Kolkata', code: 'SAMAY-RAH2345', purchased: true, show: true }], referred: [], orders: [] };
    function save() { write(localStorage, 'samay_mock_db', db); }
    function byPhone(p) { return db.customers.filter(function (c) { return c.phone === p; })[0]; }
    function tokenOf(c) { return 'demo.' + c.phone; }
    function me() { var t = String(req.token || ''); return t.indexOf('demo.') === 0 ? byPhone(t.slice(5)) : null; }
    function check(m, code) {
      code = String(code || '').trim().toUpperCase();
      var owner = db.customers.filter(function (c) { return c.code === code; })[0];
      if (!code) return { ok: false, error: 'Please enter a referral code.' };
      if (!owner) return { ok: false, error: 'This referral code is not valid. Please check and try again.' };
      if (owner.phone === m.phone) return { ok: false, error: 'You cannot use your own referral code.' };
      if (m.purchased) return { ok: false, error: 'The referral discount is only for first-time buyers.' };
      if (db.referred.indexOf(m.phone) >= 0) return { ok: false, error: 'A referral code has already been used on this number.' };
      return { ok: true, discount: 100, code: code, referrerName: owner.name.split(' ')[0] };
    }
    function otpOk() { return String(req.otp || '').replace(/\D/g, '') === '123456'; }
    function byEmail(e) { e = String(e || '').trim().toLowerCase(); return db.customers.filter(function (c) { return c.email === e; })[0]; }
    function byId(id) { id = String(id || '').trim(); return id.indexOf('@') >= 0 ? byEmail(id) : byPhone(d10(id)); }
    function view(c) { return { ok: true, name: c.name, email: c.email, phone: c.phone, address: c.address, purchased: c.purchased, codeVisible: !!c.show, code: c.show ? c.code : '' }; }
    var out, m, ph = d10(req.phone), em = String(req.email || '').trim().toLowerCase();
    if (req.action === 'sendOtp') {
      if (req.purpose === 'register') {
        if (String(req.name || '').trim().length < 2) out = { ok: false, error: 'Please enter your full name.' };
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(em)) out = { ok: false, error: 'Please enter a valid email address.' };
        else if (ph.length !== 10) out = { ok: false, error: 'Please enter a valid 10-digit phone number.' };
        else if (String(req.address || '').trim().length < MIN_ADDR) out = { ok: false, error: 'Please enter your full delivery address (house no, street, city, PIN).' };
        else if (byEmail(em) || byPhone(ph)) out = { ok: false, error: 'This email or phone number is already registered. Please use Log in.' };
        else out = { ok: true, hint: em.charAt(0) + '***@' + em.split('@')[1], message: 'DEMO: your OTP is 123456' };
      } else {
        var lc = byId(req.id);
        out = lc ? { ok: true, hint: lc.email.charAt(0) + '***@' + lc.email.split('@')[1], message: 'DEMO: your OTP is 123456' } : { ok: false, error: 'We could not find an account with this email or phone number. Please sign up first.' };
      }
    } else if (req.action === 'register') {
      var nm = String(req.name || '').trim(), ad = String(req.address || '').trim();
      if (!otpOk()) out = { ok: false, error: 'That OTP is not correct.' };
      else if (nm.length < 2 || ph.length !== 10 || ad.length < MIN_ADDR || !em) out = { ok: false, error: 'Please fill in all the details.' };
      else if (byEmail(em) || byPhone(ph)) out = { ok: false, error: 'This email or phone number is already registered. Please use Log in.' };
      else {
        var base = 'SAMAY-' + (nm.toUpperCase().replace(/[^A-Z]/g, '') + 'XXX').slice(0, 3) + ph.slice(-4), code = base, n = 1;
        while (db.customers.some(function (c) { return c.code === code; })) { n++; code = base + '-' + n; }
        var c = { name: nm, email: em, phone: ph, address: ad, code: code, purchased: false, show: false }; db.customers.push(c); save();
        out = Object.assign(view(c), { token: tokenOf(c) });
      }
    } else if (req.action === 'login') {
      var cu = byId(req.id);
      if (!cu) out = { ok: false, error: 'We could not find an account with this email or phone number. Please sign up first.' };
      else if (!otpOk()) out = { ok: false, error: 'That OTP is not correct.' };
      else out = Object.assign(view(cu), { token: tokenOf(cu) });
    } else if ((m = me()) == null) {
      out = { ok: false, relogin: true, error: 'Your session has ended. Please log in again.' };
    } else if (req.action === 'me') out = view(m);
    else if (req.action === 'checkCode') out = check(m, req.code);
    else if (req.action === 'placeOrder') {
      var sub = 0; (req.items || []).forEach(function (i) { sub += i.qty * i.price; });
      var disc = 0, c2 = '';
      if (req.code) { var r = check(m, req.code); if (!r.ok) return Promise.resolve(r); disc = Math.min(r.discount, sub); c2 = r.code; db.referred.push(m.phone); }
      m.purchased = true; var id = 'SAM-DEMO-' + (db.orders.length + 1); db.orders.push({ id: id }); save();
      out = { ok: true, orderId: id, subtotal: sub, discount: disc, payable: sub - disc, code: c2 };
    } else out = { ok: false, error: 'Unknown action.' };
    return Promise.resolve(out);
  }

  window.SamayReferral = { open: open, close: close, user: function () { return user; }, logout: function () { setUser(null); emit(); },
    applyCode: applyCode, removeCode: removeCode, discount: discount, appliedCode: function () { return applied ? applied.code : ''; },
    mountCodeBox: mountCodeBox, placeOrder: placeOrder, config: CFG };
})();
