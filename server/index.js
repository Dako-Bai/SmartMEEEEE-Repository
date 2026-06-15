require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { db, run, all, get, init } = require('./db');
const nodemailer = require('nodemailer');
const EventEmitter = require('events');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@navarro.local';

const notifier = new EventEmitter();

app.use(bodyParser.json());

// CORS - allow credentials so cookies can be used
app.use(cors({ origin: (process.env.FRONTEND_ORIGIN || 'http://localhost:4000'), credentials: true }));

// serve admin static
app.use('/admin', express.static(path.join(__dirname, 'public')));

// initialize DB
init().catch(err=>{ console.error('DB init error', err); });

// nodemailer transport
let transporter = null;
if(process.env.SMTP_HOST){
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
} else {
  console.warn('SMTP not configured, emails will be logged to console');
}

async function sendEmail(to, subject, text, html){
  if(transporter){
    await transporter.sendMail({ from: process.env.FROM_EMAIL || 'no-reply@navarro.local', to, subject, text, html });
  } else {
    console.log('Email (mock) ->', to, subject, text);
  }
}

// auth helpers
function signToken(payload){ return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' }); }

function extractTokenFromRequest(req){
  // 1) Authorization header
  const auth = req.headers.authorization;
  if(auth){
    const [type, token] = auth.split(' ');
    if(type === 'Bearer' && token) return token;
  }
  // 2) cookie header
  const cookie = req.headers.cookie; // raw cookie string
  if(cookie){
    const parts = cookie.split(';').map(p=>p.trim());
    for(const p of parts){
      if(p.startsWith('token=')) return p.substring('token='.length);
    }
  }
  // 3) fallback query
  if(req.query && req.query.token) return req.query.token;
  return null;
}

async function authMiddleware(req, res, next){
  try{
    const token = extractTokenFromRequest(req);
    if(!token) return res.status(401).json({ error: 'Missing auth' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch(e){ return res.status(401).json({ error: 'Invalid token' }); }
}

function roleCheck(roles){ return (req,res,next)=>{ if(!req.user) return res.status(401).json({error:'not auth'}); if(roles.includes(req.user.role)) return next(); return res.status(403).json({error:'forbidden'}); } }

// audit logger
async function auditLog(user, action, targetType, targetId, beforeObj, afterObj, ip){
  const id = uuidv4();
  const now = new Date().toISOString();
  const summary = `${user.username} (${user.role}) ${action} ${targetType} ${targetId}`;
  await run(`INSERT INTO audit (id, user_id, user_name, action, target_type, target_id, summary, before_data, after_data, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [id, user.id, user.username, action, targetType, targetId, summary, JSON.stringify(beforeObj||{}), JSON.stringify(afterObj||{}), ip||'', now]);
  // create notification for admin
  const noteId = uuidv4();
  const title = `Өзгеріс: ${targetType} ${action}`;
  const message = `${user.name || user.username} өзгеріс жасады: ${summary} — ${now}`;
  await run(`INSERT INTO notifications (id, user_id, title, message, read, payload, created_at) VALUES (?,?,?,?,?,?,?)`, [noteId, user.id, title, message, 0, JSON.stringify({before:beforeObj,after:afterObj}), now]);
  notifier.emit('notification', { id: noteId, title, message, created_at: now });
  // send email to admin
  const emailText = `Пайдаланушы: ${user.name || user.username} (${user.username})\nӘрекет: ${action}\nНысан: ${targetType} (${targetId})\nУақыт: ${now}\n\nҚысқаша: ${summary}`;
  try{ await sendEmail(ADMIN_EMAIL, `[Navarro] Өзгеріс: ${targetType}`, emailText); } catch(e){ console.error('Email error', e); }
}

// routes
app.post('/api/auth/login', async (req,res)=>{
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error:'username and password required' });
  try{
    const row = await get(`SELECT * FROM users WHERE username = ?`, [username]);
    if(!row) return res.status(401).json({ error:'invalid credentials' });
    const ok = await bcrypt.compare(password, row.password_hash);
    if(!ok) return res.status(401).json({ error:'invalid credentials' });
    const token = signToken({ id: row.id, username: row.username, role: row.role, name: row.name });
    // set HTTP-only cookie
    res.cookie = (name, value, opts) => { // minimal cookie setter for environments without cookie lib
      let str = `${name}=${value}; Path=/;`;
      if(opts && opts.maxAge) str += ` Max-Age=${opts.maxAge/1000};`;
      if(opts && opts.httpOnly) str += ' HttpOnly;';
      if(opts && opts.secure) str += ' Secure;';
      if(opts && opts.sameSite) str += ` SameSite=${opts.sameSite};`;
      res.setHeader('Set-Cookie', str);
    };
    const cookieSecure = process.env.COOKIE_SECURE === 'true';
    res.cookie('token', token, { httpOnly: true, secure: cookieSecure, sameSite: 'Lax', maxAge: 8*3600*1000 });
    res.json({ user: { id: row.id, username: row.username, role: row.role, name: row.name, email: row.email } });
  } catch(e){ console.error(e); res.status(500).json({ error:'server error' }); }
});

app.post('/api/auth/logout', (req,res)=>{
  // clear cookie
  res.setHeader('Set-Cookie', 'token=; Path=/; Max-Age=0; HttpOnly;');
  res.json({ ok: true });
});

app.get('/api/users/me', authMiddleware, async (req,res)=>{
  const u = await get(`SELECT id, username, name, email, role, active, created_at FROM users WHERE id = ?`, [req.user.id]);
  res.json({ user: u });
});

// pricing
app.get('/api/pricing', async (req,res)=>{
  const rows = await all(`SELECT * FROM pricing ORDER BY region, product`);
  res.json(rows);
});
app.post('/api/pricing', authMiddleware, roleCheck(['Admin','Manager']), async (req,res)=>{
  const { product, region, price } = req.body;
  const id = uuidv4(); const now = new Date().toISOString();
  await run(`INSERT INTO pricing (id, product, region, price, created_at) VALUES (?,?,?,?,?)`, [id, product, region, price, now]);
  // audit
  await auditLog(req.user, 'create', 'pricing', id, null, {product,region,price}, req.ip);
  res.json({ id });
});
app.put('/api/pricing/:id', authMiddleware, roleCheck(['Admin','Manager']), async (req,res)=>{
  const id = req.params.id; const before = await get(`SELECT * FROM pricing WHERE id = ?`, [id]);
  if(!before) return res.status(404).json({error:'not found'});
  const { product, region, price } = req.body; await run(`UPDATE pricing SET product=?, region=?, price=? WHERE id=?`, [product,region,price,id]);
  const after = await get(`SELECT * FROM pricing WHERE id = ?`, [id]);
  await auditLog(req.user, 'update', 'pricing', id, before, after, req.ip);
  res.json(after);
});
app.delete('/api/pricing/:id', authMiddleware, roleCheck(['Admin','Manager']), async (req,res)=>{
  const id = req.params.id; const before = await get(`SELECT * FROM pricing WHERE id = ?`, [id]);
  if(!before) return res.status(404).json({error:'not found'});
  await run(`DELETE FROM pricing WHERE id = ?`, [id]);
  await auditLog(req.user, 'delete', 'pricing', id, before, null, req.ip);
  res.json({ deleted: true });
});

// inventory (similar)
app.get('/api/inventory', async (req,res)=>{ const rows = await all('SELECT * FROM inventory ORDER BY location'); res.json(rows); });
app.post('/api/inventory', authMiddleware, roleCheck(['Admin','Manager']), async (req,res)=>{ const { product, location, current, capacity } = req.body; const id=uuidv4(); const now=new Date().toISOString(); await run('INSERT INTO inventory (id,product,location,current,capacity,created_at) VALUES (?,?,?,?,?,?)',[id,product,location,current,capacity,now]); await auditLog(req.user,'create','inventory',id,null,{product,location,current,capacity},req.ip); res.json({id}); });
app.put('/api/inventory/:id', authMiddleware, roleCheck(['Admin','Manager']), async (req,res)=>{ const id=req.params.id; const before=await get('SELECT * FROM inventory WHERE id=?',[id]); if(!before) return res.status(404).json({error:'not found'}); const { product, location, current, capacity } = req.body; await run('UPDATE inventory SET product=?, location=?, current=?, capacity=? WHERE id=?',[product,location,current,capacity,id]); const after=await get('SELECT * FROM inventory WHERE id=?',[id]); await auditLog(req.user,'update','inventory',id,before,after,req.ip); res.json(after); });
app.delete('/api/inventory/:id', authMiddleware, roleCheck(['Admin','Manager']), async (req,res)=>{ const id=req.params.id; const before=await get('SELECT * FROM inventory WHERE id=?',[id]); if(!before) return res.status(404).json({error:'not found'}); await run('DELETE FROM inventory WHERE id=?',[id]); await auditLog(req.user,'delete','inventory',id,before,null,req.ip); res.json({deleted:true}); });

// orders
app.get('/api/orders', authMiddleware, async (req,res)=>{
  if(['Admin','Manager'].includes(req.user.role)){
    const rows = await all('SELECT * FROM orders ORDER BY created_at DESC'); res.json(rows);
  } else {
    const rows = await all('SELECT * FROM orders WHERE client = ? ORDER BY created_at DESC', [req.user.username]); res.json(rows);
  }
});
app.post('/api/orders', authMiddleware, async (req,res)=>{ const { client, product, amount, region, status } = req.body; const id=uuidv4(); const now=new Date().toISOString(); await run('INSERT INTO orders (id,client,product,amount,region,status,created_at) VALUES (?,?,?,?,?,?,?)',[id,client,product,amount,region,status||'Ағымдағы',now]); await auditLog(req.user,'create','order',id,null,{client,product,amount,region,status},req.ip); res.json({id}); });
app.put('/api/orders/:id', authMiddleware, roleCheck(['Admin','Manager','Operator']), async (req,res)=>{ const id=req.params.id; const before=await get('SELECT * FROM orders WHERE id=?',[id]); if(!before) return res.status(404).json({error:'not found'}); const { client, product, amount, region, status } = req.body; await run('UPDATE orders SET client=?, product=?, amount=?, region=?, status=? WHERE id=?',[client,product,amount,region,status,id]); const after=await get('SELECT * FROM orders WHERE id=?',[id]); await auditLog(req.user,'update','order',id,before,after,req.ip); res.json(after); });
app.delete('/api/orders/:id', authMiddleware, roleCheck(['Admin','Manager']), async (req,res)=>{ const id=req.params.id; const before=await get('SELECT * FROM orders WHERE id=?',[id]); if(!before) return res.status(404).json({error:'not found'}); await run('DELETE FROM orders WHERE id=?',[id]); await auditLog(req.user,'delete','order',id,before,null,req.ip); res.json({deleted:true}); });

// audit
app.get('/api/audit', authMiddleware, roleCheck(['Admin']), async (req,res)=>{ const { user, target, from, to } = req.query; let q = 'SELECT * FROM audit'; let where=[]; let params=[]; if(user){ where.push('user_name = ?'); params.push(user);} if(target){ where.push('target_type = ?'); params.push(target);} if(from){ where.push('created_at >= ?'); params.push(from);} if(to){ where.push('created_at <= ?'); params.push(to);} if(where.length) q += ' WHERE ' + where.join(' AND '); q += ' ORDER BY created_at DESC LIMIT 1000'; const rows = await all(q, params); res.json(rows); });

// notifications
app.get('/api/notifications', authMiddleware, roleCheck(['Admin']), async (req,res)=>{ const rows = await all('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200'); res.json(rows); });

app.get('/api/notifications/stream', authMiddleware, roleCheck(['Admin']), (req,res)=>{
  res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache'); res.setHeader('Connection','keep-alive');
  const onNotify = (n)=>{ res.write(`event: notification\ndata: ${JSON.stringify(n)}\n\n`); };
  notifier.on('notification', onNotify);
  req.on('close', ()=>{ notifier.off('notification', onNotify); });
});

// simple reports export (CSV)
app.get('/api/reports/export/orders.csv', authMiddleware, roleCheck(['Admin','Manager']), async (req,res)=>{
  const rows = await all('SELECT * FROM orders ORDER BY created_at DESC');
  const csv = ['id,client,product,amount,region,status,created_at'];
  for(const r of rows) csv.push([r.id,r.client,r.product,r.amount,r.region,r.status,r.created_at].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','));
  res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename="orders.csv"'); res.send(csv.join('\n'));
});

app.listen(PORT, ()=>{ console.log('Server running on', PORT); console.log('JWT_SECRET', JWT_SECRET==='dev_jwt_secret_change_me'?'[USING DEFAULT - change in .env]':'[OK]'); });
