require('dotenv').config();
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const dbFile = path.join(__dirname, 'data.db');
const exists = fs.existsSync(dbFile);
const db = new sqlite3.Database(dbFile);

function run(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err){ if(err) reject(err); else resolve(this); });
  });
}
function all(sql, params=[]) {
  return new Promise((resolve, reject) => { db.all(sql, params, (err, rows) => { if(err) reject(err); else resolve(rows); }); });
}
function get(sql, params=[]) {
  return new Promise((resolve, reject) => { db.get(sql, params, (err, row) => { if(err) reject(err); else resolve(row); }); });
}

async function init(){
  // create tables if not exist
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    name TEXT,
    email TEXT,
    role TEXT,
    password_hash TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS pricing (
    id TEXT PRIMARY KEY,
    product TEXT,
    region TEXT,
    price REAL,
    created_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    product TEXT,
    location TEXT,
    current REAL,
    capacity REAL,
    created_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    client TEXT,
    product TEXT,
    amount REAL,
    region TEXT,
    status TEXT,
    created_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    action TEXT,
    target_type TEXT,
    target_id TEXT,
    summary TEXT,
    before_data TEXT,
    after_data TEXT,
    ip TEXT,
    created_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    message TEXT,
    read INTEGER DEFAULT 0,
    payload TEXT,
    created_at TEXT
  )`);

  // seed users if none
  const row = await get(`SELECT COUNT(1) as c FROM users`);
  if(!row || row.c === 0){
    const bcrypt = require('bcrypt');
    const { v4: uuidv4 } = require('uuid');
    const now = new Date().toISOString();
    const seeds = [
      {username:'admin', name:'System Admin', email:'admin@navarro.local', role:'Admin', password:'admin123'},
      {username:'user1', name:'User One', email:'user1@navarro.local', role:'Client', password:'user123'},
      {username:'user2', name:'User Two', email:'user2@navarro.local', role:'Client', password:'user456'},
      {username:'user3', name:'User Three', email:'user3@navarro.local', role:'Client', password:'user357'}
    ];
    for(const s of seeds){
      const hash = await bcrypt.hash(s.password, 10);
      await run(`INSERT INTO users (id, username, name, email, role, password_hash, active, created_at) VALUES (?,?,?,?,?,?,?,?)`, [uuidv4(), s.username, s.name, s.email, s.role, hash, 1, now]);
    }
    console.log('Seeded users');
  }
}

module.exports = { db, run, all, get, init };

if(require.main === module){ init().then(()=>{ console.log('DB initialized'); db.close(); }).catch(err=>{ console.error(err); db.close(); }); }
