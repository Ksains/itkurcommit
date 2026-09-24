const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const Profiles=require('../assets/profiles.js');
const source=fs.readFileSync(path.join(__dirname,'../assets/app.js'),'utf8');
const good={name:'Анна',github:'anna',birthDate:'05.09.2007',direction:'Frontend',skills:'HTML, CSS',fact:'Изучаю разработку интерфейсов.',projectTitle:'Навигатор',projectDescription:'Хочу создать приложение с полезными материалами для новых участников.'};
async function setup({stored=null,denied=false,offline=false,team=[]}={}){
 const elements=new Map();
 function element(){return {value:'',textContent:'',hidden:false,children:[],listeners:{},validityMessage:'',append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},addEventListener(type,fn){this.listeners[type]=fn;},setCustomValidity(text){this.validityMessage=text;},click(){},remove(){}};}
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const fields=Object.fromEntries(Object.keys(Profiles.labels).map(key=>[key,element()]));
 const form=get('onboarding');form.elements={namedItem:key=>fields[key]};form.reportValidity=()=>Object.values(fields).every(field=>!field.validityMessage);
 const state={stored,blob:null,download:null};
 const document={getElementById:get,createElement:element,body:{append(link){state.download=link.download;}}};
 const context=vm.createContext({Profiles,document,localStorage:{getItem(){if(denied)throw Error();return state.stored;},setItem(key,value){if(denied)throw Error();state.stored=value;}},fetch:async()=>{if(offline)throw Error();return {ok:true,json:async()=>team};},URL:{createObjectURL(blob){state.blob=blob;return 'blob:test';},revokeObjectURL(){}},Blob,setTimeout(fn){fn();},console});
 vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 const input=(key,value)=>{fields[key].value=value;form.listeners.input({target:fields[key]});};
 return {get,fields,state,input,fill(){for(const[key,value]of Object.entries(good))input(key,value);},submit(){form.listeners.submit({preventDefault(){}});}};
}
test('downloads uniquely named complete JSON without publishing draft',async()=>{
 const app=await setup();app.fill();app.submit();assert.equal(app.state.download,'anna.json');const profile=JSON.parse(await app.state.blob.text());assert.deepEqual(Profiles.validate(profile),{});assert.equal(profile.birthDate,good.birthDate);assert.equal(profile.projectDescription,good.projectDescription);assert.equal(app.get('team-list').children.length,0);
});
test('empty project downloads; invalid nonempty description blocks until corrected',async()=>{
 const app=await setup();app.fill();app.input('projectDescription','Коротко');app.submit();assert.equal(app.state.blob,null);assert.ok(app.fields.projectDescription.validityMessage);app.input('projectDescription',good.projectDescription);app.submit();assert.ok(app.state.blob);
 const optional=await setup();optional.fill();optional.input('projectTitle','');optional.input('projectDescription','');optional.submit();assert.equal(optional.state.download,'anna.json');assert.equal(optional.get('draft-card').children[0].children.length,5);
});
test('invalid birth date blocks the download until corrected',async()=>{
 const app=await setup();app.fill();app.input('birthDate','31.02.2007');app.submit();assert.equal(app.state.blob,null);assert.ok(app.fields.birthDate.validityMessage);
 app.input('birthDate','05.09.2007');app.submit();assert.equal(app.state.download,'anna.json');
});
test('multiple repository cards render, no HTML injection in text',async()=>{
 const profile=Profiles.fromForm(good);const app=await setup({team:[profile,{...profile,github:'@amir',name:'<script>alert(1)</script>'}]});assert.equal(app.get('team-list').children.length,2);const text=JSON.stringify(app.get('team-list').children);assert.match(text,/<script>alert\(1\)<\/script>/);assert.match(text,/Навигатор/);assert.match(text,/05\.09\.2007/);
});
test('old profile drafts survive and new project fields persist',async()=>{
 const old=await setup({stored:JSON.stringify({name:'Анна',github:'@anna',direction:'Frontend',skills:'HTML, CSS',fact:good.fact})});assert.equal(old.fields.name.value,'Анна');assert.equal(old.fields.projectDescription.value,'');old.fill();const restored=await setup({stored:old.state.stored});assert.equal(restored.fields.projectDescription.value,good.projectDescription);
});
test('network and storage failures are visible without blocking export',async()=>{
 const app=await setup({offline:true,denied:true});assert.equal(app.get('reload-team').hidden,false);assert.match(app.get('team-message').textContent,/Не удалось/);app.fill();app.submit();assert.ok(app.state.blob);assert.match(app.get('save-status').textContent,/не разрешил/);
});
