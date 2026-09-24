const fs = require('node:fs/promises');
const path = require('node:path');
const {collect} = require('./participants.cjs');
async function build(root, destination = path.join(root,'dist')) {
  const participants = await collect(root);
  await fs.mkdir(path.join(destination,'assets'),{recursive:true});
  await fs.mkdir(path.join(destination,'data'),{recursive:true});
  for (const file of ['index.html','assets/app.js','assets/profiles.js','assets/style.css','assets/avatar.svg','assets/ui.js','assets/golos-text.ttf','assets/font-license.txt']) await fs.copyFile(path.join(root,file),path.join(destination,file));
  await fs.writeFile(path.join(destination,'data/participants.json'),JSON.stringify(participants,null,2)+'\n');
  return participants.length;
}
module.exports = {build};
if (require.main === module) build(path.resolve(__dirname,'..')).then(count=>console.log(`Сайт собран в dist. Карточек: ${count}.`)).catch(error=>{console.error(error.message);process.exitCode=1;});


