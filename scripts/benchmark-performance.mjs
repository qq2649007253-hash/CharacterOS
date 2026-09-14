import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
// Synthetic data in memory: never opens the user's database.
const db = new Database(':memory:');
db.exec('CREATE TABLE knowledge_documents(id TEXT PRIMARY KEY, character_id TEXT, created_at TEXT, content TEXT); CREATE TABLE memories(id TEXT PRIMARY KEY, last_accessed_at TEXT);');
const insert=db.prepare('INSERT INTO knowledge_documents VALUES (?,?,?,?)');
db.transaction(()=>{for(let i=0;i<50000;i++)insert.run(String(i),String(i%100),String(i).padStart(8,'0'),'sample');for(let i=0;i<1000;i++)db.prepare('INSERT INTO memories VALUES (?,?)').run(String(i),'old');})();
const query=db.prepare('SELECT * FROM knowledge_documents WHERE character_id=? ORDER BY created_at');
const expected=query.all('42');
function measure(fn,n=100){for(let i=0;i<10;i++)fn();const times=[];for(let i=0;i<n;i++){const start=performance.now();fn();times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {medianMs:+times[Math.floor(n*.5)].toFixed(3),p95Ms:+times[Math.floor(n*.95)].toFixed(3)};}
const before=measure(()=>query.all('42'));
const source=readFileSync('services/api/src/server/database/client.ts','utf8');
const index=source.match(/CREATE INDEX IF NOT EXISTS knowledge_documents_character_created_idx[^;]+;/)?.[0];assert(index);db.exec(index);
assert.deepEqual(query.all('42'),expected);
const after=measure(()=>query.all('42'));
const plan=db.prepare('EXPLAIN QUERY PLAN SELECT * FROM knowledge_documents WHERE character_id=? ORDER BY created_at').all('42');
assert(plan.some(row=>row.detail.includes('knowledge_documents_character_created_idx')));
const ids=Array.from({length:100},(_,i)=>String(i));const update=db.prepare('UPDATE memories SET last_accessed_at=? WHERE id=?');
const oldWrite=measure(()=>{for(const id of ids)update.run('new',id);});
const bulk=db.prepare(`UPDATE memories SET last_accessed_at=? WHERE id IN (${ids.map(()=>'?').join(',')})`);
const batch=db.transaction(()=>bulk.run('new',...ids));const newWrite=measure(batch);
assert.equal(db.prepare("SELECT count(*) AS n FROM memories WHERE last_accessed_at='new'").get().n,100);
console.log(JSON.stringify({fixture:{documents:50000,characters:100,matchedDocuments:500,memoryIds:100,storage:'in-memory'},knowledge:{before,after,plan},memory:{before:oldWrite,after:newWrite,statementsBefore:100,statementsAfter:1}},null,2));
db.close();
