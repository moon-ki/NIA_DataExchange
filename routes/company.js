var express = require('express');
var router = express.Router();
var request = require('request');
var paginate = require('express-paginate');
var async = require('async');
var server = require('../server');
var conn = server.conn;
var asyncEachSeries = require('async-each-series');
var logger = server.logger;

// Array를 분할
Array.prototype.division = function (n) {
    var arr = this;
    var len = arr.length;
    var cnt = Math.floor(len / n) + (Math.floor(len % n) > 0 ? 1 : 0);
    var tmp = [];
    for (var i = 0; i < cnt; i++) {
        tmp.push(arr.splice(0, n));
    }
    return tmp;
}

router.post('/register',function(req,res){
    var email = req.body.email;
    var comName = req.body.comName;
    var comNumber = req.body.comNumber;
    var password = req.body.cpw;
    var sql = 'insert into com_info (com_email, com_nm, com_num, com_pw) \
               values(?,?,?,?)';
    conn.query(sql, [email, comName, comNumber, password], function(err, result){
        if(err) {
            console.error(err);
            res.send('<script>alert("이메일이 중복됩니다. 다시 진행 해주세요.");\
                        location.href="/user/login"; </script>');
        }else{
            res.send('<script>alert("정상적으로 가입되었습니다. 로그인하세요.");\
                        location.href="/user/login"; </script>');
        }
    })
});

router.get('/searchPhr',function(req,res){
    conn.query("SELECT\
                        column_name, column_comment\
                    FROM\
                        information_schema.columns\
                    WHERE table_schema = 'NIA_DataExchanger'\
                    and table_name = 'user_phr_sample'\
                    and length(trim(column_comment)) > 0", [],function(err, colInfos){
        if(err) {console.log(colInfos); res.end();}
        else{
            res.render('./company/com_searchPhr.ejs',{colInfos:colInfos, userNm:req.session.userNm});
        }
        
    });
});

