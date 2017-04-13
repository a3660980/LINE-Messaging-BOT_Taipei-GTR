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
      host: 'localhost:8081',
      
      user: 'root',
      password: '',
      database: 's1104137110',
  });
  connection.connect();
  return connection;
}

function SQL(sql){ //處理部分SQL語法
    var connection = Connect();
    connection.query(sql,function(err){
       if(err) throw err;
    });
    connection.end();
}

function Searchlocation(area){ //尋找使用者所居住之行政區之所有垃圾車
    var connection = Connect();
    var latlng = new Array;
    var i =0;
    var sql = "Select lat,lng From taipei where area = '"+area+"'";
    connection.query(sql,function(err,result){
        if(err) throw err;
        result.forEach(function(row){
            latlng[i] = new Array;
            latlng[i][0] = row.lat;
            latlng[i][1] = row.lng;
            i++;
        });
    });
    connection.end();
    return latlng;
}

function FirstSearch(mid,useraddr){ //儲存使用者住處經緯度
    var URLuseraddr =encodeURI(useraddr);
    request("http://maps.googleapis.com/maps/api/geocode/json?address="+URLuseraddr+"", function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var result = JSON.parse(body);
            var userlat = result.results[0].geometry.location.lat;
            var userlng = result.results[0].geometry.location.lng;
            SQL("Update taipei_user Set lat ='"+userlat+"',lng='"+userlng+"' Where mid='"+mid+"'");
        }
    });
}

function Distance(latlng,mid){ //尋找使用者住處最近的垃圾車地點
    var GetDistance = new Array;
    var userlatlng = new Array;
    var Not = false;
    var Shortlat,Shortlng;
    var shortdistance=99999;
    async.series({
        one: function(callback){
          var connection = Connect();
            connection.query("Select remind From taipei_user where mid = '"+mid+"'",function(err,result){
               if(err) throw err;
               console.log(result);
               result.forEach(function(row){
                   if(row.remind==0){
                    Not = true;
                   }
               });
            });  
            setTimeout(function(){
                if(Not){
                    console.log(Not);
                    return;
                }else{
                    console.log(Not);
                    callback(null,0);
                }
            },1000);
        },
        two: function(callback){
            userlatlng = SearchUser("Select lat,lng From taipei_user where mid='"+mid+"'");
            setTimeout(function(){
                callback(null,1);
            },500);
        },
        three:function(callback){
            for(var i=0;i<latlng.length;i++){
                GetDistance[i] = new Array;
                GetDistance[i][0] = distance.getDistance(userlatlng[0],userlatlng[1],latlng[i][0],latlng[i][1]);
                GetDistance[i][1] = latlng[i][0];
                GetDistance[i][2] = latlng[i][1];
            }
            callback(null,2);
        },
        four:function(callback){
            for(var i=0;i<GetDistance.length;i++){
                if(shortdistance>=GetDistance[i][0]){
                    shortdistance = GetDistance[i][0];
                    Shortlat = GetDistance[i][1];
                    Shortlng = GetDistance[i][2];
                }
            }
            callback(null,3);
        },
        five:function(callback){
            Res("Select address,time From taipei where lat='"+Shortlat+"' AND lng='"+Shortlng+"'",mid,shortdistance);
            callback(null,4);
        }
    },function(err,result){
        if(err) throw err;
    });
}

function RecyleDistance(Re,mid){ //尋找與使用者住處最近的資源回收處理地點
    var GetDistance = new Array;
    var userlatlng = new Array;
    var Not = false;
    var Shortlat,Shortlng;
    var shortdistance=99999;
    async.series({
        one: function(callback){
            var connection = Connect();
            connection.query("Select remind From taipei_user where mid = '"+mid+"'",function(err,result){
               if(err) throw err;
               console.log(result);
               result.forEach(function(row){
                   if(row.remind==0){
                    client.sendText(mid,"今日停止行駛垃圾車");
                    Not = true;
                   }
               });
            });  
            setTimeout(function(){
                if(Not){
                    console.log(Not);
                    return;
                }else{
                    console.log(Not);
                    callback(null,0);
                }
            },1000);
        },
        two: function(callback){
            userlatlng = SearchUser("Select lat,lng From taipei_user where mid='"+mid+"'");
            setTimeout(function(){
                callback(null,1);
            },500);
        },
        three:function(callback){
            for(var i=0;i<Re.length;i++){
                GetDistance[i] = new Array;
                GetDistance[i][0] = distance.getDistance(userlatlng[0],userlatlng[1],Re[i][0],Re[i][1]);
                GetDistance[i][1] = Re[i][0];
                GetDistance[i][2] = Re[i][1];
            }
            callback(null,2);
        },
        four:function(callback){
            for(var i=0;i<GetDistance.length;i++){
                if(shortdistance>=GetDistance[i][0]){
                    shortdistance = GetDistance[i][0];
                    Shortlat = GetDistance[i][1];
                    Shortlng = GetDistance[i][2];
                }
            }
            callback(null,3);
        },
        five:function(callback){
            Recyle("Select address,item From taipei_recycle where lat='"+Shortlat+"' AND lng ='"+Shortlng+"'",mid,shortdistance);
            callback(null,4);
        }
    },function(err,result){
        if(err) throw err;
    });
}

