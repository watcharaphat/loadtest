const fs = require('fs');
const mkdirp = require('mkdirp');

function writeFile(filepath, data) {
  // Crate all needed directories in filepath
  console.log(data);
  const splitFilepath = filepath.split('/');
  splitFilepath.pop();
  const dirToCreate = splitFilepath.join('/');
  mkdirp.sync(dirToCreate);

  try {
    fs.writeFileSync(filepath, data);
  } catch (error) {
    console.error('Error writing file', error);
  }
}

exports.writeFile = writeFile;
