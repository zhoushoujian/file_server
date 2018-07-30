require("colors");
const fs = require("fs");
const url = require('url');
const path = require("path");
const formidable = require('formidable');
const http = require('http');
const util = require('util');
const cluster = require("cluster");
const os = require("os");
const child_process = require('child_process');
const setting = require('./app/setting');
const Render = require('./app/render');

//以非主线程的方式运行
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
                    console.log('worker was killed by signl', signal);
                } else if (code !== 0) {
                    console.log("worker exited with error", code)
                } else {
                    console.log("worker success!")
                }
            });

        }
        work()
    }();
}

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
let i = 1;
//创建服务器
let server = http.createServer(function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        console.log('server  收到客户端的请求数量', req.url, req.method, i++);
        if (req.url === "/" && req.method === "GET") {
            //显示主页
            res.setHeader('Content-Type', 'text/html;charset=UTF-8')
            let content = fs.readFileSync("./index.html");
            res.write(content);
            res.end();
        } else if (req.url === "/Images" && req.method === "POST") {
            //上传文件
            let ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';
            if(ip.split(',').length>0){
                ip = ip.split(',')[0]
            }
            console.log('访问者ip',ip);
            var form = new formidable.IncomingForm();
            form.maxFileSize = 1024*1024*1024;
            form.parse(req, function (err, fields, files) {
                // console.log("fields", fields);
                // console.log("files", files);
                let filename = files.files.name;
                let filesize = files.files.size;
                if(!/\.exe$|\.apk$/gim.test(filename)){
                   return res.end("非法类型的文件");
                } else if(/%|#/g.test(filename)){
                   return res.end("非法的文件名");
                } else if (filesize > 1024*1024*1024) {
                    return res.end("文件大小超过1GB");
                }
                res.writeHead(200, {
                    'content-type': 'text/plain'
                });
                res.write('received upload:\n\n');
                console.log("files", files.files.path);
                let readStream = fs.createReadStream(files.files.path);
                let writeStream = fs.createWriteStream("Images/" + files.files.name);
                readStream.pipe(writeStream);
                readStream.on('end', function () {
                    fs.unlinkSync(files.files.path);
                });
                res.end(util.inspect({
                    fields: fields,
                    files: files
                }));
            });
            return;
        } else if (req.url === "/list" && req.method === "GET") {
            //响应ajax
            let content = fs.readdirSync(path.join(__dirname, "Images"));
            console.log("server  反馈给ajax的请求", content.length);
            res.write(content.toString());
            res.end();
        } else if(/delete/.test(req.url)){
            res.setHeader('Content-Type', 'text/plain;charset=UTF-8');
            let pathname = url.parse(req.url).pathname; 
            filename = decodeURIComponent(pathname).split("/")[decodeURIComponent(pathname).split("/").length-1];
            //let delpathfile = path.join(__dirname,`Images/${filename}`)
            console.log("server delete filename",filename);
            //console.log("delpathfile",delpathfile);
            fs.unlink(`./Images/${filename}`,function(err){
                if (err) throw err;
                console.log(`${filename}删除成功!`);
                res.end();
            });
        } else {
            //静态文件部署
            console.log("server  处理静态文件");
            const _render = new Render(req, res);
            _render.init();
        }
});

server.listen({
    port: setting.port,
    exclusive: true
});
server.on('listening', function () {
    console.log(`服务启动成功,正在监听${setting.port}端口`.green);
    process.title = `服务启动成功--${address}-${setting.port}`;
});
server.on('error', function () {
    console.log(`${setting.port}端口使用中`.bold.red);
});