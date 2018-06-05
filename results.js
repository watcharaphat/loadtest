var argv = require('yargs')
.usage('Usage: $0 -a [string]')
.demandOption(['a'])
.argv;
const util= require('util');
var fs = require('fs');
const readFilePromise = util.promisify(fs.readFile);
const writeFilePromise = util.promisify(fs.writeFile);
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const readline = require('readline');
var http = require('http');
var request = require('request');
var path = require('path');
let address;
const getPromise = util.promisify(http.get);
const getAllFilesPromise = util.promisify(getAllFiles);
const axios = require('axios');
const Papa = require('papaparse');
const csv = require('fast-csv');


async function run(){
    var string = argv.a;
    const file = await readFilePromise(string, 'utf8');
    address = file.split(";");
    await getAllFiles(address); // download all files from webservers of specified IP address
    calculation(address);
}


async function writeFile(data, filename) {
    try{
        await writeFilePromise(filename, data);
        console.log("The file was saved!");
    }catch(err){
        console.log(err);
    }
}


async function downloadFile(address, filename) {
    // Get the data from url
    var data = "";
    var url = "http://"+address+":8100/"+filename;
    console.log(url)

    var response = await axios.get(url);
    var data = response.data;
    
    var name = "results/"+address.split('.').join("_")+".csv" ;
    await writeFile(data,name); // write the datas in a file
    
}


async function getAllFiles(address) {
    var index = 0;
    while(address[index]!=null){
        var destination = address[index].split(",");
        await downloadFile(destination[0],'result.csv' );
        index +=2;
    }
}

async function calculation(address){
    var index = 0;
    //Get logs from loadtest.js
    var loadTestData = await readFilePromise("results/transactionList.csv",'utf8')
    var loadTestParsed = Papa.parse(loadTestData).data;

    
    // Get each result file from TM nodes
    while(address[index]!=null){
        var destinationPair = address[index].split(",");
        
        var filePath = "results/" + destinationPair[0] + ".csv" ;
        var fileData = await readFilePromise(filePath,'utf8');
        var fileParsed = Papa.parse(fileData).data;
        // compare the two files
        
        var sumPropagationTime= 0;
        
        for(var i in loadTestParsed,fileParsed)
        {
           if(loadTestParsed[i] != null && fileParsed[i] != null && loadTestParsed[i][1] == fileParsed[i][1])
            {
                var propagationTime = fileParsed[i][0] - loadTestParsed[i][0];
                sumPropagationTime += propagationTime;
            }
            
        }
        
        var avgPropagationTime = sumPropagationTime / i;
        console.log("Average propagation time of node : " +destinationPair[0] + " = " + avgPropagationTime )
        
        
        index +=1 ;
    }
}

async function main(){
     run();

}

main();
