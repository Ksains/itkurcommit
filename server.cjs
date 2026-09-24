const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {collect} = require('./scripts/participants.cjs');
const routes = new Map(['index.html','assets/style.css','assets/app.js','assets/profiles.js','assets/avatar.svg','assets/ui.js','assets/golos-text.ttf','assets/font-license.txt'].map(file=>['/'+file,file]));
routes.set('/', 'index.html');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain;charset=utf-8'};
function createServer(root=__dirname) {
 return http.createServer(async(req,res)=>{
  const route=new URL(req.url,'http://127.0.0.1').pathname;
  if (req.method!=='GET' && req.method!=='HEAD') {res.writeHead(405);res.end();return;}
  try {
   if(route==='/data/participants.json') {
    const profiles=await collect(root);res.writeHead(200,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(profiles));return;
   }
   const file=routes.get(route);
   if(!file){res.writeHead(404);res.end('Not found');return;}
   const content=await fs.readFile(path.join(root,file));res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(content);
  } catch(error) {res.writeHead(500,{'Content-Type':'text/plain;charset=utf-8'});res.end('Не удалось загрузить данные. Проверьте терминал сервера.');console.error(error.message);}
 });
}
module.exports={createServer};
if(require.main===module){const server=createServer();server.on('error',error=>{console.error(error.message);process.exitCode=1;});server.listen(8000,'127.0.0.1',()=>console.log('Откройте http://127.0.0.1:8000. Ctrl+C для остановки.'));}


