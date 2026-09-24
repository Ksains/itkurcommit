const fs = require('node:fs/promises');
const path = require('node:path');
const Profiles = require('../assets/profiles.js');
async function collect(root) {
  const folder = path.join(root,'participants');
  const entries = await fs.readdir(folder,{withFileTypes:true});
  const errors = [];
  const profiles = [];
  const seen = new Set();
  for (const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
    if (entry.name === '.gitkeep') continue;
    if (!entry.isFile() || !entry.name.endsWith('.json')) { errors.push(`${entry.name}: в participants разрешены только файлы JSON.`); continue; }
    try {
      const file = path.join(folder,entry.name);
      if ((await fs.stat(file)).size > 32768) throw Error('Файл больше 32 КБ.');
      const profile = JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
      const issues = Object.values(Profiles.validate(profile));
      if (issues.length) throw Error(issues.join(' '));
      if (entry.name !== Profiles.filename(profile)) throw Error(`Имя файла должно быть ${Profiles.filename(profile)}.`);
      const key = profile.github.toLowerCase();
      if (seen.has(key)) throw Error('Этот логин уже есть в списке.');
      seen.add(key);
      // Only publish documented fields, never arbitrary extra properties.
      profiles.push(Object.fromEntries(Object.keys(Profiles.labels).map(key=>[key,profile[key]])));
    } catch(error) { errors.push(`${entry.name}: ${error.message}`); }
  }
  if (errors.length) throw Error(errors.join('\n'));
  return profiles;
}
module.exports = {collect};
if (require.main === module) collect(path.resolve(__dirname,'..')).then(items=>console.log(`Проверка пройдена. Карточек: ${items.length}.`)).catch(error=>{console.error(error.message);process.exitCode=1;});
