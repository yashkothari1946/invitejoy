const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const port = process.env.PORT || 7000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
};

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) {
    return null;
  }
  return targetPath;
}

function checkAuth(req, res) {
  const auth = req.headers['authorization'];
  if (!auth) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin"' });
    res.end('Authentication required.');
    return false;
  }
  
  const b64auth = (auth || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
  
  if (login === 'admin' && password === 'vybtek2026') {
    return true;
  } else {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin"' });
    res.end('Authentication required.');
    return false;
  }
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  
  if (urlPath === "/api/logout") {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="Admin Logged Out"',
      "Content-Type": "application/json"
    });
    res.end(JSON.stringify({ status: "logged_out", message: "Logged out" }));
    return;
  }

  if (urlPath === "/admin.html") {
    if (!checkAuth(req, res)) return;
  }
  
  if (urlPath === "/api/data") {
    const dataFile = path.join(root, "data.json");
    if (req.method === "GET") {
      fs.readFile(dataFile, "utf8", (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end("Error reading data");
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(data);
      });
    } else if (req.method === "POST") {
      if (!checkAuth(req, res)) return;
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", () => {
        fs.writeFile(dataFile, body, "utf8", err => {
          if (err) {
            res.writeHead(500);
            res.end("Error writing data");
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        });
      });
    }
    return;
  }

  if (urlPath === "/api/images") {
    const samplesDir = path.join(root, "samples");
    fs.readdir(samplesDir, (err, files) => {
      if (err) {
        res.writeHead(500);
        res.end("Error reading directory");
        return;
      }
      const images = files.filter(f => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(images));
    });
    return;
  }

  if (urlPath === "/api/create-order" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const { amount } = JSON.parse(body);
        const dataFile = path.join(root, "data.json");
        const dataObj = JSON.parse(fs.readFileSync(dataFile, "utf8"));
        const keyId = dataObj.payment ? dataObj.payment.razorpay_key_id : "";
        const keySecret = dataObj.payment ? dataObj.payment.razorpay_key_secret : "";

        if (!keyId || !keySecret) {
          // Simulated order response if keys aren't configured yet
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            id: "order_simulated_" + Math.random().toString(36).substr(2, 9),
            amount: Math.round(amount * 100),
            currency: "INR",
            simulated: true,
            key_id: "rzp_test_simulated"
          }));
          return;
        }

        const postData = JSON.stringify({
          amount: Math.round(amount * 100), // convert to paise
          currency: "INR",
          receipt: "receipt_" + Date.now()
        });

        const authHeader = "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64");

        const options = {
          hostname: "api.razorpay.com",
          port: 443,
          path: "/v1/orders",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
            "Content-Length": Buffer.byteLength(postData)
          }
        };

        const rzpReq = https.request(options, (rzpRes) => {
          let responseBody = "";
          rzpRes.on("data", chunk => responseBody += chunk);
          rzpRes.on("end", () => {
            res.writeHead(rzpRes.statusCode, { "Content-Type": "application/json" });
            const parsedResp = JSON.parse(responseBody);
            parsedResp.key_id = keyId;
            res.end(JSON.stringify(parsedResp));
          });
        });

        rzpReq.on("error", (e) => {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        });

        rzpReq.write(postData);
        rzpReq.end();

      } catch(err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request payload" }));
      }
    });
    return;
  }

  if (urlPath === "/api/orders") {
    const ordersFile = path.join(root, "orders.json");
    if (req.method === "GET") {
      if (!checkAuth(req, res)) return;
      fs.readFile(ordersFile, "utf8", (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end("Error reading orders");
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(data || "[]");
      });
    } else if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", () => {
        try {
          const newOrder = JSON.parse(body);
          let currentOrders = [];
          if (fs.existsSync(ordersFile)) {
            const raw = fs.readFileSync(ordersFile, "utf8");
            currentOrders = JSON.parse(raw || "[]");
          }
          currentOrders.unshift(newOrder); // Put latest order at top
          fs.writeFileSync(ordersFile, JSON.stringify(currentOrders, null, 2), "utf8");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, order: newOrder }));
        } catch(err) {
          res.writeHead(400);
          res.end("Invalid order data");
        }
      });
    }
    return;
  }

  if (urlPath === "/api/orders/update-status" && req.method === "POST") {
    if (!checkAuth(req, res)) return;
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const { orderId, status } = JSON.parse(body);
        const ordersFile = path.join(root, "orders.json");
        let currentOrders = [];
        if (fs.existsSync(ordersFile)) {
          currentOrders = JSON.parse(fs.readFileSync(ordersFile, "utf8") || "[]");
        }
        const order = currentOrders.find(o => o.id === orderId);
        if (order) {
          order.status = status;
          fs.writeFileSync(ordersFile, JSON.stringify(currentOrders, null, 2), "utf8");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(404);
          res.end("Order not found");
        }
      } catch(err) {
        res.writeHead(400);
        res.end("Invalid payload");
      }
    });
    return;
  }

  if (urlPath === "/api/upload" && req.method === "POST") {
    if (!checkAuth(req, res)) return;
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const { filename, base64 } = JSON.parse(body);
        if (!filename || !base64) {
          res.writeHead(400);
          res.end("Filename and base64 required");
          return;
        }

        const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(cleanBase64, "base64");
        
        const safeName = Date.now() + "_" + filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const samplesDir = path.join(root, "samples");
        
        if (!fs.existsSync(samplesDir)) {
          fs.mkdirSync(samplesDir);
        }

        const targetFile = path.join(samplesDir, safeName);
        fs.writeFileSync(targetFile, buffer);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, path: "samples/" + safeName }));

      } catch(err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  const requestPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = safeJoin(root, requestPath);

  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes[ext] || "application/octet-stream";
    const fileSize = stats.size;
    const range = req.headers.range;

    // HTTP 206 Range Streaming for Videos (.mp4, .webm, .mov, .ogg)
    if (range && mime.startsWith("video/")) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
        return res.end();
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mime,
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": fileSize,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Wedding site running at http://localhost:${port}`);
});