// 신청 프로세스
router.post('/searchPhr', function(req,res){
    var Tmp_sex = req.body.sex;                     //성별
    var Tmp_ageFrom = req.body.ageFrom;             //나이 from
    var Tmp_ageTo = req.body.ageTo;                 //나이 to
    // var Tmp_smokingYn = req.body.smokingYn;
    // var Tmp_drinkingYn = req.body.drinkingYn;
    var Tmp_bmiFrom = req.body.bmiFrom;             //bmi from
    var Tmp_bmiTo = req.body.bmiTo;                 //bmi to
    var Tmp_systoleFrom = req.body.systoleFrom;     //수축기혈압 from
    var Tmp_systoleTo = req.body.systoleTo;         //수축기혈압 to
    var Tmp_relaxFrom = req.body.relaxFrom  ;       //이완기혈압 from
    var Tmp_relaxTo = req.body.relaxTo;             //이완기혈압 to
    var Tmp_astFrom = req.body.astFrom;             //ast from
    var Tmp_astTo = req.body.astTo;                 //ast to
    var Tmp_altFrom = req.body.altFrom;             //alt from
    var Tmp_altTo = req.body.altTo;                 //alt to
    var requestPurpose = req.body.requestPurpose;   //활용목적
    var deadLine = req.body.deadLine;               //마감기간
    var requireCnt = req.body.requireCnt;           //필요PHR 건수
    var rewardDesc = req.body.rewardDesc;           //보상상세

    // 다이나믹 쿼리 생성을 위한 조회 파라미터 셋팅
    var params_of_filter=[Tmp_sex, Tmp_ageFrom, Tmp_ageTo, Tmp_bmiFrom, Tmp_bmiTo,
                          Tmp_systoleFrom, Tmp_systoleTo, Tmp_relaxFrom, Tmp_relaxTo, Tmp_astFrom,
                          Tmp_astTo, Tmp_altFrom, Tmp_altTo];

    // 조회 조건에 따라, 동적 쿼리 및 파라미터 생성( 리턴타입: [쿼리, 파라미터] )
    var sqlAndParams = genDynamicQuery(params_of_filter);

    // 요청목적, 마감일자, 보상상세 데이터를 파라미터에 추가
    // 보상 상세데이터의 개행문자를 <br>로 변환: 개행문자가 있으면 팝업을 호출하는 스크립트에서 syntax 오류를 일으킴
    sqlAndParams[1].push(requestPurpose, deadLine, rewardDesc.replace(/(?:\r\n|\r|\n)/g, '<br>'), requireCnt);

    var cntSQL = conn.query('select p_code \
                               from user_phr_sample \
                              where 1=1 and join_yn = "Y" and alert_yn = "Y" '+sqlAndParams[0], sqlAndParams[1], 
        function(err, pCodes){

            if(err) console.error(err);
            else{
                // 조회 데이터가 없을 경우
                if(pCodes==""||pCodes.length==0) {
                    res.send('<script>alert("결과가 존재하지 않습니다. 다시 검색하세요."); \
                                location.href="/company/searchPhr"; </script>');
                // 목표 건수보다, 조회 건수가 적을 경우
                }else if( pCodes.length < requireCnt ){
                    res.send('<script>alert("목표 PHR건수 보다 조회된 레코드가 적습니다."); \
                                location.href="/company/searchPhr"; </script>');
                }else{
                    // com_requests 인서트 쿼리
                    var sql = 'insert into com_requests(\
                                    com_email,request_cnt,dynamic_sql,\
                                    param_sex, param_ageFrom, param_ageTo, param_bmiFrom, param_bmiTo,\
                                    param_systoleFrom, param_systoleTo, param_relaxFrom, param_relaxTo, param_astFrom,\
                                    param_astTo, param_altFrom, param_altTo, request_purpose, deadline, \
                                    reward_desc, require_cnt) \
                               values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)' ;
                    
                    // com_requests 인서트 파라미터 셋팅
                    var insertParams = [req.session.comEmail, pCodes.length, sqlAndParams[0]];
                    for(var i=0;i<sqlAndParams[1].length;i++){
                        insertParams.push(sqlAndParams[1][i]);
                    }
                    // com_requests 인서트 실행
                    var insertSQL = conn.query(sql, insertParams,function(err,insertResult){
                        if(!err){
                            conn.query('select seq from com_requests order by seq desc limit 1',[],function(err, comSeq){
                                async.waterfall([
                                    function(callback){
                                        // 로그 기록
                                        logger.info(comSeq[0].seq, {messageDetail:'[SEARCH] Finished saving PHR queries and details (Total count: '+pCodes.length+', Target count: '+requireCnt+')'});
                                        callback(null, comSeq[0].seq, pCodes);
                                    },
                                    // user_requests 인서트 파라미터 셋팅
                                    function(com_seq, pCodes,callback){
                                        var userRequestInsertParam=[]
                                        async.each(pCodes, function(pCode){
                                            userRequestInsertParam.push([com_seq, req.session.comEmail, requestPurpose, pCode.p_code])
                                        });
                                        callback(null, userRequestInsertParam);
                                        
                                    },
                                    // user_requests 인서트
                                    function(userRequestInsertParam, callback){
                                        conn.query('insert into user_requests (com_seq, com_email, request_purpose, p_code) values ? ', [userRequestInsertParam], function(err,Re){
                                            if(err) console.error(err);
                                            else callback(null)
                                        });
                                    },
                                    function(){
                                        res.redirect('/company/requestData');
                                    }
                                ]);
                            });
                        }else console.error(err);
                    });}
        }
    });
});

