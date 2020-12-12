/*
 * 访问渲染处理
 */

const fs = require('fs');
const fileInfo = require('./info');
const fileContent = require('./content');
const setting = require('./setting');
const dir = require('./dir');

module.exports = class Render {
  constructor(req, res) {
    this.req = req;
    this.res = res;
  }

  init() {
    try {
      const that = this;
      const fileInfoObj = fileInfo(that.req, that.res, setting.workspace);
      const exist = fs.existsSync(fileInfoObj.filePath);
      // 如果文件不存在
      if (!exist) {
        console.log("render  文件不存在!");
        that.res.writeHead(404, {
          'Content-Type': 'text/plain'
        });
        that.res.write('Not Found');
        that.res.end();
        return;
      } else {
        // 判断访问地址是文件夹还是文件
        const stat = fs.statSync(fileInfoObj.filePath);

        if (stat.isDirectory()) {
          // 如果为文件夹，则渲染文件夹目录
          console.log("render  显示目录");
          dir(that.req, that.res);
        } else {
          // 如果为文件，则渲染文件内容
          console.log("render  显示或下载文件");
          fileContent(
            that.req,
            that.res,
            fileInfoObj.filePath,
            fileInfoObj.extName,
            fileInfoObj.basePath,
            fileInfoObj.fileName
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
};
