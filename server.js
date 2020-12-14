//以非主线程的方式运行
const fs = require("fs"),
  url = require('url'),
  path = require("path"),
  formidable = require('formidable'),
  http = require('http'),
  util = require('util'),
  os = require("os"),
  logger = require('./logger'),
  setting = require('./app/setting'),
  Render = require('./app/render');

//获取ip地址
let address;
const networks = os.networkInterfaces();
Object.keys(networks).forEach(function (k) {
  for (const kk in networks[k]) {
    if (networks[k][kk].family === "IPv4" && networks[k][kk].address !== "127.0.0.1") {
      address = networks[k][kk].address;
      return address;
    }
  }
});

if (!fs.existsSync(path.join(__dirname, "Images"))) {
  fs.mkdirSync(path.join(__dirname, "Images"))
}

let i = 0;
//创建服务器
const server = http.createServer(function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  function getIp(req, info) {
    let ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';
    if (ip.split(',').length > 0) {
      ip = ip.split(',')[0];
    }
    logger.info(info, ip);
    return ip;
  }

  logger.debug(` server  收到客户端的请求数量`, req.url, req.method, ++i);
  if (req.url === "/" && req.method === "GET") {
    //显示主页
    res.setHeader('Content-Type', 'text/html;charset=UTF-8');
    const content = fs.readFileSync("./index.html");
    res.write(content);
    res.end();
  } else if (req.url === "/Images" && req.method === "POST") {
    getIp(req, ` 上传文件的访问者ip: `);
    //上传文件
    const files = [];
    const form = new formidable.IncomingForm();
    form.multiples = true; //启用多文件上传
    form.maxFileSize = 1 * 1024 * 1024 * 1024; //限制上传最大文件为1GB
    form.on('file', function (filed, file) {
      files.push([filed, file]);
    }).parse(req, function (err, fields, files) {
      //logger.debug("fields", fields);
      //logger.debug("files", files);
      if (err) {
        logger.error(` Images parse err`, err.message);
        return res.end(500);
      }
      const filesArray = files.files;
      const filesnum = files.files.length;
      if (Object.prototype.toString.call(files.files) === '[object Object]') {
        const filesname = files.files.name;
        const filesize = files.files.size;
        logger.info(` 上传的是单文件`, filesname);
        /*  if (!/\.exe$|\.apk$/gim.test(filesname)) {
            return res.end("非法类型的文件");
         } else  */
        if (/%|#/g.test(filesname)) {
          return res.end("非法的文件名");
        } else if (filesize > 1 * 1024 * 1024 * 1024) {
          return res.end('文件大小超过1GB');
        }
        res.writeHead(200, {
          'content-type': 'application/octet-stream'
        });
        res.write('received upload:\n\n');
        //logger.debug("files", files.files.path);
        const readStream = fs.createReadStream(files.files.path);
        const writeStream = fs.createWriteStream("Images/" + filesname);
        readStream.pipe(writeStream);
        readStream.on('end', function () {
          res.end(util.inspect({
            fields,
            files
          }));
          fs.unlinkSync(files.files.path);
        });
      } else {
        logger.debug(`  上传的是多文件`);
        for (let i = 0; i < filesnum; i++) {
          logger.debug(`  上传的文件名`, filesArray[i].name);
          /* if (!/\.exe$|\.apk$/gim.test(filesArray[i].name)) {
              return res.end("非法类型的文件");
          } else  */
          if (/%|#/g.test(filesArray[i].name)) {
            return res.end("非法的文件名");
          } else if (filesArray[i].size > 1 * 1024 * 1024 * 1024) {
            return res.end('文件大小超过1GB');
          }
          res.write('received upload:\n\n');
          //logger.debug("files", files.files[i].path);
          const readStream = fs.createReadStream(files.files[i].path);
          const writeStream = fs.createWriteStream("Images/" + filesArray[i].name);
          readStream.pipe(writeStream);
          readStream.on('end', function () {
            res.end(util.inspect({
              fields,
              files
            }));
            fs.unlinkSync(files.files[i].path);
          });
        }
      }
    });
  } else if (req.url === "/list" && req.method === "GET") {
    getIp(req, ` 获取文件列表的访问者ip: `);
    const content = fs.readdirSync(path.join(__dirname, "Images"));
    logger.debug(` server  反馈给ajax的请求`, content.length);
    res.write(content.toString());
    res.end();
  } else if (/delete/.test(req.url)) {
    getIp(req, ` 删除文件的访问者ip: `);
    res.setHeader('Content-Type', 'text/plain;charset=UTF-8');
    const pathname = url.parse(req.url).pathname;
    const filename = decodeURIComponent(pathname).split("/")[decodeURIComponent(pathname).split("/").length - 1];
    logger.debug(` server delete filename`, filename);
    if (fs.existsSync(`./Images/${filename}`)) {
      fs.unlink(`./Images/${filename}`, function (err) {
        if (err) {
          logger.error(` delete unlink err`, err.message);
          return res.end(500);
        }
        logger.info(`  ${filename}删除成功!`);
        res.end();
      });
    } else {
      res.end('文件已删除');
    }
  } else if (req.url === "/server.js" || req.url === "/Images/" || req.url === "/Images") {
    res.end("403 forbidden");
  } else {
    //静态文件部署
    logger.debug(` server  处理静态文件`);
    const _render = new Render(req, res);
    return _render.init();
  }
});

server.listen({
  port: setting.port
});

server.on('listening', function () {
  logger.info(`  服务启动成功,正在监听${setting.port}端口`);
  process.title = `服务启动成功--${address}-${setting.port}`;
});

process.on('unhandledRejection', (error) => {
  logger.error('unhandledRejection', error.stack || error.toString());
});

process.on('uncaughtException', function (error) {
  logger.error('uncaughtException', error.stack || error.toString());
});
