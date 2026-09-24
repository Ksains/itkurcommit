const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const Profiles=require('../assets/profiles.js');
const {collect}=require('../scripts/participants.cjs');
const {build}=require('../scripts/build.cjs');
const {createServer}=require('../server.cjs');
const valid=(login='anna')=>({name:'Анна',github:'@'+login,birthDate:'05.09.2007',direction:'Frontend',skills:['HTML','CSS'],fact:'Мне нравится создавать полезные интерфейсы.',projectTitle:'Навигатор',projectDescription:'Хочу собрать инструкции для первокурсников в одном удобном приложении.'});
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'team-cards-test-'));t.after(async()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('team-cards-test-'));await fs.rm(root,{recursive:true,force:true});});await fs.mkdir(path.join(root,'participants'));return root;}
test('project is optional, provided fields are valid, and skills remain required',()=>{
 assert.deepEqual(Profiles.validate(valid()),{});
 assert.deepEqual(Profiles.validate({...valid(),projectTitle:'',projectDescription:''}),{});
 assert.deepEqual(Profiles.validate({...valid(),projectTitle:undefined,projectDescription:undefined}),{});
 assert.ok(Profiles.validate({...valid(),projectDescription:'Коротко'}).projectDescription);
 assert.ok(Profiles.validate({...valid(),name:''}).name);
 assert.ok(Profiles.validate({...valid(),skills:['CSS','css']}).skills);
 assert.ok(Profiles.validate({...valid(),github:'@../bad'}).github);
 assert.ok(Profiles.validate({...valid(),projectTitle:'Название проекта'}).projectTitle);
 assert.ok(Profiles.validate({...valid(),birthDate:undefined}).birthDate);
 assert.ok(Profiles.validate({...valid(),birthDate:'5.9.2007'}).birthDate);
 assert.ok(Profiles.validate({...valid(),birthDate:'31.02.2007'}).birthDate);
 assert.ok(Profiles.validate({...valid(),birthDate:'29.02.2007'}).birthDate);
 assert.deepEqual(Profiles.validate({...valid(),birthDate:'29.02.2008'}),{});
 assert.ok(Profiles.validate({...valid(),birthDate:'01.01.9999'}).birthDate);
 assert.equal(Profiles.filename({...valid(),github:'@Anna'}),'anna.json');
});
test('collects every participant, strips extra fields and supports empty team',async t=>{
 const root=await fixture(t);assert.deepEqual(await collect(root),[]);
 await fs.writeFile(path.join(root,'participants/anna.json'),JSON.stringify({...valid(),privateNote:'do not publish'}));
 await fs.writeFile(path.join(root,'participants/amir.json'),JSON.stringify({...valid('amir'),name:'Амир'}));
 const list=await collect(root);assert.equal(list.length,2);assert.ok(list.some(p=>p.github==='@anna'));assert.ok(list.every(p=>!('privateNote'in p)));
});
test('rejects wrong filenames, invalid JSON and invalid optional project text',async t=>{
 const root=await fixture(t);const file=path.join(root,'participants/wrong.json');
 await fs.writeFile(file,JSON.stringify(valid()));await assert.rejects(collect(root),/anna.json/);
 await fs.writeFile(file,'{bad');await assert.rejects(collect(root),/wrong.json/);
 await fs.writeFile(file,JSON.stringify({...valid(),projectDescription:'Коротко'}));await assert.rejects(collect(root),/Описание проекта/);
 await fs.writeFile(file,JSON.stringify({...valid(),birthDate:'31.02.2007'}));await assert.rejects(collect(root),/дату рождения/);
});
test('build publishes two independent cards and uses relative asset paths',async t=>{
 const root=await fixture(t);const project=path.resolve(__dirname,'..');await fs.mkdir(path.join(root,'assets'));
 for(const file of ['index.html','assets/app.js','assets/profiles.js','assets/style.css','assets/avatar.svg','assets/ui.js','assets/golos-text.ttf','assets/font-license.txt'])await fs.copyFile(path.join(project,file),path.join(root,file));
 await fs.writeFile(path.join(root,'participants/anna.json'),JSON.stringify(valid('anna')));
 await fs.writeFile(path.join(root,'participants/amir.json'),JSON.stringify({...valid('amir'),projectTitle:'',projectDescription:''}));
 assert.equal(await build(root),2);
 const list=JSON.parse(await fs.readFile(path.join(root,'dist/data/participants.json'),'utf8'));assert.equal(list.length,2);
 assert.equal(list.find(p=>p.github==='@amir').projectTitle,'');
 const html=await fs.readFile(path.join(root,'dist/index.html'),'utf8');assert.ok(html.includes('src="assets/app.js"'));assert.ok(html.includes('projectDescription'));
});
test('local server reflects new files, blocks arbitrary paths and matches build data',async t=>{
 const root=await fixture(t);const server=createServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.deepEqual(await(await fetch(base+'/data/participants.json')).json(),[]);
 await fs.writeFile(path.join(root,'participants/anna.json'),JSON.stringify(valid()));
 assert.equal((await(await fetch(base+'/data/participants.json')).json()).length,1);
 assert.equal((await fetch(base+'/.git/config')).status,404);
 assert.equal((await fetch(base+'/data/participants.json',{method:'POST'})).status,405);
});