function Recyle(sql,mid,shortdistance){ //回報資源回收與廚餘處理地點
    var connection = Connect();
    connection.query(sql,function(err,result){
        if(err) throw err;
        result.forEach(function(row){
            if(row.remind == 0){
                client.sendText(mid,"今日停止行駛垃圾車");
                return;
            }
            if(row.item.substring(0,2)=="每日"){
                SQL("Update taipei_user Set recycle='"+row.address+"',recycle_time='"+row.item+"' where mid ='"+mid+"'");
                client.sendText(mid,"資源回收與廚餘地點\n"+row.address+"\n時間："+row.item+"\n距離約 "+parseInt(shortdistance)+" 公尺");
            }else{
                SQL("Update taipei_user Set recycle='"+row.address+"',recycle_time='每日6時至23時止' where mid ='"+mid+"'");
                client.sendText(mid,"資源回收與廚餘地點\n"+row.address+"\n時間：每日6時至23時止\n附註："+row.item+"\n距離約 "+parseInt(shortdistance)+" 公尺");
            }
        });
    });
    connection.end();
}

function SearchRecyle(sql){ //搜尋使用者所居住行政區之資源回收與廚餘處理處
    var connection = Connect();
    var Re = new Array;
    var i=0;
    connection.query(sql,function(err,result){
        if(err) throw err;
        result.forEach(function(row){
            Re[i] = new Array;
            Re[i][0] = row.lat;
            Re[i][1] = row.lng;
            i++;
        });
    });
    connection.end();
    return Re;
}

function Time(sql,mid){ //定時查詢
    var time = new Date;
    var connection = Connect();
    connection.query(sql,function(err,result){
        if(err) throw err;
        result.forEach(function(row){
            if(row.address == null || row.time==null) return;
            if(row.remind == 0){
                return;
            }
            var Hour = (time.getHours()+8),Minute = (time.getMinutes());
            if(Hour >= 24){
                Hour = Hour - 24;
            }
            if(Hour==parseInt(row.time.substring(0,2))){
                if(Minute==parseInt(row.time.substring(3,5))-5){
                    client.sendText(mid,"垃圾車將於五分鐘後到達\n"+row.address+"");
                }
            }
        });
    });
}

function Res(sql,mid,shortdistance){ //回傳最近垃圾車地點
    var connection = Connect();
    connection.query(sql,function(err,result){
        if(err) throw err;
        result.forEach(function(row){
            if(row.remind==0){
                client.sendText("今日停止行駛垃圾車");
                return;
            }
           SQL("Update taipei_user Set address='"+row.address+"',time='"+row.time+"' where mid ='"+mid+"'");
           client.sendText(mid,"最近的垃圾車地點："+row.address+"\n距離約 "+parseInt(shortdistance)+" 公尺"+"\n垃圾車時間："+row.time+""); 
        });
    });
    connection.end();
}

function SearchUser(sql,area){ //取得使用者住址的經緯度
    var connection = Connect();
    var result =[];
    connection.query(sql,function(err,data){
        if(err) throw err;
        data.forEach(function(row){
            result[0] = row.lat;
            result[1] = row.lng;
        });
    });
    connection.end();
    return result;
}

//搜尋最近的垃圾車資訊 並更新資料庫 (該函式未匯出)
function SearchVicinity(sql){
    var connection = Connect();
    var result = [];
    connection.query(sql,function(err,data){
       if(err) throw err;
       data.forEach(function(row){
          result[0] = row.addr;
          result[1] = row.timeone;
          result[2] = row.timetwo;
       });
    });
    connection.end();
    return result;
}

function administrator(text,mid){
    var connection = Connect();
    connection.query("Select admin From taipei_user where mid='"+mid+"'",function(err,result){
       if(err) throw err;
       result.forEach(function(row){
           console.log(text);
           if(row.admin == "是"){
               if(text == "關閉提醒"){
                   console.log("No");
                    SQL("Update taipei_user set remind = 0 where id >= 1");
                    return;
                }else if(text == "開啟提醒"){
                    console.log("Yes");
                    SQL("Update taipei_user set remind = 1 where id >= 1");
                    return;
                }
                   connection.query("Select mid From taipei_user where id >= 1",function(err,result){
                        if(err) throw err;
                        result.forEach(function(row){
                            console.log(row.mid);
                            client.sendText(row.mid,text);
                        });
                    });
           } 
       });
    });
}

exports.Connect=Connect;
exports.SQL = SQL;
exports.Searchlocation = Searchlocation;
exports.FirstSearch = FirstSearch;
exports.Distance=Distance;
exports.Time=Time;
exports.SearchRecyle = SearchRecyle;
exports.RecyleDistance = RecyleDistance;
exports.administrator = administrator;