// 요청현황 화면 조회
router.get('/requestData', paginate.middleware(10, 100), function(req,res){
    // tmp_gj_2017 은 임시테이블로, phr데이터의 필터링에 쓰인다.
    var sql = 
    ' select main.* from (\
        select    @rownum:=@rownum+1 as num, \
                req.seq,\
                req.com_email,\
                req.request_purpose,\
                format(req.request_cnt,0) request_cnt,\
                format(req.require_cnt,0) require_cnt,\
                ifnull(format(req.response_cnt,0),0) response_cnt,\
                truncate( ( ifnull(req.response_cnt,0.00001) / req.require_cnt) * 100, 0 ) ratio,\
                req.request_dt,\
                \
                case when req.param_sex = "1" then "Male" \
                        when req.param_sex = "2" then "Female" \
                        else "-"  end as param_sex,\
                req.param_sex as sex, \
                \
                if(req.param_ageFrom="ageFrom","-",req.param_ageFrom) as param_ageFrom, \
                req.param_ageFrom as ageFrom,\
                if(req.param_ageTo="ageTo","-",req.param_ageTo) as param_ageTo, \
                req.param_ageTo as ageTo,\
                \
                if(req.param_bmiFrom="bmiFrom","-",req.param_bmiFrom) as param_bmiFrom, \
                req.param_bmiFrom as bmiFrom,\
                if(req.param_bmiTo="bmiTo","-",req.param_bmiTo) as param_bmiTo, \
                req.param_bmiTo as bmiTo,\
                \
                if(req.param_systoleFrom="systoleFrom","-",req.param_systoleFrom) as param_systoleFrom, \
                req.param_systoleFrom as systoleFrom,\
                if(req.param_systoleTo="systoleTo","-",req.param_systoleTo) as param_systoleTo, \
                req.param_systoleTo as systoleTo,\
                \
                if(req.param_relaxFrom="relaxFrom","-",req.param_relaxFrom) as param_relaxFrom, \
                req.param_relaxFrom as relaxFrom,\
                if(req.param_relaxTo="relaxTo","-",req.param_relaxTo) as param_relaxTo, \
                req.param_relaxTo as relaxTo,\
                \
                if(req.param_astFrom="astFrom","-",req.param_astFrom) as param_astFrom, \
                req.param_astFrom as astFrom,\
                if(req.param_astTo="astTo","-",req.param_astTo) as param_astTo, \
                req.param_astTo as astTo,\
                \
                if(req.param_altFrom="altFrom","-",req.param_altFrom) as param_altFrom, \
                req.param_altFrom as altFrom,\
                if(req.param_altTo="altTo","-",req.param_altTo) as param_altTo, \
                req.param_altTo as altTo,\
                \
                date_format(req.request_dt,"%y.%m.%d") create_dt,\
                date_format(req.request_dt, "%H:%i")   create_time,\
                req.dynamic_sql,\
                req.deadline, \
                case when trim(req.reward_desc) is null or trim(req.reward_desc) ="" then "-" \
                     else req.reward_desc end as reward_desc,\
                concat(CHUNG_yn, SEOUL_yn, CHAR_yn) as done_yn,\
                case when req.request_yn = "N" then "N"\
                     when req.request_yn = "R" then "R"\
                     when req.request_yn = "P" and date_format(req.deadline,"%y%m%d") >= date_format(now(),"%y%m%d")  and concat(CHUNG_yn, SEOUL_yn, CHAR_yn) != "YYY" then "P"\
                     when req.request_yn = "P" and date_format(req.deadline,"%y%m%d") < date_format(now(),"%y%m%d") and concat(CHUNG_yn, SEOUL_yn, CHAR_yn) != "YYY" then "F"\
                     when concat(CHUNG_yn, SEOUL_yn, CHAR_yn) = "YYY" then "Y" end request_yn\
                \
        from    com_requests req, \
                com_info b, (select @rownum:=0) tmp\
                \
        where   1=1\
          and   req.com_email = b.com_email\
          and   req.com_email = ?\
        order by req.request_dt\
        ) main\
    order by main.request_dt desc\
    limit '+ (req.query.page-1)*req.query.limit+','+req.query.limit ;

    var resultSql = conn.query(sql, req.session.comEmail, function(err,requestdetail){

        if(err) console.error(err);
                // totalCnt = 0;
        else{
            var pageCount;
            var pages;
            // console.log('requestdetail[2].require_cnt: '+requestdetail[2].require_cnt);
            // console.log('requestdetail[2].response_cnt: '+requestdetail[2].response_cnt);
            // console.log('requestdetail[2].ratio: '+requestdetail[2].ratio);
            async.waterfall([
                function(callbak){
                    if(requestdetail[0]){
                            conn.query('select count(*) cnt\
                                        from com_requests req \
                                        where req.com_email= ?', req.session.comEmail, function(err,result){
                                pageCount = Math.ceil(result[0].cnt / req.query.limit);
                                pages = paginate.getArrayPages(req)( 4 , pageCount, req.query.page);
                                callbak(null, pageCount, pages);
                            });
                    }else{
                        pageCount=1
                        pages=[{number:1, url:''}]
                        callbak(null, pageCount, pages);
                    }
                },
                function(pageCount, pages, callback){
                    res.render('./company/com_request_detail',{
                        requestdetail : requestdetail,
                        pages : pages,
                        pageCount : pageCount,
                        userNm : req.session.userNm
                    });
                }
            ]);
        }
    });
});

