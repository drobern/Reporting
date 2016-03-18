var express = require('express');
var app = express();
var querystring = require("querystring");
var url = require("url");
var http = require("http");

var https = require('https');
var fs = require('fs');
var request = require('request');
var moment = require('moment');
var _mysql = require('mysql');
var config = require('./config');


console.log('HOST: '+config.host);
var HOST = config.host;
var PORT = config.port;
var MYSQL_USER = config.username;
var MYSQL_PASS = config.password;
var DATABASE = config.database;

var mysql = _mysql.createConnection({
    host: HOST,
    port: PORT,
    user: MYSQL_USER,
    password: MYSQL_PASS,
    database: DATABASE,
});

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));

var t = 0;
var interval =  60 * 50 * 50; // secs
var orgNames = {};

  
var orgs = function() {
  var data = mysql.query('select distinct(customer) from reporting', function selectCb(err, results, fields) {
    if (err) {
       throw 'MYSQL ERROR: '+err;
       response.end();
    }
    for (var i in results) {
      if (results[i].customer in orgNames) { 
        //console.log('IN INDEX');
      } else {
        if (t == 0) {
          orgNames['ALL'] = t;
          t++
        }
        if (results[i].customer !='null') {          
          orgNames[results[i].customer] = t;
          t++; 
        }
      }
    }
  });
};

function solveFormat(date) {
  if (typeof date === "string") {
    return null 
  } else { 
    var zone = date.toString().slice(35,-1);
    console.log ('THE ZONE: '+zone);
    if (zone == 'EDT') {
      date.setHours(date.getHours() - 4);
    } else {
      date.setHours(date.getHours() - 5);
    }
    return moment(date).format('ddd MMM DD YYYY HH:mm:ss')
  }
}

app.get('/index',function(req,res){
  org = req.query.org;
  //console.log('THE ORG: '+org)
  if (req.query.org == 'ALL') {
    organization = '%'
  } else {
    organization = req.query.org;
  }
  var df = new Date(req.query.df);
  var dt = new Date(req.query.dt)
  df.setSeconds(00);
  df.setMinutes(00);
  df.setHours(00);
  dt.setSeconds(59);
  dt.setMinutes(59);
  dt.setHours(23);
  
  var done = function(gd, pd, pt, pp, cd, td, pd, time, open, closed, tickets) {
    var ndate = moment(dt);
    var sdate = moment(df);
    res.render("index", {gd: gd, pd: pd, pt: pt, pp: pp, cd: cd, td: td, pd: pd, org: org, date: ndate, seven_date: sdate, names: orgNames, time: time, open: open, closed: closed, tickets: tickets})
  }
  graphdata(organization, df, dt, done);
});

app.get('/',function(req,res){
  var done = function(gd, pd, pt, pp, cd, td, pd, time, open, closed, tickets) {
    var ndate = moment(today);
    var sdate = moment(d);
    res.render("index", {gd: gd, pd: pd, pt: pt, pp: pp, cd:cd, td: td, pd: pd, org: "All", date: ndate, seven_date: sdate, names: orgNames, time: time, open: open, closed: closed, tickets: tickets})
  }
  var today = new Date();
  var d = new Date();
  
  d.setDate(d.getDate() - 7);
  d.setSeconds(00);
  d.setMinutes(00);
  d.setHours(00);  
  var seven_date = new Date();
  seven_date.setSeconds(59);
  seven_date.setMinutes(59);
  seven_date.setHours(23);
  graphdata("%", d, seven_date, done);
});

