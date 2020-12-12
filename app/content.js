/*
 * 访问文件内容
 */

const fs = require('fs');
const config = require('./config');

function getFileContent (req, res, filePath, extName) {

  const stat = fs.statSync(filePath);
  const lastModified = stat.mtime.toUTCString();
  const ifModifiedSince = 'If-Modified-Since'.toLowerCase();
  res.setHeader('Last-Modified', lastModified);

  if (extName.match(config.Expires.fileMatch)) {
    const expires = new Date();
    expires.setTime(expires.getTime() + config.Expires.maxAge * 1000);
    res.setHeader('Expires', expires.toUTCString());
    res.setHeader('Cache-Control', 'max-age=' + config.Expires.maxAge);
  }

  if (req.headers[ifModifiedSince] && lastModified === req.headers[ifModifiedSince]) {
    res.writeHead(304, 'Not Modified');
    res.end();
  } else {
    const content = fs.readFileSync(filePath, 'binary');
    if (content) {
      console.log("content  下载文件");
      res.writeHead(200, {"Content-Length": content.length, 'Content-Type': "application/octet-stream"});
      res.write(content, 'binary');
      res.end();
    } else {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      console.log("content  显示文件");
      res.end();
    }
  }
}

module.exports = getFileContent;
