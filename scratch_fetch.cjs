const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
      headers: headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log("Checking server health...");
    const health = await get("http://localhost:3000/api/health");
    console.log("Health Status:", health.statusCode, health.body);

    const USERNAME = process.env.ADMIN_USER || 'sjaquer';
    const PASSWORD = process.env.ADMIN_PASS || process.env.PASSWORD;
    if (!PASSWORD) {
      console.error("ERROR: faltan credenciales en variables de entorno (ADMIN_PASS). No usar contraseñas en el código fuente.");
      return;
    }
    console.log("Attempting login (using env vars)...");
    const loginRes = await post("http://localhost:3000/api/auth/login", {
      username: USERNAME,
      password: PASSWORD
    });
    console.log("Login Res Status:", loginRes.statusCode);
    
    const setCookie = loginRes.headers['set-cookie'];
    if (!setCookie) {
      console.error("No cookie returned! Body:", loginRes.body);
      return;
    }
    const tokenCookie = setCookie[0].split(';')[0];
    console.log("Obtained Cookie:", tokenCookie);

    console.log("Fetching /api/dashboard...");
    const dashRes = await get("http://localhost:3000/api/dashboard", {
      'Cookie': tokenCookie
    });
    console.log("Dashboard Status:", dashRes.statusCode);
    console.log("Dashboard Body:", dashRes.body);

  } catch (err) {
    console.error("Error fetching from running server:", err);
  }
}

main();
