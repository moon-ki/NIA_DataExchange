//************************************************관련 모듈 로드
var express = require('express');
var path= require('path');
var app = express();
var bodyParser = require('body-parser');
// var passport = require('passport');
// var localStrategy = require('passport-local').Strategy;
var session = require('express-session');
var winston_mysql = require('winston-mysql');
//************************************************미들웨어 로드
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:false }));
//*************************************************mysql 연결
var mysql = require('mysql');
var dbConfig = {
    host    : '116.89.189.11',
    user    : 'de_dev',
    password: 'althghdansrl',
    port    : 3306,
    database: 'NIA_DataExchanger'
    // host    : 'localhost',
    // user    : 'de_dev',
    // password: 'althghdansrl',
    // port    : 3306,
    // database: 'de_dev'
};
var connection = mysql.createConnection(dbConfig);
connection.connect();
exports.conn = connection;
//************************************************Logger 셋팅
dbConfig.table = 'sys_logs_default';
var winston = require('winston');
var logger = new (winston.createLogger)({
    transports : [
        new winston_mysql(dbConfig)]
});
exports.logger = logger;
//************************************************ session 처리
var MySqlStore = require('express-mysql-session')(session);
app.use(
    session({
        secret:'!@#$%^D',
        store: new MySqlStore(dbConfig),
        resave:false,
        saveUninitialized:false
}));

// ***********************************************routing 처리

// path 모듈을 설치하고 ejs경로를 찾아갈 수 있게 뷰엔진을 추가
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 정적 path 셋팅
app.use('/styles',express.static('css'));
app.use('/public',express.static('public'));
app.use('/images', express.static('images'));
app.use('/utils', express.static('utils'));
app.use('/lib', express.static('lib'));
app.use('/font', express.static('font'));

//  라우팅 처리
app.use('/user', require('./routes/user')); 
app.use('/company', require('./routes/company'));
// app.use('/pop', require('./routes/company'));
app.use('/test', require('./routes/util'));

app.locals.isLogin = false;

//was 기동
app.listen(8080, function() {
    console.log('-------------------Application Started-------------------');
});