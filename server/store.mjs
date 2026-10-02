import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

const sydney = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
export function sydneyDay(value) {
  const parts = Object.fromEntries(sydney.formatToParts(value).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export class StatsStore {
  constructor(filename, clock=()=>new Date()) {
    this.clock=clock;
    if (filename!==':memory:') mkdirSync(dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename,{timeout:5000});
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS visits (visitor TEXT NOT NULL,request_id TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(visitor,request_id));
      CREATE TABLE IF NOT EXISTS visitors (visitor TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS daily_visitors (day TEXT NOT NULL,visitor TEXT NOT NULL,PRIMARY KEY(day,visitor));
      CREATE TABLE IF NOT EXISTS likes (visitor TEXT PRIMARY KEY,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS content_likes (content_type TEXT NOT NULL,content_id TEXT NOT NULL,visitor TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(content_type,content_id,visitor));`);
    const insert=this.db.prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)');
    insert.run('started_at',sydneyDay(this.clock()));
    insert.run('cookie_secret',randomBytes(32).toString('hex'));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (!this.db.prepare('SELECT 1 FROM metadata WHERE key=?').get('unique_visitors_migrated')) {
        // Recount existing visitors once; keep legacy page views for recovery.
        this.db.exec(`INSERT OR IGNORE INTO visitors(visitor)
          SELECT visitor FROM visits UNION SELECT visitor FROM daily_visitors;`);
        insert.run('unique_visitors_migrated','1');
      }
      this.db.exec('COMMIT');
    } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    this.secret=this.db.prepare('SELECT value FROM metadata WHERE key=?').get('cookie_secret').value;
    this.startedAt=this.db.prepare('SELECT value FROM metadata WHERE key=?').get('started_at').value;
  }
  read(visitor) {
    const day=sydneyDay(this.clock());
    return {
      todayVisitors:this.db.prepare('SELECT COUNT(*) AS count FROM daily_visitors WHERE day=?').get(day).count,
      totalVisits:this.db.prepare('SELECT COUNT(*) AS count FROM visitors').get().count,
      runningDays:Math.max(1,Math.round((Date.parse(day)-Date.parse(this.startedAt))/86400000)+1),
      likes:this.db.prepare('SELECT COUNT(*) AS count FROM likes').get().count,
      liked:!!this.db.prepare('SELECT 1 FROM likes WHERE visitor=?').get(visitor || ''),
      startedAt:this.startedAt,
      date:day
    };
  }
  visit(visitor) {
    const day=sydneyDay(this.clock());
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT OR IGNORE INTO visitors(visitor) VALUES(?)').run(visitor);
      this.db.prepare('INSERT OR IGNORE INTO daily_visitors(day,visitor) VALUES(?,?)').run(day,visitor);
      const stats=this.read(visitor);
      this.db.exec('COMMIT');
      return stats;
    } catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }
  like(visitor,liked) {
    if (liked) this.db.prepare('INSERT OR IGNORE INTO likes(visitor,created_at) VALUES(?,?)').run(visitor,this.clock().toISOString());
    else this.db.prepare('DELETE FROM likes WHERE visitor=?').run(visitor);
    return this.read(visitor);
  }
  readContentLikes(type,id,visitor) {
    return {
      likes:this.db.prepare('SELECT COUNT(*) AS count FROM content_likes WHERE content_type=? AND content_id=?').get(type,id).count,
      liked:!!this.db.prepare('SELECT 1 FROM content_likes WHERE content_type=? AND content_id=? AND visitor=?').get(type,id,visitor || '')
    };
  }
  likeContent(type,id,visitor,liked) {
    if (liked) this.db.prepare('INSERT OR IGNORE INTO content_likes(content_type,content_id,visitor,created_at) VALUES(?,?,?,?)').run(type,id,visitor,this.clock().toISOString());
    else this.db.prepare('DELETE FROM content_likes WHERE content_type=? AND content_id=? AND visitor=?').run(type,id,visitor);
    return this.readContentLikes(type,id,visitor);
  }
  close() { this.db.close(); }
}
