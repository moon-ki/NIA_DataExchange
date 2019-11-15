var express = require('express');
var router = express.Router();
var request = require('request');
var async = require('async');
var server = require('../server');
var conn = server.conn;
var asyncEachSeries = require('async-each-series');
var logger = server.logger;

router.get('/dddd', function(req, res){
    console.log('api call!');
    request({
        uri:'http://15.164.250.176:3000/data',
        method:'POST',
        enctype: 'multipart/form-data',
        json:{
            // hospital:"분당서울대학교병원",
            // hospital:"분당차병원",
            hospital:"충남대학교병원",
            userNumbers:[41,62,21164]
        }
    },function(error, response, result){
        
        console.log(result.result.length, '건의 PHR 레코드를 수신했습니다. 파싱을 시작합니다.');
        if(result.result=="" || result.result==null) {
            console.log('데이터가 없습니다.'); 
            res.end();
        }else{ //phr 파싱 처리

            var phrArrayTotal = [];
            for(var j=0; j < result.result.length; j++){
                console.log(j,'번째 데이터 파싱!!----------------------------------------');
                var phrArrayOne = [];
                for(var i=1 ; i < result.result[j].entry.length ; i++){
                    // 환자 의료정보
                    // height ~ drink_yn
                    // console.log(result.result[j].entry[i].code.coding[0].display);  //항목명
                    // console.log(i,result.result[j].entry[i].valueQuantity.value);     //값
                    phrArrayOne.push(result.result[j].entry[i].valueQuantity.value);
                }
                //환자 인적사항
                var hospital_pcode = result.result[j].entry[0].id.split('-'); 
                phrArrayOne.push({p_hostpital : hospital_pcode[0]});                       //충남대학교병원
                phrArrayOne.push({p_code : hospital_pcode[1]});                            //19
                phrArrayOne.push({gender : result.result[j].entry[0].gender});             //female
                phrArrayOne.push({p_location : result.result[j].entry[0].address[0].text});//대전광역시
                phrArrayOne.push({p_phone : result.result[j].entry[0].telecom[0].value});  //010-5782-9338
                phrArrayOne.push({p_name : result.result[j].entry[0].name.text});          //방규연
                phrArrayOne.push({birth_dt : result.result[j].entry[0].birthDate});        //1995-02-26
                // phrArrayOne.push({hospital_pcode : result.result[j].entry[0].managingOrganization.display});    //충남대학교병원

                phrArrayTotal.push(phrArrayOne);
            }
            console.log(phrArrayTotal);
            res.end();
        }
    });
});

// ------------------- async.each 의 비동기 처리 테스트!!
router.get('/cccc', function(req, res){
    // logger.info('');
    // logger.error('first error!!!');
    // logger.warn('first warn!!!');
    var arrayTmp = [1,2,3,4,5,6,7,8,9,10];
    // for(var i =0; i<5; i++){
    var i=0;
    asyncEachSeries(arrayTmp, function(token, next){
        console.log('for test start!');
        
        console.log(i)
        setTimeout(function(){
            ++i;
            console.log('-----------',token+'['+i+']')
        }, Math.random() * 5000);
        
        next();
    });

    res.end();
});

// ------------------- async.each 의 비동기 처리 테스트!!
router.get('/9999', function(req, res){
    conn.query('select cast(require_cnt as unsigned) as require_cnt, \
                        cast(response_cnt as unsigned) as response_cnt\
                        from com_requests where seq = 189', [], 

    function(err,result){
        // if(result.require_cnt > result.response_cnt){
        //     next();
        // }else{
        //     console.log(result.require_cnt, result.response_cnt);
        // }
        if(err) console.log(err);
        console.log(result[0].require_cnt, result[0].response_cnt)
    });

});

router.get('/logger', function(req, res){
    logger.info("Test logger!", {message:'ddfdfkdjkjjfjf', mykey:'mykey'});
});

module.exports = router;
