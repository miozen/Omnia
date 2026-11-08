const http = require('node:http');
http.createServer((req, res) => {
	if (req.url === '/two') { res.writeHead(500); res.end('fixture failure'); return; }
	res.setHeader('content-type', 'application/json');
	res.end(JSON.stringify([{ type: 'socks', tag: req.url === '/three' ? 'second' : 'new', server: '127.0.0.1', server_port: 1080 }]));
}).listen(18080, '127.0.0.1');
