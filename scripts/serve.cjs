// Production server: serves only the immutable build, with no npm dependencies.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const files = ['index.html','assets/style.css','assets/app.js','assets/profiles.js','assets/ui.js','assets/avatar.svg','assets/golos-text.ttf','assets/font-license.txt','data/participants.json'];
const routes = new Map(files.map(file => ['/' + file, file]));
routes.set('/', 'index.html');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
function createStaticServer(root) {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET','HEAD'].includes(req.method)) {
      res.writeHead(405, {Allow:'GET, HEAD'}); res.end(); return;
    }
    let route;
    try { route = new URL(req.url, 'http://localhost').pathname; }
    catch { res.writeHead(400); res.end(); return; }
    const file = routes.get(route);
    if (!file) { res.writeHead(404); res.end(); return; }
    try {
      const content = await fs.readFile(path.join(root, file));
      res.writeHead(200, {'Content-Type':types[path.extname(file)],'Content-Length':content.length,'Cache-Control':'no-cache'});
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      console.error(`Cannot serve ${file}: ${error.code}`);
      res.writeHead(500); res.end();
    }
  });
}
module.exports = {createStaticServer};
if (require.main === module) {
  const server = createStaticServer(path.join(process.cwd(), 'dist'));
  server.on('error', error => {console.error(error.message); process.exitCode = 1;});
  server.listen(8000, '0.0.0.0', () => console.log('Static site listening on port 8000'));
  for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
