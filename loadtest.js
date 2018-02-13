var dateFormat = require('dateformat');
var distributions = require('probdist');
var NanoTimer = require('nanotimer');
var http = require('http');
var fs = require('fs');
var argv = require('yargs')
    .usage('Usage: $0 -d [num] -m [num] -s [num] -a [string]')
    .demandOption(['d','m','a'])
    .argv;;

var messageCounter = 0;
var startSeq,startTime,endTime;
var timer = new NanoTimer();
var duration,mode,address;
var log;
var destination = [['localhost',3000],
['localhost',3000],
['localhost',3000],
['localhost',3000],
['localhost',3000],
['localhost',3000]];
var destination2;
const MSG_SIZE = [
  [7, 128],
  [23, 512],
  [44, 1024]
];
const ENDPOINT = ["send_all","send_idp"];

async function PostRequest(){
    const rand_size = Math.floor(Math.random() * 3); //random 0 =128 byte , 1 = 512 byte , 2 = 1024 byte
    const msg_date = dateFormat(new Date().toISOString(), "yymmddhhMMss.l");
    const msg = (new Array(MSG_SIZE[rand_size][0]).join( msg_date )).slice(0,MSG_SIZE[rand_size][1]);
    const endpointType = Math.floor(Math.random() * 2); 
    const index = messageCounter%6;
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
           // console.log('Response: ' + chunk);
        });
    });

    // post_req.write(post_data);
     post_req.end();
    log += msg_date+"|" +messageCounter+"|" + msg + "\r\n";
    messageCounter++;
}
async function callRequest(_duration,_mode){
  
  var duration_microsec = (_duration*1000000) + 'u';
  startTime = new Date();
  log = "start time " + dateFormat(startTime.toISOString(), "yymmddhhMMss.l") + "\r\n";
  log += "start seq <" + startSeq + ">\r\n";
  if(_mode == 0){
        timer.setInterval(PostRequest, '', '100u');
        timer.setTimeout(timeout, [timer], duration_microsec);    
  }
  else if (_mode > 0 ){
        const interval = (1000000/_mode) + 'u';
        timer.setInterval(PostRequest, '', interval);
        timer.setTimeout(timeout, [timer], duration_microsec);    
  }
  else if ( _mode < 0 ){
      
  }
  
  //end time yymmddhhmmss.SSS
}

function timeout(timer){
   timer.clearInterval();
   endTime = new Date();
   log += "end time " + dateFormat(endTime.toISOString(), "yymmddhhMMss.l") + "\r\n" ;
   log += "end seq <" + messageCounter + ">\r\n";
   log += "total msg send: " + (messageCounter-startSeq) + "\r\n";
   log += "total time (sec) : " + (endTime.getSeconds() - startTime.getSeconds()) + ">\r\n";
   log += "avg thruput = " + ((messageCounter-startSeq)/(endTime.getSeconds() - startTime.getSeconds())) + ">\r\n";
   log += "mode : " + (mode >= 0 ? "normal" : "poisson") ;
   fs.writeFile(dateFormat(startTime.toISOString(), "yymmddhhMMss")+'.txt', log, function (err) {
    if (err) throw err;
  }); 
}
function ParseArgv(){
    duration = argv.d;
    mode = argv.m|0;
    startSeq = argv.s|0;
    messageCounter = startSeq;
    var string = argv.a;
    address = string.split(",");
}
function main(){
    ParseArgv();
    callRequest(duration,mode,messageCounter);
}
main();


