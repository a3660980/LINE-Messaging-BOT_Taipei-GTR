var mysql = require("mysql");
var request = require("request");
var distance = require("./distance.js");
var async = require("async");
var LineBot = require('line-bot-sdk');
var client = LineBot.client({
  channelID: '1464358964',
  channelSecret: '0b9da8b0037725b17bf846accf0fb2a7',
  channelMID: 'u698582ebfdc688dfbfac236951236ea3'
});
//建立資料庫連線
function Connect(){
  var connection  = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 's1104137110',
  });
  connection.connect();
  return connection;
}

function nowSearch(userlat,userlng,area,mid){
    console.log(userlat+" "+userlng+" "+area+" "+mid);
    var connection = Connect();
    connection.query("Select remind From taipei_user where mid ='"+mid+"'",function(err,result){
        console.log(result);
       if(err) throw err;
       result.forEach(function(row){
          if(row.remind == 0){
            client.sendText(mid,"今日停止行駛垃圾車");
            return;
          }else{
            var GetDistance = new Array;
            var i=0;
            connection.query("Select lat,lng From taipei where area='"+area+"'",function(err,result){
                if(err) throw err;
                result.forEach(function(row){
                  GetDistance[i] = new Array;
                  GetDistance[i][0] = distance.getDistance(userlat,userlng,row.lat,row.lng);
                  GetDistance[i][1] = row.lat;
                  GetDistance[i][2] = row.lng;
                  i++;
               });
            });
            setTimeout(function(){
                compare(GetDistance,mid);
            },1000);
            }
       });
    });
}

function Nowlatlng(mid,useraddr,area){ //儲存使用者輸入地之經緯度
    var URLuseraddr =encodeURI(useraddr);
    request("http://maps.googleapis.com/maps/api/geocode/json?address="+URLuseraddr+"", function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var result = JSON.parse(body);
            var userlat = result.results[0].geometry.location.lat;
            var userlng = result.results[0].geometry.location.lng;
            nowSearch(userlat,userlng,area,mid);
        }
    });
}

function compare(GetDistance,mid){
    var Shortlat,Shortlng;
    var shortdistance=99999;
    var text;
    async.series({
        one: function(callback){
            for(var i=0;i<GetDistance.length;i++){
                if(shortdistance>=GetDistance[i][0]){
                    shortdistance = GetDistance[i][0];
                    Shortlat = GetDistance[i][1];
                    Shortlng = GetDistance[i][2];
                }
            }
            callback(null,1)
        },
        two: function(callback){
            var connection = Connect();
            connection.query("Select address,time from taipei where lat = '"+Shortlat+"' AND lng = '"+Shortlng+"'",function(err,result){
               if(err) throw err;
               result.forEach(function(row){
                    text = "最近地點："+row.address+"\n距離約 "+parseInt(shortdistance)+" 公尺"+"\n時間："+row.time;
               });
            });
            setTimeout(function(){
                callback(null,2);
            },500);
        },
        three: function(callback){
            client.sendText(mid,text);
            callback(null,3);
        }
    },function(err,result){
        if(err) throw err
    });
}

exports.Nowlatlng = Nowlatlng;