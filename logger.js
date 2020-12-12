//made by zhoushoujian on 2018/12/13
const fs = require('fs'),
  LOGGER_LEVEL = ["debug", "info", "warn", "error"],
  list = [],
  LOG_FILE_MAX_SIZE = 1024 * 1024 * 5;

let time, flag = true;

//自定义控制台颜色输出
{
  const colors = {
    Reset: "\x1b[0m",
    FgRed: "\x1b[31m",
    FgGreen: "\x1b[32m",
    FgYellow: "\x1b[33m",
    FgBlue: "\x1b[34m"
  };
  "debug:debug:FgBlue,info::FgGreen,warn:警告:FgYellow,error:error:FgRed".split(",").forEach(function (logcolor) {
    const [log, info, color] = logcolor.split(':');
    const logger = function (...args) {
      const m = args.slice(1, args.length - 1).map(function (s) {
        return JSON.stringify(s, function (k, v) {
          if (typeof v === 'function') {
            return Function.prototype.toString.call(v);
          } else {
            for (const i in v) {
              if (Object.prototype.hasOwnProperty.call(v, i)) {
                const p = v[i];
                v[i] = p instanceof Function ? String(p) : p;
              }
            }
            return v;
          }
        }, 4);
      });
      process.stdout.write(args[0] + m + args[args.length - 1] + '\n\n');
    } || console[log] || console.log;
    // eslint-disable-next-line no-useless-call
    console[log] = (...args) => logger.apply(null, [`${colors[color]}[${getTime()}] [${info.toUpperCase() || log.toUpperCase()}]${colors.Reset} `, ...args, colors.Reset]);
  });
}

function getTime() {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const day = new Date().getDate();
  let hour = new Date().getHours();
  let minute = new Date().getMinutes();
  let second = new Date().getSeconds();
  const mileSecond = new Date().getMilliseconds();
  if (hour < 10) {
    hour = "0" + hour;
  }
  if (minute < 10) {
    minute = "0" + minute;
  }
  if (second < 10) {
    second = "0" + second;
  }
  if (mileSecond < 10) {
    second = "00" + mileSecond;
  }
  if (mileSecond < 100) {
    second = "0" + mileSecond;
  }
  time = `${year}-${month}-${day} ${hour}:${minute}:${second}.${mileSecond}`;
  return time;
}

function doLogInFile(buffer) {
  buffer && list.push(buffer);
  flag && activate();
}

function activate() {
  flag = false;
  const buffer = list.shift();
  execute(buffer).then(() => new Promise(res => {
    list.length ? activate() : flag = true;
    res();
  }).catch(err => {
    flag = true;
    console.error('An error hanppened after execute', err);
  }));
}

function execute(buffer) {
  return checkFileState()
    .then(() => writeFile(buffer))
    .catch(err => console.error('an error hanppend when excute', err));
}

function checkFileState() {
  return new Promise((resolve) => {
    fs.stat("./server.log", function (err, stats) {
      if (!fs.existsSync("./server.log")) {
        fs.appendFileSync("./server.log");
        resolve();
      } else {
        checkFileSize(stats.size)
          .then(resolve);
      }
    });
  });
}

function checkFileSize(size) {
  return new Promise((resolve) => {
    if (size > LOG_FILE_MAX_SIZE) {
      fs.readdir("/", (err, files) => {
        if (err) throw err;
        const fileList = files.filter(function (file) {
          return /^server[0-9]*\.log$/i.test(file);
        });

        for (let i = fileList.length; i > 0; i--) {
          if (i >= 10) {
            fs.unlinkSync("/" + fileList[i - 1]);
            continue;
          }
          fs.renameSync("/" + fileList[i - 1], "server" + i + ".log");
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

function writeFile(buffer) {
  return new Promise(function (res) {
    fs.writeFileSync("server.log", buffer, {
      flag: "a+" //以读取追加模式打开文件，如果文件不存在则创建。
    });
    res();
  });
}

/**
 * 初始化日志方法
 * @param {*} InitLogger
 */
function InitLogger() {
  //  console.info("初始化日志系统   ok");
}

function loggerInFile(level, data, ...args) {
  // eslint-disable-next-line prefer-rest-params
  console[level].apply(this, Array.prototype.slice.call(arguments).slice(1));
  let extend = "";
  if (args.length) {
    extend = args.map(s => JSON.stringify(s, function (p, o) {
      if (typeof o === 'function') {
        return Function.prototype.toString.call(o);
      } else {
        for (const k in o) {
          if (Object.prototype.hasOwnProperty.call(o, k)) {
            const v = o[k];
            o[k] = v instanceof Function ? String(v) : v;
          }
        }
        return o;
      }
    }, 4));
    if (extend) {
      extend = `  [ext] ${extend}`;
    }
  }
  data = Object.prototype.toString.call(data) === '[object Object]' ? JSON.stringify(data) : data;
  const content = `${data}` + `${extend}` + "\r\n";
  this.time = getTime;
  doLogInFile(`[${this.time()}]  [${level.toUpperCase()}]  ${content}`);
}

LOGGER_LEVEL.forEach(function (level) {
  InitLogger.prototype[level] = function (data, ...args) {
    loggerInFile(level, data, ...args);
  };
}, []);

module.exports = new InitLogger();