//phr 사용승인 신청 프로세스
router.post('/requestPhr', async(req,res)=>{
    //조회 파라미터 초기화
    var dynamicSql = req.body.dynamicSql;
    var com_seq = req.body.seq;
    var requestYn = req.body.requestYn;

    //병원 별, API Request 실핻
    var hospitals = ['CHUNG','CHAR','SEOUL'];
    async.waterfall([
        function(callback){
            conn.query('update com_requests set request_yn = "P" where seq = ?', com_seq, function(err, res){
                if(!err) callback(null);
            });
        },
        function(callback){
            // 최초 요청 시
            if(requestYn=='N'){
                logger.info(com_seq, {messageDetail: '[START] Start PHR Request'});
                // 병원 별, API요청할 사용자 select!
                var sql_SELECT = 'select a.p_code\
                                    from user_phr_sample a \
                                    where 1=1 \
                                        and join_yn = "Y" and alert_yn="Y"'+dynamicSql+'and p_hospital=? ' ;

            // 재 요청 시
            }else if(requestYn=='R'){
                logger.info(com_seq, {messageDetail: '[RESTART] Restart PHR Request'});
                // 병원 별, API요청할 사용자 select!
                var sql_SELECT = 'select p_code\
                                    from err_comseq_pcode \
                                    where com_seq = ? and p_hospital = ?'; 
            }

            asyncEachSeries(hospitals, function(hospital, next){
                var sql_SELECT_Params = [req.body.sex, req.body.ageFrom, req.body.ageTo, req.body.bmiFrom, req.body.bmiTo, 
                    req.body.systoleFrom, req.body.systoleTo, req.body.relaxFrom, req.body.relaxTo, req.body.astFrom,
                    req.body.astTo, req.body.altFrom, req.body.altTo];
    
                // console.log(hospital, com_seq)
                // pcodes 조회!
                selPcodes(sql_SELECT, sql_SELECT_Params, hospital, requestYn, com_seq, function(successYn, pCodes){
                    if(successYn){
                        // var seperPcode=[];
                        // seperPcode = pCodes.division(20);
//**********************************************************************************************************PHR 처리 전체 프로세스
                        PhrProcess(pCodes, com_seq, hospital, req.session.apiUrl);
//*******************************************************************************************************************************
                    }//selPcodes if(successYn){
                });//selPcodes end
                next();
            });     

            callback(null);
        },// async.each end
        function(callback){
            res.send('<script id="sc1" type="text/javascript"> \
                        alert("PHR을 신청했습니다."); \
                        location.href="/company/requestData";\
                    </script>')
        }
    ]);

    // 재요청 시



}); // router.post('/requestPhr' END

//기업 상세 페이지 출력
router.get('/requestDataDetail/:seq/:num/:sex/:ageFrom/:bmiFrom/:systoleFrom/:relaxFrom/:astFrom/:altFrom/:rewardDesc/:purpose/:requestYn/:requestDt/:deadLine/:requestCnt/:requireCnt/:responseCnt/:ratio/:createTime', function(req,res){
    var searchParams = {
        seq:req.params.seq,
        num:req.params.num,
        sex: req.params.sex, 
        ageFrom: req.params.ageFrom, 
        bmiFrom: req.params.bmiFrom, 
        systoleFrom: req.params.systoleFrom,
        relaxFrom: req.params.relaxFrom,
        astFrom: req.params.astFrom,
        altFrom: req.params.altFrom,
        rewardDesc: req.params.rewardDesc.replace(/(<br>|<br\/>|<br \/>)/g, '\r\n'),
        purpose:req.params.purpose,
        requestYn:req.params.requestYn,
        requestDt: req.params.requestDt,
        deadLine:req.params.deadLine,
        requestCnt:req.params.requestCnt,
        requireCnt:req.params.requireCnt,
        responseCnt:req.params.responseCnt,
        ratio:req.params.ratio,
        createTime: req.params.createTime
    };

    conn.query('select message,\
                       replace(replace(replace(meta,"CHAR", "분당차병원"),"SEOUL", "분당서울대병원"),"CHUNG", "충남대병원")  meta,\
                       date_format(timestamp, "%y.%m.%d %H:%i") create_dt \
                  from sys_logs_default\
                 where message = ? \
                 order by timestamp desc', [req.params.seq],
        function(err, logs){
            if(err) console.log(err);
            else{
                var logDetails=[]
                var logTmp;
                async.each(logs, function(log){
                    logTmp = JSON.parse(log.meta);
                    logTmp.create_dt = log.create_dt;
                    logTmp.num = req.params.seq;
                    logDetails.push(logTmp);
                });

                res.render('./company/com_request_detail2',{
                    requestdetail:searchParams,
                    logDetails:logDetails,
                    userNm:req.session.userNm
                });
                
            }
        }
    );
});
// 
router.post('/updateDeadline',function(req,res){

    // console.log(req.body.seq);
    // console.log(req.body.deadLine);

    conn.query('update com_requests set request_yn = "R", CHUNG_yn = "N", SEOUL_yn="N", CHAR_yn="N", deadline= ? \
                where seq = ?', [req.body.deadLine, req.body.seq], function(err, result){});

    res.send('<script id="sc1" type="text/javascript"> \
                alert("마감일자를 정상적으로 업데이트 하였습니다. 다시 요청해주세요."); \
                location.href="/company/requestData";\
              </script>');
});

