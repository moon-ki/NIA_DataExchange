var express = require('express');
var router = express.Router();
var server = require('../server');
var conn = server.conn;
var async = require('async');

router.get('/admin',function(req,res){
    async.waterfall([
        function(callback){
            conn.query('select \
                            sum(log.receiveCnt) receiveCnt,\
                            log.hospital,\
                            log.created_date\
                        from (\
                            select id, JSON_EXTRACT(meta,"$.receiveCnt") receiveCnt, \
                                    replace(JSON_EXTRACT(meta,"$.from"),\'"\',"") hospital,\
                                    replace(JSON_EXTRACT(meta,"$.message"),\'"\',"") com_seq, \
                                    replace(JSON_EXTRACT(meta,"$.restartYn"),\'"\',"") restart_yn,\
                                    replace(JSON_EXTRACT(meta,"$.status"),\'"\',"") status, \
                                    date_format(timestamp,"%y-%m-%d") created_date,\
                                    meta \
                            from sys_logs_default\
                        ) log\
                        where 1=1\
                        and status = "received"\
                        group by log.created_date, log.hospital\
                        order by log.created_date', [], 

                function(err,datas){
                    var data1 = new Object();
                    if(err) console.log(err);
                    else {

                        var chung=['충남대병원'];
                        var char = ['분당차병원'];
                        var seoul=['분당서울대병원'];
                        var date =['x'];

                        // 그래프를 그리기 위한 형태로 데이터 가공
                        async.each(datas, function(data){
                            date.push(data.created_date);
                            if(data.hospital=='CHAR'){
                                char.push(data.receiveCnt);
                            }else if(data.hospital=='CHUNG'){
                                chung.push(data.receiveCnt);
                            }else if(data.hospital=='SEOUL'){
                                seoul.push(data.receiveCnt);
                            }
                        });

                        // 중복제거
                        var uniquDate = date.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);

                        // 결과 데이터셋 생성
                        data1.x = uniquDate;
                        data1.chung = chung;
                        data1.char = char;
                        data1.seoul = seoul;

                        callback(null, data1);
                    }
            });
        },
        function(data1, callback){
            conn.query('select mst.com_nm, \
                               sum(req.require_cnt)  as require_cnt, \
                               sum(req.response_cnt) as response_cnt\
                         from com_requests req, com_info mst\
                        where req.com_email = mst.com_email\
                          and date_format(req.request_dt,"%y%m") ="1912"\
                        group by mst.com_nm', [], 

                function(err,datas){
                    var data2 = Object();
                    var requireCnt = ['요청건수'];
                    var responseCnt = ['응답건수'];
                    var x = ['x'];

                    if(err) console.log(err);
                    else {
                        async.each(datas, function(data){
                            requireCnt.push(data.require_cnt);
                            responseCnt.push(data.response_cnt);
                            x.push(data.com_nm);
                        });

                        // 결과 데이터셋 생성
                        data2.x = x;
                        data2.requireCnt = requireCnt;
                        data2.responseCnt = responseCnt;

                        callback(null, data1, data2);
                    }
                });
        },
        function(data1, data2, callback){
            callback(null,data1, data2)
        },
        function(data1, data2, callback){
            console.log(data1);
            console.log(data2);
            res.render('./admin/admin',{ data1:data1, data2:data2 });
        }
    ]);

});

module.exports = router;