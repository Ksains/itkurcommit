(function(root) {
  const loginPattern = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
  const limits = {name:[2,100],direction:[2,120],fact:[15,1000]};
  const optionalLimits = {projectTitle:[3,150],projectDescription:[30,2000]};
  const labels = {name:'Имя',github:'Логин GitHub',birthDate:'Дата рождения',direction:'Направление',skills:'Навыки',fact:'О себе',projectTitle:'Название проекта',projectDescription:'Описание проекта'};
  const placeholders = new Set(['Ваше имя','@username','Выберите направление','Навык 1','Навык 2','Напишите короткий факт о себе','Название проекта','Опишите проект, который хотите реализовать.']);
  function validate(profile) {
    const errors = {};
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {profile:'Карточка должна быть объектом JSON.'};
    for (const [key,[min,max]] of Object.entries(limits)) {
      const value = profile[key];
      if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) errors[key] = `${labels[key]}: от ${min} до ${max} символов.`;
      else if (placeholders.has(value.trim())) errors[key] = 'Замените заглушку своими данными.';
    }
    for (const [key,[min,max]] of Object.entries(optionalLimits)) {
      const value = profile[key];
      if (value === undefined || value === '') continue;
      if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) errors[key] = `${labels[key]}: от ${min} до ${max} символов, если поле заполнено.`;
      else if (placeholders.has(value.trim())) errors[key] = 'Замените заглушку своими данными.';
    }
    if (typeof profile.github !== 'string' || !profile.github.startsWith('@') || !loginPattern.test(profile.github.slice(1)) || profile.github.includes('--') || placeholders.has(profile.github)) errors.github = 'Укажите настоящий логин GitHub с @, без ссылки на профиль.';
    const match = typeof profile.birthDate === 'string' && /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(profile.birthDate);
    if (!match) errors.birthDate = 'Укажите дату рождения в формате ДД.ММ.ГГГГ, например 05.09.2007.';
    else {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      const date = new Date(year, month - 1, day);
      const today = new Date();
      if (year < 1900 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > today) errors.birthDate = 'Укажите существующую дату рождения не позже сегодняшнего дня.';
    }
    if (!Array.isArray(profile.skills) || profile.skills.length < 2 || profile.skills.length > 20 || profile.skills.some(item => typeof item !== 'string' || !item.trim() || item.length > 60 || placeholders.has(item.trim())) || new Set(profile.skills.map(item => String(item).trim().toLowerCase())).size < 2) errors.skills = 'Укажите от 2 до 20 навыков, без заглушек, не длиннее 60 символов каждый.';
    return errors;
  }
  function fromForm(data) {
    return {...data,github:`@${data.github.trim().replace(/^@/,'')}`, skills:[...new Set(data.skills.split(',').map(item=>item.trim()).filter(Boolean))]};
  }
  function filename(profile) { return `${profile.github.replace(/^@/,'').toLowerCase()}.json`; }
  const api = {validate,fromForm,filename,labels};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Profiles = api;
})(globalThis);