// 신청 건수 확인 프로세스
router.post('/cntCheck',function(req,res){
    var Tmp_sex = req.body.sex;                     //성별
    var Tmp_ageFrom = req.body.p_age;             //나이 from
    var Tmp_ageTo = req.body.ageTo;                 //나이 to
    // var Tmp_smokingYn = req.body.smokingYn;
    // var Tmp_drinkingYn = req.body.drinkingYn;
    var Tmp_bmiFrom = req.body.p_bmi;             //bmi from
    var Tmp_bmiTo = req.body.bmiTo;                 //bmi to
    var Tmp_systoleFrom = req.body.systole_bp;     //수축기혈압 from
    var Tmp_systoleTo = req.body.systoleTo;         //수축기혈압 to
    var Tmp_relaxFrom = req.body.relax_bp  ;       //이완기혈압 from
    var Tmp_relaxTo = req.body.relaxTo;             //이완기혈압 to
    var Tmp_astFrom = req.body.ast;             //ast from
    var Tmp_astTo = req.body.astTo;                 //ast to
    var Tmp_altFrom = req.body.alt;             //alt from
    var Tmp_altTo = req.body.altTo;                 //alt to

    // 다이나믹 쿼리 생성을 위한 조회 파라미터 셋팅
    var params_of_filter=[Tmp_sex, Tmp_ageFrom, Tmp_ageTo, Tmp_bmiFrom, Tmp_bmiTo,
                          Tmp_systoleFrom, Tmp_systoleTo, Tmp_relaxFrom, Tmp_relaxTo, Tmp_astFrom,
                          Tmp_astTo, Tmp_altFrom, Tmp_altTo];
    console.log(Tmp_bmiFrom);
    console.log(params_of_filter);

    var sqlAndParams = genDynamicQuery(params_of_filter);

    var sql = conn.query('select count(*) cnt \
                            from user_phr_sample \
                        where 1=1 and join_yn = "Y" and alert_yn = "Y" '+sqlAndParams[0], sqlAndParams[1], 
        function(err,result){
            if(err) console.log(err);
            else res.send('"'+result[0].cnt+'"');
    });
    console.log(sql.sql);
});

//API Call에 필요한 p_codes 조회
function selPcodes(sql_SELECT, sql_SELECT_Params, hospital, requestYn, comSeq, callback){
    var params=[]
    var p_codes = [];
    
    if(requestYn=="R"){
        params.push(comSeq, hospital);
    }else if (requestYn=="N"){
        params=sql_SELECT_Params;
        params.push(hospital);    
    }

    // console.log(sql_SELECT, params);
    var sql = conn.query(sql_SELECT, params, function(err, result){
        if(err) {console.log(err);callback(false, err);}
        else {
            for(var i =0; i<result.length; i++){
                p_codes.push(result[i].p_code);
            }
            callback(true, p_codes);
        }
    });
}

