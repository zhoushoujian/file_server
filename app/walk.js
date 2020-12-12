/*
 * 遍历目录
 */

// import fs from 'fs';
// import config from './config';

const fs = require('fs');
const config = require('./config');

const mimes = config.mimes;

const walk = function (pathResolve) {
  const files = fs.readdirSync(pathResolve);

  const dirList = [];
  const fileList = [];
  for (let i = 0, len = files.length; i < len; i++) {
    const item = files[i];
    const itemArr = item.split('.');

    const itemMime = (itemArr.length > 1) ? itemArr[itemArr.length - 1] : 'undefined';

    if (typeof mimes[itemMime] === 'undefined') {
      dirList.push(files[i]);
    } else {
      fileList.push(files[i]);
    }
  }

  const result = dirList.concat(fileList);

  return result;
};

module.exports = walk;
