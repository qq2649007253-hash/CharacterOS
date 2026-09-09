import { companions as seeds } from './seed-companions.mjs';
const appUrl = (process.env.CHARACTEROS_URL || 'http://127.0.0.1:4318').replace(/\/$/, '');
const response = await fetch(`${appUrl}/api/characters`);
if (!response.ok) throw new Error(`无法连接 CharacterOS：HTTP ${response.status}`);
const { items } = await response.json();

let created = 0;
for (const seed of seeds) {
  const existing = items.find((item) => item.name === seed.name);
  if (existing) continue;
  const result = await fetch(`${appUrl}/api/characters`, {
    body: JSON.stringify(seed),
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    method: 'POST',
  });
  if (!result.ok) throw new Error(`创建 ${seed.name} 失败：${await result.text()}`);
  created += 1;
  console.log(`added ${seed.name}`);
}

console.log(`done  created=${created} total=${items.length + created}`);