//PHR API Call!! *************************
function callAPI (hospital, p_codes, com_seq, callback){
    if(hospital=='CHUNG')      p_hospital='충남대학교병원';    
    else if(hospital=='CHAR')  p_hospital='분당차병원';
    else if(hospital=='SEOUL') p_hospital='분당서울대학교병원'; 

    request({
        uri:'http://15.164.250.176:3000/data',
        method:'POST',
        enctype: 'multipart/form-data',
        json:{
            hospital : p_hospital,
            userNumbers : [p_codes]
        }
    },function(error, response, result){
        if(result.code==0 && (result.result==''||result.result == null)) {
            callback(false,'Nothing',0);
        }else{//---------------------phr 파싱 처리
            var phrArrayTotal = [];
            for(var j=0; j < result.result.length; j++){
                var phrArrayOne = [];
                
                //---------------------환자 인적사항
                var hospital_pcode = result.result[j].entry[0].id.split('-'); 
                phrArrayOne.push(hospital_pcode[0]);                            //충남대학교병원
                phrArrayOne.push(hospital_pcode[1]);                            //19
                phrArrayOne.push(result.result[j].entry[0].gender);             //female
                phrArrayOne.push(result.result[j].entry[0].address[0].text);    //대전광역시
                phrArrayOne.push(result.result[j].entry[0].telecom[0].value);   //010-5782-9338
                phrArrayOne.push(result.result[j].entry[0].name.text);          //방규연
                phrArrayOne.push(result.result[j].entry[0].birthDate);          //1995-02-26

                //---------------------환자 의료정보
                // Height에서 Drink_yn까지
                for(var i=1 ; i < result.result[j].entry.length ; i++){
                    // console.log(result.result[j].entry[i].code.coding[0].display);  //항목명
                    phrArrayOne.push(result.result[j].entry[i].valueQuantity.value);
                }

                phrArrayOne.push(com_seq);
                phrArrayTotal.push(phrArrayOne);
            }
            // console.log('[LOG] callAPI=End, 병원=%s, seq=%d, request=%d, response=%d', p_hospital, seq, p_codes.length, result.result.length);
            callback(true, phrArrayTotal, result.result.length);
        }
    });
}

function PhrProcess(pCodes, com_seq, hospital, apiUrl){

    // API에서 받은 데이터 인서트 쿼리
    var sql_INSERT_PHR='insert into phr_record_remote(\
        p_hospital,p_code,p_sex,p_location,p_phone,p_name,birth_dt,height,weight,waist_cir\
        ,lefteye,righteye,leftear,rightear,systole_bp,relax_bp,blood_sugar ,cholesterol ,tregleselaid,hdl_col\
        ,ldl_col,blood_color ,feeprotain,kreanin,ast,alt,gamatp,smoke_yn,drink_yn,com_seq) values ?';

    var currentCnt = 0;
    logger.info(com_seq, {messageDetail: '[API Called] Request API Call of PHR Application ', from:hospital});
    asyncEachSeries(pCodes, function(pCode, next){
        setTimeout(function(){
            async.waterfall([
                // 마감기한이 지난 것들에 대해, 따로 저장 함.
                function(callback){
                    conn.query('select case when date_format(now(),"%y%m%d") > date_format(str_to_date(deadline,"%Y-%m-%d"),"%y%m%d" ) then 1\
                                            else 0 end as yn, \
                                        request_cnt \
                                from   com_requests\
                                where  seq = ?', com_seq, 
                        function(err,result){
                            // 마감기한 지남
                            if(result[0].yn==1){
                                conn.query('insert into err_comseq_pcode(com_seq, p_code, p_hospital) values (?,?,?)', [com_seq, pCode, hospital], function(err,result){});
                                next();
                                
                            // 수신가능
                            }else if(result[0].yn==0){
                                callback(null);    
                            }
                    });
                },
// 1. API Call ******************************************************************************************************************
                function(callback){
                    callAPI(hospital, pCode, com_seq, function(successYn, phrArrayTotal, responseCnt ){
                        if(successYn) callback(null, phrArrayTotal, responseCnt);
                        else next(); //데이터가 없는 경우, 다음건 처리
                    });
                },
// 2. phr_record_remote 테이블 인서트 ********************************************************************************************
                // function(phrArrayTotal, responseCnt, callback){
                //     conn.query(sql_INSERT_PHR, [phrArrayTotal], function(err,result){
                //         if (err) console.log(err);
                //         else callback(null, responseCnt);
                //     });
                // },
                function(phrArrayTotal, responseCnt, callback){
                    async.each(phrArrayTotal, function(phr){
                        conn.query('select p_bmi, p_age\
                                      from user_phr_sample where p_code = ? ', phr[1], function (err,result){
                            request({
                                uri: apiUrl,
                                method:'POST',
                                enctype: 'multipart/form-data',
                                json:{
                                    "s_year_of_this_data":'2017',
                                    "s_individual_person_number": phr[1],
                                    "s_sex_code":phr[2].replace('female','2').replace('male','1'),
                                    "s_age_code":'nan',
                                    "s_location_code":'nan',
                                    "s_height":phr[7],
                                    "s_weight":phr[8],
                                    "s_waist_circumference":phr[9],
                                    "s_vision_left":phr[10],
                                    "s_vision_right":phr[11],
                                    "s_hearing_left":phr[12],
                                    "s_hearing_right":phr[13],
                                    "s_systolic_blood_pressure":phr[14],
                                    "s_diastolic_blood_pressure":phr[15],
                                    "s_fasting_glucose":phr[16],
                                    "s_total_cholesterol":phr[17],
                                    "s_triglyceride":phr[18],
                                    "s_hdl_cholesterol":phr[19],
                                    "s_ldl_cholesterol":phr[20],
                                    "s_hemoglobin":phr[21],
                                    "s_urine_protein":phr[22],
                                    "s_creatinine":phr[23],
                                    "s_ast":phr[24],
                                    "s_alt":phr[25],
                                    "s_gamma_gtp":phr[26],
                                    "s_smoke_status":phr[27],
                                    "s_drinking_status":phr[28],
                                    "s_got_oral_examination":'nan',
                                    "s_has_cavity":'nan',
                                    "s_has_lost_tooth":'nan',
                                    "s_has_cervical_abrasion":'nan',
                                    "s_abnormal_wisdom_tooth":'nan',
                                    "s_tartar_status":'nan',
                                    "s_open_date_of_data":'nan',
                                    "s_age":result[0].p_age,
                                    "s_birthday":phr[6] ,
                                    "s_bmi":result[0].p_bmi,
                                    "s_name":phr[5],
                                    "s_phone":phr[4],
                                    "s_location_name":phr[3],
                                    "s_data_generation_hospital":phr[0].replace('분당서울대학교병원','분당서울대병원').replace('충남대학교병원','충남대병원'),
                                    "s_registering_to_data_deal_market_site":'nan',
                                    "s_agree_to_alarm":'nan'
                                }
                            });

                        });
                        callback(null, responseCnt);
                    });
                },
// 3. com_requests.response_cnt 업데이트 *****************************************************************************************
                function(responseCnt, callback){
                    conn.query('update com_requests \
                                set response_cnt = response_cnt + cast(? as unsigned)\
                                where seq = ?', [responseCnt, com_seq], function(err, result){
                        if(err) console.log(err);
                        else callback(null, responseCnt);
                    });
                },
// 4. 목표수량 체크 **************************************************************************************************************
                function(responseCnt){
                    conn.query('select cast(require_cnt as unsigned)  as require_cnt,\
                                       cast(response_cnt as unsigned) as response_cnt\
                                from com_requests where seq = ?', com_seq, function(err,result){
                        currentCnt+=responseCnt
                        if(result[0].require_cnt > result[0].response_cnt+2){
                            next();
                        }else{
                            conn.query('update com_requests set '+hospital+'_yn = "Y" where seq = ?',com_seq, function(){
                                logger.info(com_seq, {messageDetail: '[Data Received] Received '+currentCnt+' of them', from:hospital});
                            });
                        }
                });}
//******************************************************************************************************************************
            ]);}, 3000);
    });
}


