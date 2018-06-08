var dateFormat = require('dateformat');
var distributions = require('probdist');
var NanoTimer = require('nanotimer');
var http = require('http');
var fs = require('fs');
var argv = require('yargs')
  .usage('Usage: $0 -d [num] -m [num] -s [num] -a [string]')
  .demandOption(['d','m'])
  .argv;;

const axios = require('axios');
const util = require('util');

var messageCounter = 0;
var startSeq,startTime,endTime;
var timer = new NanoTimer();
var duration,mode,address;
var durationInMilliseconds;
var log;
var poisson_sleep
var startClock;
var poisson_time;

const MSG_SIZE = [
  [9, 128],
  [33, 512],
  [65, 1024]
];
const ENDPOINT = ["send_all", "send_idp"];

let numberOfNode = 0;

async function PostRequest() {
  const rand_size = Math.floor(Math.random() * 3); //random 0 =128 byte , 1 = 512 byte , 2 = 1024 byte
  const msg_date = dateFormat(new Date().toISOString(), "yymmddHHMMss.l");
  const msg = (new Array(MSG_SIZE[rand_size][0]).join( msg_date )).slice(0,MSG_SIZE[rand_size][1]);
  const endpointType = Math.floor(Math.random() * 2); 
  const index = messageCounter % numberOfNode;
  console.log(`index: ${index}`);
  var post_data = JSON.stringify({ message: msg })
  var post_options = {
    host: address[index*2],
    port: address[(index*2)+1],
    path: "/"+ENDPOINT[endpointType]+"/"+messageCounter,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
  };
  var post_req = http.request(post_options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      //console.log('Response: ' + chunk);
    });
  });

  post_req.write(post_data);
  post_req.end();
  // log += msg_date+"," +messageCounter+"," +(endpointType == 0 ? "A" : "I")+"," +index+"," +MSG_SIZE[rand_size][1]+"," + msg + "\r\n";
  log += Date.now() + ',' + messageCounter + '\r\n';
  messageCounter++;
}
async function callRequest(_duration,_mode) {
  var duration_microsec = (_duration*1000000) + 'u';
  if(_mode == 0) {
    startTime = new Date();
    // log = "start time " + dateFormat(startTime.toISOString(), "yymmddHHMMss.l") + "\r\n";
    // log += "start seq <" + startSeq + ">\r\n";
    timer.setInterval(PostRequest, '', '100u');
    timer.setTimeout(timeout, [timer], duration_microsec);    
  } else if (_mode > 0 ) {
    startTime = new Date();
    // log = "start time " + dateFormat(startTime.toISOString(), "yymmddHHMMss.l") + "\r\n";
    // log += "start seq <" + startSeq + ">\r\n";
  
    const interval = (1000000/_mode) + 'u';
    timer.setInterval(PostRequest, '', interval);
    timer.setTimeout(timeout, [timer], duration_microsec);    
  }
  else if ( _mode < 0 ){
    const tps = _mode * -1;
    durationInMilliseconds = _duration * 1000;
    const sleeptime =  1000000/tps ;
    var poisson_init = distributions.poisson(sleeptime);
    poisson_sleep = poisson_init.sample(tps*duration);
    startClock = Date.now();
    startTime = new Date();
    // log = "start time " + dateFormat(startTime.toISOString(), "yymmddHHMMss.l") + "\r\n";
    // log += "start seq <" + startSeq + ">\r\n";

    poisson_time = 0
    timer.setTimeout(PostPoisson, [timer], (poisson_time +'u'));
  }
}

function PostPoisson(timer){
  poisson_time = poisson_sleep[messageCounter-startSeq]
  timer.setTimeout(PostPoisson, [timer], (poisson_time +'u'));

  PostRequest();

  if( Date.now() - startClock >= durationInMilliseconds ) {
    timer.clearTimeout();
    timer.clearInterval();
    endTime = new Date();
    // log += "end time " + dateFormat(endTime.toISOString(), "yymmddHHMMss.l") + "\r\n" ;
    // log += "end seq <" + messageCounter + ">\r\n";
    // log += "total msg send: " + (messageCounter-startSeq) + "\r\n";
    // log += "total time (sec) : " + ((endTime.getTime() - startTime.getTime())/1000) + "\r\n";
    // log += "avg thruput = " + ((messageCounter-startSeq)/((endTime.getTime() - startTime.getTime())/1000)) + "\r\n";
    // log += "mode : " + (mode >= 0 ? "normal" : "poisson") ;
    fs.writeFile('result/' + dateFormat(startTime.toISOString(), "yymmddHHMMss")+'.txt', log, function (err) {
      if (err) throw err;
    }); 
  }
}

function timeout(timer) {
  timer.clearInterval();
  endTime = new Date();
  // log += "end time " + dateFormat(endTime.toISOString(), "yymmddHHMMss.l") + "\r\n" ;
  // log += "end seq <" + messageCounter + ">\r\n";
  // log += "total msg send: " + (messageCounter-startSeq) + "\r\n";
  // log += "total time (sec) : " + ((endTime.getTime() - startTime.getTime())/1000) + "\r\n";
  // log += "avg thruput = " + ((messageCounter-startSeq)/((endTime.getTime() - startTime.getTime())/1000)) + "\r\n";
  // log += "mode : " + (mode >= 0 ? "normal" : "poisson") ;
  fs.writeFile(dateFormat(startTime.toISOString(), "yymmddHHMMss")+'.txt', log, function (err) {
    if (err) throw err;
  }); 
}
async function ParseArgv() {
  duration = argv.d;
  mode = argv.m|0;
  startSeq = argv.s|0;
  messageCounter = startSeq;
  if (argv.a) {
    var string = argv.a;
    address = string.split(",");
    numberOfNode = 6;
  } else if (argv.b) {
    const baseURL = `http://${argv.b}`;
    const api = '/api-ip/list';
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
      // address.push(ip);
      address.push('localhost');
      address.push('8000');
    });

    console.log("All IPs are fetched");
  }

  console.log(`IP address list: ${util.inspect(address)}`);
}

ParseArgv().then(async () => {
  callRequest(duration, mode, messageCounter);
});
