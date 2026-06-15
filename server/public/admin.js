(function(){
  const el = id=>document.getElementById(id);
  let currentUser = null;

  async function fetchJSON(url, opts={}){
    opts.credentials = 'include';
    if(!opts.headers) opts.headers = {};
    try{
      const r = await fetch(url, opts);
      if(r.status === 401){ showLogin(); throw new Error('Unauthorized'); }
      return await r.json();
    } catch(e){ console.error('fetch error', e); throw e; }
  }

  function showLogin(){
    const u = prompt('Кіру үшін пайдаланушы атауын енгізіңіз (admin):','admin');
    const p = prompt('Құпия сөз енгізіңіз (admin123):','admin123');
    if(u && p) doLogin(u,p);
  }

  async function doLogin(username, password){
    try{
      const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ username, password }) });
      if(!r.ok){ alert('Кіру сәтсіз: ' + (await r.text())); showLogin(); return; }
      const data = await r.json();
      currentUser = data.user;
      el('user-info').innerText = currentUser.name + ' · ' + currentUser.role;
      initAfterLogin();
    } catch(e){ console.error(e); }
  }

  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    location.reload();
  });

  async function initAfterLogin(){
    // fetch stats
    try{
      const pricing = await fetchJSON('/api/pricing');
      el('stat-pricing').innerText = pricing.length;
      const orders = await fetchJSON('/api/orders');
      el('stat-orders').innerText = orders.length || 0;
      // users count (from audit table distinct user?) simple: count audits distinct user
      const audits = await fetchJSON('/api/audit');
      el('audit-list').innerHTML = audits.slice(0,30).map(a=>`<div class="p-2 bg-white/5 rounded"><div class="text-sm">${a.summary}</div><div class="text-xs text-gray-400">${a.created_at}</div></div>`).join('');
      el('stat-users').innerText = new Set(audits.map(a=>a.user_name)).size || '—';
    } catch(e){ console.warn('Could not fetch some data', e); }

    // setup SSE
    try{
      const sse = new EventSource('/api/notifications/stream');
      sse.addEventListener('notification', ev=>{
        const n = JSON.parse(ev.data);
        const node = document.createElement('div');
        node.className = 'p-2 bg-white/5 rounded';
        node.innerHTML = `<div class="text-sm">${n.title}</div><div class="text-xs text-gray-400">${n.created_at}</div>`;
        const box = el('notifications'); box.insertBefore(node, box.firstChild);
      });
    } catch(e){ console.warn('SSE not available', e); }
  }

  // create pricing
  el('createPricing').addEventListener('click', async ()=>{
    const prod = el('p_product').value; const reg = el('p_region').value; const price = Number(el('p_price').value);
    if(!prod || !reg || !price) return alert('Барлық өрістерді толтырыңыз');
    try{
      const res = await fetch('/api/pricing', { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ product: prod, region: reg, price }) });
      if(!res.ok){ alert('Қате: ' + (await res.text())); return; }
      alert('Прайс қосылды'); location.reload();
    } catch(e){ console.error(e); }
  });

  // initial: try to get /api/users/me to see if logged
  (async ()=>{
    try{
      const me = await fetch('/api/users/me', { credentials: 'include' });
      if(me.ok){ const data = await me.json(); currentUser = data.user; el('user-info').innerText = currentUser.name + ' · ' + currentUser.role; initAfterLogin(); }
      else showLogin();
    } catch(e){ showLogin(); }
  })();
})();