function genDynamicQuery(params_of_filter){
    var bmiFrom, bmiTo, systoleFrom, systoleTo, relaxFrom, 
        relaxTo, astFrom, astTo, altFrom, altTo, 
        sex, ageFrom, ageTo, 
        requestPurpose, deadline, rewardDesc, requireCnt;

    // //기업의 phr 조회 시, 필터링 여부에 관계없도록 조회하도록 다이나믹 쿼리 구현
    var dynamicSql='';
    var queryParams = [];
//////////////////////////////////////////////////////////////////////////////////////////
    //성별코드: 1 남자 // 2 여자
    if(!params_of_filter[0]) {      
        dynamicSql+=' and "sex" = ?'; sex='sex'; 
    }else {
        dynamicSql+= ' and sex = ?';  sex=params_of_filter[0];
    }
//////////////////////////////////////////////////////////////////////////////////////////    
    //나이 From
    if(!params_of_filter[1]) {
        dynamicSql+=' and "ageFrom" = ?'; ageFrom='ageFrom';
    }else {
        dynamicSql+= ' and p_age >= cast(? as unsigned)'; ageFrom=params_of_filter[1];
    }
    //나이 To
    if(!params_of_filter[2]) {    
        dynamicSql+=' and "ageTo" = ?'; ageTo='ageTo';
    }else {
        dynamicSql+= ' and p_age <= cast(? as unsigned)' ; ageTo=params_of_filter[2];
    }    
//////////////////////////////////////////////////////////////////////////////////////////
    //bmi
    if(!params_of_filter[3]) {
        dynamicSql+=' and "bmiFrom" = ?'; bmiFrom='bmiFrom';
    }else {
        dynamicSql+= ' and p_bmi >= cast(? as unsigned)' ; bmiFrom=params_of_filter[3];
    }
    if(!params_of_filter[4]) {
        dynamicSql+=' and "bmiTo" = ?';  bmiTo='bmiTo';
    }else {
        dynamicSql+= ' and p_bmi <= cast(? as unsigned)' ; bmiTo=params_of_filter[4];
    }
//////////////////////////////////////////////////////////////////////////////////////////
    //systole 수축기 혈압
    if(!params_of_filter[5]) {
        dynamicSql+=' and "systoleFrom" = ?';  systoleFrom='systoleFrom';
    }else {
        dynamicSql+= ' and systole_bp >= cast(? as unsigned)' ; systoleFrom=params_of_filter[5];
    }
    if(!params_of_filter[6]) {
        dynamicSql+=' and "systoleTo" = ?';  systoleTo='systoleTo';
    }else {
        dynamicSql+= ' and systole_bp <= cast(? as unsigned)' ; systoleTo=params_of_filter[6];
    }
//////////////////////////////////////////////////////////////////////////////////////////
    //relax 이완기 혈압
    if(!params_of_filter[7]) {
        dynamicSql+=' and "relaxFrom" = ?';  relaxFrom='relaxFrom';
    }else {
        dynamicSql+= ' and relax_bp >= cast(? as unsigned)' ; relaxFrom=params_of_filter[7];
    }
    if(!params_of_filter[8]) {
        dynamicSql+=' and "relaxTo" = ?';  relaxTo='relaxTo';
    }else {
        dynamicSql+= ' and relax_bp <= cast(? as unsigned)' ; relaxTo=params_of_filter[8];
    }
//////////////////////////////////////////////////////////////////////////////////////////
    // AST
    if(!params_of_filter[9]) {
        dynamicSql+=' and "astFrom" = ?';  astFrom='astFrom';
    }else {
        dynamicSql+= ' and ast >= cast(? as unsigned)' ; astFrom=params_of_filter[9];
    }
    if(!params_of_filter[10]) {
        dynamicSql+=' and "astTo" = ?';  astTo='astTo';
    }else {
        dynamicSql+= ' and ast <= cast(? as unsigned)' ; astTo=params_of_filter[10];
    }
//////////////////////////////////////////////////////////////////////////////////////////
    // ALT
    if(!params_of_filter[11]) {
        dynamicSql+=' and "altFrom" = ?';  altFrom='altFrom';
    }else {
        dynamicSql+= ' and alt >= cast(? as unsigned)' ; altFrom=params_of_filter[11];
    }
    if(!params_of_filter[12]) {
        dynamicSql+=' and "altTo" = ?';  altTo='altTo';
    }else {
        dynamicSql+= ' and alt <= cast(? as unsigned)' ; altTo=params_of_filter[12];
    }

    // //흡연여부: 1: 피우지 않는다 2: 과거에 피웠으나 지금은 끊었다 3: 현재도 피운다
    // if(!Tmp_smokingYn){ 
    //     dynamicSql+=' and "smokingYn" = ?'; 
    //     smokingYn='smokingYn';
    // }else {
    //     // dynamicSql+= ' and convert(smoke_yn,unsigned) = ?'
    //     dynamicSql+= ' and smoke_yn = ?'
    //     smokingYn=Tmp_smokingYn;
    // }
    // //음주여부: 0: 무 // 1: 유
    // if(!Tmp_drinkingYn){
    //     dynamicSql+=' and "drinkingYn" = ?'; 
    //     drinkingYn='drinkingYn';
    // }else {
    //     // dynamicSql+= ' and convert(drink_yn, unsigned) = ?'
    //     dynamicSql+= ' and drink_yn = ?'
    //     drinkingYn=Tmp_drinkingYn;
    // }
    // /////////////////////////////////////////////////////////////////////

    queryParams.push(sex, ageFrom, ageTo, bmiFrom, bmiTo, 
                    systoleFrom, systoleTo, relaxFrom, relaxTo, astFrom,
                    astTo, altFrom, altTo);
    var result = [dynamicSql, queryParams]
    return result;
}
module.exports = router;