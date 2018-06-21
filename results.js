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

    // console.log("All IPs are fetched");
  }
  // console.log(`IP address list: ${util.inspect(address)}`);

  await getAllFiles(address); // download all files from webservers of specified IP address
  calculation(address);
}

async function downloadFile(address, fileName) {
  // Get the data from url
  var data = "";
  var url = "http://" + address + ":8100/" + fileName;

  // var response = await axios.get(url);
  // var data = response.data;
  let response;
  try {
    response = await axios.get(url);
    data = response.data;
  } catch (err) {
    console.error(`Error GET ${url}`);
    return;
  }

  var name = "result/" + address.split('.').join("_") + ".csv";
  // await writeFile(data, name); // write the datas in a file
  writeFile(name, data);
}

async function getAllFiles(address) {
  var index = 0;
  // console.log("Start downloading the remote result files");
  for (let i = 0; i < address.length; i++) {
    const ip = address[i];
    await downloadFile(ip, 'result.csv');
  }
}

async function calculation(address) {
  console.log("Start calculations");
  //Get logs from loadtest.js
  var loadTestData = await readFilePromise("result/transactionList.csv", 'utf8')
  var loadTestParsed = Papa.parse(loadTestData).data;

  const initTransactionData = [];
  loadTestParsed.forEach((item) => {
    if (item[0] && item[1] && item[2]) initTransactionData[item[0]] = [item[1], item[2]];
  });

  const numberOfTransaction = initTransactionData.length;

  const transactionTime = [];
  for (let i = 0; i < numberOfTransaction; i++) transactionTime[i] = [];

  let loss = 0;

  for (let i = 0; i < address.length; i++) {
    const fileName = address[i].split('.').join('_') + '.csv';
    const filePath = 'result/' + fileName;
    let fileData;
    try {
      fileData = await readFilePromise(filePath, 'utf8');
    } catch (err) {
      console.error(`Cannot read ${filePath}`);
      continue;
    }
    const fileParsed = Papa.parse(fileData).data;

    const endTransactionData = [];

    if (!fileParsed[fileParsed.length - 1][0] && !fileParsed[fileParsed.length - 1][1]) {
      fileParsed.pop();
    }

    const fpLength = fileParsed.length;
    for (let i = fpLength - numberOfTransaction; i < fileParsed.length; i++) {
      const row = fileParsed[i];
      if (!row) continue;

      if (row[0] && row[1]) endTransactionData[row[0]] = row[1];
    }

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
        transactionTime[seq].push(time);

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

  summary(transactionTime, loss, numberOfTransaction);
}

function summary(transactionTimeList, loss, N) {
  const result = [];

  const commitTime = {
    data: [],
    min: Infinity,
    max: -Infinity,
    avg: 0,
  };

  const transactionTime = {
    data: [],
    min: Infinity,
    max: -Infinity,
    avg: 0,
  };

  const propagationTime = {
    data: [],
    min: Infinity,
    max: -Infinity,
    avg: 0,
  };

  const getSummaryStat = (stat) => {
    let max = -Infinity;
    let min = Infinity;
    let sum = 0;
    stat.data.forEach((item) => {
      max = item > max ? item : max;
      min = item > min ? min : item;
      sum += item;
    });

    stat.max = max;
    stat.min = min;
    stat.avg = sum / stat.data.length;
  };

  for (let i = 0; i < transactionTimeList.length; i++) {
    if (transactionTimeList[i].length < 1) continue;

    let timeForTransaction = -Infinity;
    let timeToCommit = Infinity;

    // get transaction time and first commit time for each seq on every node
    for (let j = 0; j < transactionTimeList[i].length; j++) {
      const time = transactionTimeList[i][j];
      if (!time) continue;

      timeForTransaction = time > timeForTransaction ? time : timeForTransaction;
      timeToCommit = time > timeToCommit ? timeToCommit : time;
    }

    commitTime.data.push(timeToCommit);
    transactionTime.data.push(timeForTransaction);

    const timeToPropagate = timeForTransaction - timeToCommit;
    propagationTime.data.push(timeToPropagate);

    result[i] = {
      seq: i,
      timeForTransaction,
      timeToCommit,
      timeToPropagate,
    };
  }

  const resultCSV = Papa.unparse(result);
  writeFile('TransactionResult.csv', resultCSV);

  getSummaryStat(commitTime);
  getSummaryStat(transactionTime);
  getSummaryStat(propagationTime);

  const statReport = (message, stat) => {
    const aMin = 60000;
    let minString = `${stat.min} ms`;
    let maxString = `${stat.max} ms`;
    let avgString = `${stat.avg} ms`;

    if (stat.max > aMin) {
      const minMinute = (stat.min / aMin).toFixed(2);
      const maxMinute = (stat.max / aMin).toFixed(2);
      const avgMinute = (stat.avg / aMin).toFixed(2);

      minString = `${minString} (${minMinute} mins)`;
      maxString = `${maxString} (${maxMinute} mins)`;
      avgString = `${avgString} (${avgMinute} mins)`;
    }

    console.log(`\n${message}:`);
    console.log(`Minimum: ${minString}`);
    console.log(`Maximum: ${maxString}`);
    console.log(`Average: ${avgString}`);
  };

  console.log(`Number of Transaction: ${N}`);
  console.log(`loss: ${loss}`);
  statReport('Transaction Time', transactionTime);
  statReport('Commit Time', commitTime);
  statReport('Propagation Time', propagationTime);
}

main();
