const form = document.getElementById('onboarding');
const message = document.getElementById('save-status');
const storageKey = 'it-onboarding-draft-v1';
const keys = Object.keys(Profiles.labels);
const field = key => form.elements.namedItem(key);
const values = () => Object.fromEntries(keys.map(key=>[key,field(key).value.trim()]));
const node = (tag,text,className) => {const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;};
function card(profile) {
  const article=node('article',undefined,'card member-card');
  const header=node('div',undefined,'member-header');
  const avatar=node('img');avatar.src='assets/avatar.svg';avatar.alt='';avatar.className='avatar';
  const title=node('div');title.append(node('h3',profile.name||'Ваше имя'));
  const login=profile.github||'';
  if (/^@[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) {const link=node('a',login);link.href=`https://github.com/${login.slice(1)}`;title.append(link);}
  header.append(avatar,title);article.append(header,node('p',profile.direction||'Ваше направление','label'));
  const skills=node('ul',undefined,'tags');
  for(const item of profile.skills||[])skills.append(node('li',item));
  article.append(skills,node('p',profile.fact||'Здесь появится информация о вас.','fact'));
  if (profile.projectTitle || profile.projectDescription) {
    const project=node('section',undefined,'project');
    project.append(node('span','Хочу реализовать','label'));
    if (profile.projectTitle) project.append(node('h4',profile.projectTitle));
    if (profile.projectDescription) project.append(node('p',profile.projectDescription));
    article.append(project);
  }
  return article;
}
function render() {document.getElementById('draft-card').replaceChildren(card(Profiles.fromForm(values())));}
function saveDraft() {
  try {localStorage.setItem(storageKey,JSON.stringify(values()));message.textContent='Черновик сохранён в этом браузере. Для публикации скачайте карточку и отправьте её через Git.';}
  catch {message.textContent='Браузер не разрешил сохранение черновика. Скачайте карточку перед закрытием страницы.';}
}
form.noValidate=true;
form.addEventListener('input',event=>{if(typeof event.target.setCustomValidity==='function')event.target.setCustomValidity('');render();saveDraft();});
form.addEventListener('submit',event=>{
 event.preventDefault();
 const profile=Profiles.fromForm(values());
 const errors=Profiles.validate(profile);
 keys.forEach(key=>field(key).setCustomValidity(errors[key]||''));
 if(!form.reportValidity())return;
 const filename=Profiles.filename(profile);
 const url=URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)+'\n'],{type:'application/json;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 saveDraft();message.textContent+=` Скачивание ${filename} запрошено. Поместите его в participants/${filename}.`;
});
async function loadTeam() {
 const feedback=document.getElementById('team-message'),retry=document.getElementById('reload-team'),list=document.getElementById('team-list');
 const empty=document.getElementById('team-empty');
 empty.hidden=true;feedback.hidden=false;retry.hidden=true;feedback.textContent='Загрузка карточек…';list.replaceChildren();document.getElementById('team-count').textContent='';
 try {
  const response=await fetch('data/participants.json',{cache:'no-store'});
  if(!response.ok)throw Error('Load failed');
  const profiles=await response.json();
  if(!Array.isArray(profiles)||profiles.some(profile=>Object.keys(Profiles.validate(profile)).length))throw Error('Invalid cards');
  const ordered=[...profiles].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  list.replaceChildren(...ordered.map(card));
  document.getElementById('team-count').textContent=`Карточек: ${ordered.length}`;
  feedback.textContent=ordered.length?'Карточки из репозитория команды.':'Здесь пока нет участников. Добавьте первую карточку по гайду ниже.';
  empty.hidden=ordered.length>0;
  feedback.hidden=ordered.length===0;
 } catch {feedback.textContent='Не удалось загрузить карточки. Проверьте соединение и повторите попытку.';retry.hidden=false;}
}
document.getElementById('reload-team').addEventListener('click',loadTeam);
try {
 const raw=localStorage.getItem(storageKey);
 if(raw){const draft=JSON.parse(raw);if(!draft||typeof draft!=='object')throw Error('Invalid draft');keys.forEach(key=>{if(typeof draft[key]==='string')field(key).value=draft[key];});message.textContent='Восстановлен ваш черновик. Проверьте описание проекта перед скачиванием.';}
} catch {message.textContent='Черновик недоступен. Можно заполнить новую карточку.';}
render();loadTeam();
