 /*
 * @Author: zhoushoujian 
 * @Date: 2018-04-16 20:13:31 
 * @Last Modified by: zhoushoujian
 * @Last Modified time: 2018-08-03 22:24:55
 * @用法:在任何一个脚本里都可以直接引用，
 *       生成的log文件存放在C:\Program Files (x86)\CloudLink\log文件夹下
 *       当文件大小超过1M，文件自动分片，用法如下:
 *       logger.debug("debug","arg1","arg2",["arg3","arg4"])   //[2018-4-18 09:50:07.358][DEBUG][ACTION] debug  [ext] "arg1","arg2",["arg3","arg4"]
 *       logger.info("info",[1,2,3])                           //[2018-4-18 09:50:07.358][INFO][ACTION] info  [ext] [1,2,3]
 *       logger.warn("warn",null,[4,5,6])                      //[2018-4-18 09:50:07.358][WARN][ACTION] warn  [ext] null,[4,5,6]
 *       logger.error("error","123","456")                     //[2018-4-18 09:50:07.358][ERROR][ACTION] error  [ext] "123","456"
 */
let fs = require('fs');
require('colors');
let time;
function getTime (){
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;
    let day = new Date().getDate();
    let hour = new Date().getHours();
    let minute = new Date().getMinutes();
    let second = new Date().getSeconds();
    let mileSecond = new Date().getMilliseconds();
    if (hour < 10) {
        hour = "0" + hour
    }
    if (minute < 10) {
        minute = "0" + minute
    }
    if (second < 10) {
        second = "0" + second
    }
    if (mileSecond < 10) {
        second = "00" + mileSecond
    }
    if (mileSecond < 100) {
        second = "0" + mileSecond
    }
    time = `${year}-${month}-${day} ${hour}:${minute}:${second}.${mileSecond}` ;//获取时间信息
    return time;
}

let list = []; //待写入字符缓冲区
let sleep = true; //日志系统休眠开关
let LOG_FILE_MAX_SIZE = 1024 * 1024 * 5 //日志文件分片大小
let LOG_LEVEL_TYPES = ["debug", "info", "warn", "error"]; //log的等级类型

function doLogInFile(buffer) {
    buffer && list.push(buffer);
    sleep && activate();
}
//激活日志系统
function activate() {
    sleep = false;
    let buffer = list.shift();
    excute(buffer).then(
        function () {
            if (list.length > 0) {
                activate();
            } else {
                sleep = true;
            }
        },
        function () {
            sleep = true;
        }
    );
}
// 执行，需要返回Promise
function excute(buffer) {
    return new Promise((resolve, reject) => {
        checkFileState()
            .then(() => writeFile(buffer))
            .then(resolve);
    });
}
//检查文件状态
function checkFileState() {
    return new Promise((resolve, reject) => {
        fs.stat("/server.log", function (err, stats) {
            if (err) {
                if (!fs.existsSync("./server.log")) {
                    //创建CloudLink_test.log文件
                    fs.appendFile("./server.log");
                }
                resolve();
            } else {
                console.log(stats.size)
                checkFileSize(stats.size)
                    .then(resolve)
                    .catch(resolve);
            }
        });
    });
}
//检查日志文件大小
function checkFileSize(size) {
    return new Promise((resolve, reject) => {
        if (size > LOG_FILE_MAX_SIZE) {
            fs.readdir("/", (err, files) => {
                if (err) throw err
                let fileList = files.filter(function (file) {
                    return /^server[0-9]*\.log$/i.test(file);
                });

                for (let i = fileList.length; i > 0; i--) {
                    if (i >= 10) {
                        fs.unlinkSync("/" + fileList[i - 1]); //如果日志文件超过10个，则从CloudLink_test1开始删除
                        continue;
                    }
                    fs.renameSync("/" + fileList[i - 1], "server" + i + ".log"); //遍历更改日志文件名
                }
            });
            resolve();
        } else {
            resolve();
        }
    });
}
//写入日志文件
function writeFile(buffer) {
    return new Promise(function (res, rej) {
        fs.writeFileSync("server.log", buffer, {
            flag: "a+" //	以读取追加模式打开文件，如果文件不存在则创建。
        });
        res();
    })
}

/**
 * 初始化日志方法
 * @param {*} InitLogger
 */
function InitLogger() {
    // console.log("初始化日志系统   ok".green)
}
Object.prototype.loggerInFile = function (cx, data = '', ...args) { //修改对象的顶层原型方法
    let extend = ""
    //console.log(args.length)
    if (args.length) {
        extend = args.map(s => JSON.stringify(s, function (p, o) { //遍历扩展运算符
            for (var k in o) {
                var v = o[k];
                o[k] = v instanceof Array ? String(v) : v
            }
            return o;
        }, 4));
        if (extend) {
            extend = `  [ext] ${extend}`;
        }
    }
    let strLog = `[${getTime()}]  ` + ` ${data}` + `${extend}`;
    let content = strLog + "\r\n";
    switch (cx) { //根据不同的日志等在控制台打印不同的颜色的日志信息
        case 0:
            console.log(strLog)
            break;
        case 1:
            console.info(strLog.green)
            break;
        case 2:
            console.warn(strLog.yellow)
            break;
        case 3:
            console.error(strLog.red.bold)
            break;
    }
    doLogInFile(content);
}
InitLogger.prototype.debug = function (data, ...args) { //debug等级的日志
    loggerInFile(0, data, ...args);
}
InitLogger.prototype.info = function (data, ...args) { //info等级的日志
    loggerInFile(1, data, ...args);
}
InitLogger.prototype.warn = function (data, ...args) { //warn等级的日志
    loggerInFile(2, data, ...args);
}
InitLogger.prototype.error = function (data, ...args) { //error等级的日志
    loggerInFile(3, data, ...args);
}

module.exports = logger = new InitLogger(); //实例化日志函数\