var graphdata = function(org, date, seven_day, done) {
  //console.log('DATE: '+moment(date).format()+' SEVEN DATE: '+moment(seven_day).format());
  var open = 0;
  var closed = 0;
  var tickets = 0;
  var difference = 0;
  var total = 0;
  var time = 0;
  var divisor = 0;
  var graphData = {};
  graphData.cols = [];
  graphData.rows = [];
  graphData.cols[0] = {"id":"","label":"Ticket ID","type":"string"};
  graphData.cols[1] = {"subject":"","label":"Subject","type":"string"};
  graphData.cols[2] = {"type":"","label":"Ticket Type","type":"string"};
  graphData.cols[3] = {"priority":"","label":"Priority","type":"string"};
  graphData.cols[4] = {"product":"","label":"product","type":"string"};
  graphData.cols[5] = {"customer":"","label":"customer","type":"string"};
  graphData.cols[6] = {"category":"","label":"Category","type":"string"};
  graphData.cols[7] = {"requested":"","label":"Date Requested","type":"datetime"};
  graphData.cols[8] = {"solved":"","label":"Solved Date","type":"datetime"};
  graphData.cols[9] = {"status":"","label":"Status","type":"string"};

  var catData = {};
  catData.cols = [];
  catData.rows = [];
  catData.cols[0] = {"name":"","label":"Category Name","type":"string"};
  catData.cols[1] = {"count":"","label":"Count","type":"number"};

  var typeData = {};
  typeData.cols = [];
  typeData.rows = [];
  typeData.cols[0] = {"name":"","label":"Ticket Type","type":"string"};
  typeData.cols[1] = {"count":"","label":"Count","type":"number"};


  var priData = {};
  priData.cols = [];
  priData.rows = [];
  priData.cols[0] = {"name":"","label":"Priority Level","type":"string"};
  priData.cols[1] = {"count":"","label":"Count","type":"number"};
  
  var categories = {};
  var pieDataC = {};
  pieDataC.cols = [];
  pieDataC.rows = [];
  pieDataC.cols[0] = {"id":"","label":"Category","type":"string"};
  pieDataC.cols[1] = {"id":"","label":"Count","type":"number"};

  var type = {};
  var pieDataT = {};
  pieDataT.cols = [];
  pieDataT.rows = [];
  pieDataT.cols[0] = {"id":"","label":"Ticket Type","type":"string"};
  pieDataT.cols[1] = {"id":"","label":"Count","type":"number"};

  var priority = {};
  var pieDataP = {};
  pieDataP.cols = [];
  pieDataP.rows = [];
  pieDataP.cols[0] = {"id":"","label":"Priority Type","type":"string"};
  pieDataP.cols[1] = {"id":"","label":"Count","type":"number"};

  console.log("REQUEST: "+date+" SOLVED: "+seven_day);

  mysql.query('use ' + DATABASE);

  var data = mysql.query('select * from reporting where (requested between "'+moment(date).format()+'" and "'+moment(seven_day).format()+'")  and customer like "'+org+'"', function selectCb(err, results, fields) {
    if (err) {
       throw err;
       response.end();
    }
    for (var i in results) {
      if (results[i].status == "Open") {
        open += 1;
        tickets += 1;
      } else {
        closed += 1;
        tickets += 1;
      } 

      if (results[i].status == "Solved" || results[i].status == "Closed") {
        var sdate = moment(results[i].solved).unix();
        var rdate = moment(results[i].requested).unix();
        difference = sdate - rdate;
        total += difference;
        divisor += 1;
       // console.log('THE DIFFERENCE: '+difference+' THE DIVISOR: '+divisor+' THE TICKET ID: '+results[i].id);
      } 
      //console.log("REQUESTED DATE: "+results[i].requested+" SOLVED DATE: "+results[i].solved); 
      graphData.rows[i] = {"c":[{"v":results[i].id,"f":null},{"v":results[i].subject,"f":null}
      ,{"v":results[i].type,"f":null},{"v":results[i].priority,"f":null},{"v":results[i].product,"f":null}
      ,{"v":results[i].customer,"f":null},{"v":results[i].category,"f":null}
      ,{"v":new Date(results[i].requested), "f": moment(results[i].requested).format('ddd MMM DD YYYY HH:mm:ss')}
      , {"v":new Date(results[i].solved), "f":solveFormat(results[i].solved)}, {"v":results[i].status,"f":null}]};
      if (results[i].category in categories) {
        categories[results[i].category] += 1;
      } else {
        categories[results[i].category] = 1;
      }

      if (results[i].type in type) {
        type[results[i].type] += 1;
      } else {
        type[results[i].type] = 1;
      }

      if (results[i].priority in priority) {
        priority[results[i].priority] += 1;
      } else {
        priority[results[i].priority] = 1;
      }
    }
    console.log('THE TOTAL: '+total+' THE DIVISOR: '+divisor);
    time = ((total / divisor) / 3600).toFixed(2);
    //console.log('CATEGORIES'+JSON.stringify(categories,null,2,true))
    for (i=0;i<Object.keys(categories).length;i++) {
      pieDataC.rows[i] = {"c":[{"v":Object.keys(categories)[i],"f":null},{"v":categories[Object.keys(categories)[i]],"f":null}]};
      catData.rows[i] = {"c":[{"v":Object.keys(categories)[i],"f":null},{"v":categories[Object.keys(categories)[i]],"f":null}]};
    }


    //console.log('TICKET TYPE'+JSON.stringify(type,null,2,true))
    for (i=0;i<Object.keys(type).length;i++) {
      pieDataT.rows[i]  = {"c":[{"v":Object.keys(type)[i],"f":null},{"v":type[Object.keys(type)[i]],"f":null}]};
      typeData.rows[i] = {"c":[{"v":Object.keys(type)[i],"f":null},{"v":type[Object.keys(type)[i]],"f":null}]};
    }

    //console.log('PRIORITY'+JSON.stringify(priority,null,2,true))
    for (i=0;i<Object.keys(priority).length;i++) {
      pieDataP.rows[i]  = {"c":[{"v":Object.keys(priority)[i],"f":null},{"v":priority[Object.keys(priority)[i]],"f":null}]};
      priData.rows[i] = {"c":[{"v":Object.keys(priority)[i],"f":null},{"v":priority[Object.keys(priority)[i]],"f":null}]};
    }
    done(graphData, pieDataC, pieDataT, pieDataP, catData, typeData, priData, time, open, closed, tickets);
  });
};


orgs();
setInterval(orgs, interval);

app.listen(3000);