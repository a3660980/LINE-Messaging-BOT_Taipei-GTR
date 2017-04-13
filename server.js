var request = require('superagent');
var stringify = require('json-stringify');
var bodyParser = require('body-parser');
var express = require('express');
var jsonparser = require('jsonparser');
var LineBot = require('line-bot-sdk');
var async = require("async");
var area = ["中山區","中正區","信義區","內湖區","北投區","南港區","士林區","大同區","大安區","文山區","松山區","萬華區"];
var _ = require('lodash');
var schedule = require('node-schedule');
var rule = new schedule.RecurrenceRule();
var restart = new schedule.RecurrenceRule();
var userMid;
restart.minute = 00;
rule.second = 00;
var db = require("./db.js");
var now = require("./now.js");
var client = LineBot.client({
  channelID: '1464358964',
  channelSecret: '0b9da8b0037725b17bf846accf0fb2a7',
  channelMID: 'u698582ebfdc688dfbfac236951236ea3'
});

schedule.scheduleJob(restart, function(){
    var Time = new Date;
    if(Time.getHours()+8 == 23){
      db.SQL("Update taipei_user set remind = '1' where id>=1");
    }
});

schedule.scheduleJob(rule, function(){
    var Time = new Date;
    if(Time.getDay() ==1 || Time.getDay()==3){
        return;
    }else{
        db.Time("Select address,time,remind From taipei_user where mid='"+userMid+"'",userMid);
    }
});

var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.urlencoded({ extended: false, limit: 2 * 1024 * 1024 }));
app.use(bodyParser.json({ limit: 2 * 1024 * 1024 }));

app.post('/', function (req, res) {
  
  var NotAddr = false;
  var latlng = new Array;
  var Recyle = new Array;
  var receives = client.createReceivesFromJSON(req.body);
  _.each(receives, function(receive){
    userMid = receive.getFromMid();
    if(receive.isMessage()){
        
      if(receive.isText()){
        if(receive.getText().charAt(0)=="A"){
            for(var i=0;i<area.length;i++){
                if(receive.getText().substring(1,7) == ("台北市"+area[i])||receive.getText().substring(1,7) == ("臺北市"+area[i])){
                    latlng = db.Searchlocation(area[i]);
                    Recyle = db.SearchRecyle("Select lng,lat From taipei_recycle where area='"+area[i]+"'");
                    console.log(receive.getText().substring(1));
                    db.FirstSearch(receive.getFromMid(),receive.getText().substring(1));
                    break;
                }
            }
            client.getUserProfile(receive.getFromMid())
                .then(function onResult(res){
                  if(res.status === 200){
                    db.SQL("Update taipei_user set area='"+receive.getText().substring(1)+"' where mid='"+receive.getFromMid()+"'");
                    db.Distance(latlng,receive.getFromMid());
                    db.RecyleDistance(Recyle,receive.getFromMid());
                    client.sendText(receive.getFromMid(), "地址儲存成功");
                  }
                }, function onError(err){
                    console.error(err);
            });
        }else if(receive.getText().charAt(0)=="B"){
          for(var i=0;i<area.length;i++){
                if(receive.getText().substring(1,7) == ("台北市"+area[i])||receive.getText().substring(1,7) == ("臺北市"+area[i])){
                    now.Nowlatlng(receive.getFromMid(),receive.getText().substring(1),area[i]);
                    break;
                }
            }
        }else if(receive.getText()=="發佈公告" || receive.getText() == "發布公告"){
            client.sendText(receive.getFromMid(),"請在公告內容開頭加C");
            return;
        }else if(receive.getText().substring(0,1)=="C"){
            db.administrator(receive.getText().substring(1),receive.getFromMid());
            return;
        }else if(receive.getText() == "help" || receive.getText() == "幫助" || receive.getText() == "Help"){
            client.sendText(receive.getFromMid(),"地址輸入範例：A台北市XX區XX里XX路....(會儲存地址，系統會在前五分鐘提醒)");
            client.sendText(receive.getFromMid(),"地址立即查詢範例：B台北市XX區XX里XX路....\n也可傳送位置訊息進行查詢");
            return;
        }else{
            client.sendText(receive.getFromMid(), "請輸入正確住址，我不是聊天機器人");
            return;
        }

      }else if(receive.isImage()){
        
        client.sendText(receive.getFromMid(), 'Thanks for the image!');

      }else if(receive.isVideo()){

        client.sendText(receive.getFromMid(), 'Thanks for the video!');

      }else if(receive.isAudio()){

        client.sendText(receive.getFromMid(), 'Thanks for the audio!');

      }else if(receive.isLocation()){
        console.log(receive.getAddress());
        now.Nowlatlng(receive.getFromMid(),receive.getAddress().substring(5),receive.getAddress().substring(8,11));
      }else if(receive.isSticker()){

        // This only works if the BOT account have the same sticker too
        client.sendSticker(
            receive.getFromMid(),
            receive.getStkId(),
            receive.getStkPkgId(),
            receive.getStkVer()
          );

      }else if(receive.isContact()){//聯絡人資訊
        
        client.sendText(receive.getFromMid(), 'Thanks for the contact');

      }else{
        console.error('found unknown message type');
      }
    }else if(receive.isOperation()){
       if(receive.result.content.opType==8){//封鎖
           console.log("用戶封鎖");
           db.SQL("Delete From taipei_user where mid='"+receive.getFromMid()+"'");
       }else if(receive.result.content.opType==4){//解封鎖
           console.log("用戶加入好友");
           async.series({
             one: function(callback){
               client.sendImage(receive.getFromMid(),"http://i.imgur.com/JSCf1ae.jpg","http://i.imgur.com/JSCf1ae.jpg");
               setTimeout(function(){
                 callback(null,1);
               },200);
             },
             two: function(callback){
               client.sendText(receive.getFromMid(),"歡迎加入好友，請輸入您的住家位址\n系統將會自動提醒您垃圾車時間\n暫不能使用英文版");
               setTimeout(function(){
                 callback(null,2);
               },300);
             },
             three: function(callback){
               client.sendText(receive.getFromMid(),"請輸入正確定址，否則位置將會定位錯誤");
               setTimeout(function(){
                 callback(null,3);
               },400);
             },
             four: function(callback){
               client.sendText(receive.getFromMid(),"地址輸入範例：A台北市XX區XX里XX路....(會儲存地址，系統會在前五分鐘提醒)");
               setTimeout(function(){
                 callback(null,4);
               },500);
             },
             five: function(callback){
               client.sendText(receive.getFromMid(),"地址立即查詢範例：B台北市XX區XX里XX路....\n也可傳送位置訊息進行查詢");
               setTimeout(function(){
                 callback(null,5);
               },600);
             },
             six: function(callback){
               client.sendText(receive.getFromMid(),"以上訊息可輸入help或幫助可再度查看");
               setTimeout(function(){
                 callback(null,7);
               },700);
             },
             seven: function(callback){
               db.SQL("Insert Into taipei_user(mid) Values('"+receive.getFromMid()+"')");
               callback(null,7);
             },
           },function(err,result){
             if(err) throw err;
           });
       }

    }else {
        //其他未知行為
      console.error('invalid receive type');

    }

  });
  
  res.send('ok');
});

app.listen(app.get('port'), function () {
  console.log('Listening on port ' + app.get('port'));
});