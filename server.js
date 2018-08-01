//以非主线程的方式运行
let cluster = require("cluster");
let IS_RUNNING_AS_SERVER = process.mainModule.IS_RUNNING_AS_SERVER = require.main === module;
if (IS_RUNNING_AS_SERVER && cluster.isMaster) {
    return function () {
        var worker;
        var work = function () {
            if (work.ing) return;
            work.ing = true;
            worker = cluster.fork();
            worker.on('exit', (code, signal) => {
                if (signal) {
                    logger.debug('worker was killed by signl', signal);
                } else if (code !== 0) {
                    logger.debug("worker exited with error", code)
                } else {
                    logger.debug("worker success!")
                }
            });

        }
        work();
    }();
}

require("colors");
let fs = require("fs"),
    url = require('url'),
    path = require("path"),
    formidable = require('formidable'),
    http = require('http'),
    util = require('util'),
    os = require("os"),
    setting = require('./app/setting'),
    Render = require('./app/render'),
    logger = require('./logger');

//获取ip地址
var address
var networks = os.networkInterfaces()
Object.keys(networks).forEach(function (k) {
    for (var kk in networks[k]) {
        if (networks[k][kk].family === "IPv4" && networks[k][kk].address !== "127.0.0.1") {
            address = networks[k][kk].address;
            return address;
        }
    }
})

let i = 0;
//创建服务器
let server = http.createServer(function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    logger.debug(` server  收到客户端的请求数量`, req.url, req.method, ++i);
    if (req.url === "/" && req.method === "GET") {
        //显示主页
        res.setHeader('Content-Type', 'text/html;charset=UTF-8');
        var content = fs.readFileSync("./index.html");
        res.write(content);
        res.end();
    } else if (req.url === "/Images" && req.method === "POST") {
        //上传文件
        var files = [];
        var form = new formidable.IncomingForm();
        form.multiples = true; //q启用多文件上传
        form.maxFileSize = 1 * 1024 * 1024 * 1024; //限制上传最大文件为4GB
        form.on('file', function (filed, file) {
            files.push([filed, file]);
        }).parse(req, function (err, fields, files) {
            // logger.debug("fields", fields);
            //logger.debug("files", files);
            if (err) {
                logger.debug(`  err` + err.message);
                return;
            }
            let filesArray = files.files;
            let filesnum = files.files.length;
            if (Object.prototype.toString.call(files.files) === '[object Object]') {
                let filesname = files.files.name;
                let filesize = files.files.size;
                logger.info(` 上传的是单文件`, filesname);
                if (!/\.exe$|\.apk$/gim.test(filesname)) {
                    return res.end("非法类型的文件");
                } else if (/%|#/g.test(filesname)) {
                    return res.end("非法的文件名");
                } else if (filesize > 1 * 1024 * 1024 * 1024) {
                    return res.end('文件大小超过1GB');
                }
                res.writeHead(200, {
                    'content-type': 'application/octet-stream'
                });
                res.write('received upload:\n\n');
                //logger.debug("files", files.files.path);
                let readStream = fs.createReadStream(files.files.path);
                let writeStream = fs.createWriteStream("Images/" + filesname);
                readStream.pipe(writeStream);
                readStream.on('end', function () {
                    fs.unlinkSync(files.files.path);
                });
            } else {
                logger.debug(`  上传的是多文件`);
                for (let i = 0; i < filesnum; i++) {
                    logger.debug(`  上传的文件名`, filesArray[i].name);
                    if (!/\.exe$|\.apk$/gim.test(filesArray[i].name)) {
                        return res.end("非法类型的文件");
                    } else if (/%|#/g.test(filesArray[i].name)) {
                        return res.end("非法的文件名");
                    } else if (filesArray[i].size > 1 * 1024 * 1024 * 1024) {
                        return res.end('文件大小超过1GB');
                    }
                    res.write('received upload:\n\n');
                    //logger.debug("files", files.files[i].path);
                    let readStream = fs.createReadStream(files.files[i].path);
                    let writeStream = fs.createWriteStream("Images/" + filesArray[i].name);
                    readStream.pipe(writeStream);
                    readStream.on('end', function () {
                        fs.unlinkSync(files.files[i].path);
                    });
                }
            }
            res.end(util.inspect({
                fields: fields,
                files: files
            }));
        });
    } else if (req.url === "/list" && req.method === "GET") {
        //响应ajax
        let ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';
        if (ip.split(',').length > 0) {
            ip = ip.split(',')[0]
        }
        logger.info(` 访问者ip`, ip);
        let content = fs.readdirSync(path.join(__dirname, "Images"));
        logger.debug(` server  反馈给ajax的请求`, content.length);
        res.write(content.toString());
        res.end();
    } else if (/delete/.test(req.url)) {
        res.setHeader('Content-Type', 'text/plain;charset=UTF-8');
        let pathname = url.parse(req.url).pathname;
        filename = decodeURIComponent(pathname).split("/")[decodeURIComponent(pathname).split("/").length - 1];
        logger.debug(` server delete filename`, filename);
        if (fs.existsSync(`./Images/${filename}`)) {
            fs.unlink(`./Images/${filename}`, function (err) {
                if (err) {
                    throw err
                }
                logger.info(`  ${filename}删除成功!`);
                res.end();
            });
        } else {
            res.end('文件已删除');
        }
    } else {
        //静态文件部署
        logger.debug(` server  处理静态文件`);
        const _render = new Render(req, res);
        _render.init();
    }
});

server.listen({
    port: setting.port,
    exclusive: true
});
server.on('listening', function () {
    logger.info(`  服务启动成功,正在监听${setting.port}端口`);
    process.title = `服务启动成功--${address}-${setting.port}`;
});
server.on('error', function () {
    logger.warn(`  ${setting.port}端口使用中`.bold.red);
});