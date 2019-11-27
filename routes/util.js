var express = require('express');
var router = express.Router();
var request = require('request');
var async = require('async');
var server = require('../server');
var conn = server.conn;
var asyncEachSeries = require('async-each-series');
var logger = server.logger;

router.get('/8088', function(req, res){
    console.log('api call!');
    var response = request({
        uri: 'http://116.89.189.32:8088/apiapp/',
        method:'POST',
        enctype: 'multipart/form-data',
        json:{
                "s_year_of_this_data":'2017',
                "s_individual_person_number":'390',
                "s_sex_code":'1',
                "s_age_code":'8',
                "s_location_code":'47',
                "s_height":'165.0',
                "s_weight":'85.0',
                "s_waist_circumference":'96.0',
                "s_vision_left":'1.5',
                "s_vision_right":'1.5',
                "s_hearing_left":'1.0',
                "s_hearing_right":'1.0',
                "s_systolic_blood_pressure":'140.0',
                "s_diastolic_blood_pressure":'100.0',
                "s_fasting_glucose":'114.0',
                "s_total_cholesterol":'236.0',
                "s_triglyceride":'125.0',
                "s_hdl_cholesterol":'51.0',
                "s_ldl_cholesterol":'160.0',
                "s_hemoglobin":'16.0',
                "s_urine_protein":'1.0',
                "s_creatinine":'1.4',
                "s_ast":'48.0',
                "s_alt":'130.0',
                "s_gamma_gtp":'92.0',
                "s_smoke_status":'1.0',
                "s_drinking_status":'1.0',
                "s_got_oral_examination":'1',
                "s_has_cavity":'nan',
                "s_has_lost_tooth":'nan',
                "s_has_cervical_abrasion":'nan',
                "s_abnormal_wisdom_tooth":'nan',
                "s_tartar_status":'1.0',
                "s_open_date_of_data":'20181126',
                "s_age":'35',
                "s_birthday":'1985-05-10',
                "s_bmi":'31.2',
                "s_name":'심상주',
                "s_phone":'010-8631-2610',
                "s_location_name":'경상북도',
                "s_data_generation_hospital":'분당서울대병원',
                "s_registering_to_data_deal_market_site":'가입',
                "s_agree_to_alarm":'동의'
        }
    });
    console.log(response);
});
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
