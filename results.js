var argv = require('yargs')
  .usage('Usage: $0 -a [string]')
  .argv;
const util = require('util');
const fs = require('fs');
const readFilePromise = util.promisify(fs.readFile);
let address;
const axios = require('axios');
const Papa = require('papaparse');
let numberOfNode = 0;

const { writeFile } = require('./util/writeFile.js');

async function main() {
  if (argv.a) {
    var string = argv.a;
    fs.readFile(string, 'utf8', function (err, file) {
      if (err) throw err;
      address = file.split(";");
      numberOfNode = address.length / 2;
    });
  } else if (argv.b) {
    const baseURL = `http://${argv.b}`;
    const api = '/abci-ip/list';
    const url = `${baseURL}${api}`;

    let response;
    try {
      response = await axios.get(url);
    } catch (err) {
      console.error('Error getting IP address list, exit(1)', err);
      process.exit(1);
    }

    const ips = response.data.ip;
    numberOfNode = ips.length;

    address = [];

    ips.forEach((ip) => {
      address.push(ip);
    });

    console.log("All IPs are fetched");
  }
  console.log(`IP address list: ${util.inspect(address)}`);

  await getAllFiles(address); // download all files from webservers of specified IP address
  calculation(address);
}

async function downloadFile(address, fileName) {
  // Get the data from url
  var data = "";
  var url = "http://" + address + ":8100/" + fileName;

  var response = await axios.get(url);
  var data = response.data;

  var name = "result/" + address.split('.').join("_") + ".csv";
  // await writeFile(data, name); // write the datas in a file
  writeFile(name, data);
}

async function getAllFiles(address) {
  var index = 0;
  console.log("Start downloading the remote result files");
  for (let i = 0; i < address.length; i++) {
    const ip = address[i];
    await downloadFile(ip, 'result.csv');
  }
}

async function calculation(address) {
  console.log("Start calculations");
  var index = 0;
  //Get logs from loadtest.js
  var loadTestData = await readFilePromise("result/transactionList.csv", 'utf8')
  var loadTestParsed = Papa.parse(loadTestData).data;

  const initTransactionData = [];
  loadTestParsed.forEach((item) => {
    if (item[0] && item[1] && item[2]) initTransactionData[item[0]] = [item[1], item[2]];
  });

  const propogationTime = [];
  let loss = 0;

  for (let i = 0; i < address.length; i++) {
    const fileName = address[i].split('.').join('_') + '.csv';
    const filePath = 'result/' + fileName;
    const fileData = await readFilePromise(filePath, 'utf8');
    const fileParsed = Papa.parse(fileData).data;

    const endTransactionData = [];
    fileParsed.forEach((item) => {
      if (item[0] && item[1]) endTransactionData[item[0]] = item[1];
    });

    const sum = {
      propagationTime128: 0,
      propagationTime512: 0,
      propagationTime1024: 0,
    };

    let iterration128 = 0;
    let iterration512 = 0;
    let iterration1024 = 0;

    const result = {
      loss: 0,
    }

    initTransactionData.forEach((request, seq) => {
      if (endTransactionData[seq]) {
        const startTime = request[0];
        const endTime = endTransactionData[seq];
        const time = endTime - startTime;
        propogationTime.push(time);

        switch (request[1]) {
          case '128':
            sum.propagationTime128 += time
            iterration128++;
            break;
          case '512':
            sum.propagationTime512 += time
            iterration512++;
            break;
          case '1024':
            sum.propagationTime1024 += time
            iterration1024++;
            break;
        }
      } else {
        result.loss++;
      }
    });

    // result.avgPropagationTime128 = sum.propagationTime128 / iterration128;
    // result.avgPropagationTime512 = sum.propagationTime512 / iterration512;
    // result.avgPropagationTime1024 = sum.propagationTime1024 / iterration1024;

    // console.log('result:');
    // console.log(util.inspect(result, false, null, true));
    loss += result.loss;
  }

  summary(propogationTime, loss);
}

function summary(propogationTime, loss) {
  console.log('\n\n***** SUMMARY *****\n');
  let max = -Infinity;
  let min = Infinity;
  let sum = 0;
  const numberOfTransaction = propogationTime.length

  propogationTime.forEach((time) => {
    sum += time;
    max = time > max ? time : max;
    min = time > min ? min : time;
  });

  const avg = sum / numberOfTransaction;

  let std = 0;
  propogationTime.forEach((time) => std += Math.pow(time - avg, 2));
  std = Math.pow(std / numberOfTransaction, 0.5);

  console.log(`Number of Done Transaction: ${numberOfTransaction / numberOfNode}`);
  console.log(`loss: ${loss}`);
  console.log('\nPropagation Time');
  console.log(`Average: ${avg} ms`);
  console.log(`Maximum: ${max} ms`);
  console.log(`Minimum: ${min} ms`);
  console.log(`Standard Deviation: ${std} ms`);
}

main();
