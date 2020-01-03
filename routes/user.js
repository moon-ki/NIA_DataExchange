var express = require('express');
var router = express.Router();
var mysqlConnection = require('../server');
var conn = mysqlConnection.conn;
var paginate = require('express-paginate');
var app = express();
var async = require('async');
// router.get('/', function(req, res){
//     // session을 체크하여 로그인 여부 확인
//     // req.session.id으로 로그인 여부 확인 불가, 로그인 여부확인하는 로직 개발 필요
//     if(!req.session.id) 
//         res.redirect('/login');
//     else 
//         res.redirect('/acceptRequest');
//     // res.render('login.ejs');
// });
router.get('/login',function(req,res){
    if(req.session.id) 
        res.render('loginReg.ejs');
    else 
        res.render('home.ejs');

});
router.get('/logout',function(req,res){
    app.locals.isLogin = false;
    req.session.destroy(function(err){
        res.render('loginReg.ejs');
    });
});

// 요청현황 화면 조회
router.get('/acceptRequest', paginate.middleware(10, 100), function(req,res){
    var sql = 'select * from(\
                select @rownum:=@rownum+1 as num, main.* \
                from(\
                    select \
                        case when a.param_sex = "1" then "Male" \
                             when a.param_sex = "2" then "Female" \
                             else "-"  end as param_sex,\
                        a.com_email,\
                        b.com_nm, \
                        date_format(a.request_dt, "%y.%m.%d %H:%i") as request_dt,\
                        a.request_dt as create_dt,\
                        a.request_purpose,\
                        a.deadline,\
                        if(a.reward_desc ="", "-", a.reward_desc) as reward_desc,\
                        format(a.require_cnt,0)  require_cnt,\
                        format(a.request_cnt,0)  request_cnt,\
                        if(a.param_ageFrom="ageFrom","-",a.param_ageFrom) as param_ageFrom,\
                        if(a.param_bmiFrom="bmiFrom","-",a.param_bmiFrom) as param_bmiFrom,\
                        if(a.param_systoleFrom="systoleFrom","-",a.param_systoleFrom) as param_systoleFrom,\
                        if(a.param_relaxFrom="relaxFrom","-",a.param_relaxFrom) as param_relaxFrom,\
                        if(a.param_astFrom="astFrom","-",a.param_astFrom) as param_astFrom,\
                        if(a.param_altFrom="altFrom","-",a.param_altFrom) as param_altFrom,\
                        case when a.finish_yn = "P" and date_format(a.deadline,"%y%m%d") >= date_format(now(),"%y%m%d") then "P"\
                             when a.finish_yn = "P" and date_format(a.deadline,"%y%m%d") <  date_format(now(),"%y%m%d") then "F"\
                             else a.finish_yn end finish_yn, \
                        a.participation_yn\
                        from user_requests a, com_info b\
                    where 1=1\
                        and a.com_email = b.com_email\
                        and a.p_code = ?\
                        order by a.request_dt  ) main, (select @rownum:=0) tmp\
                )result\
                order by num desc\
                limit '+ (req.query.page-1)*req.query.limit+','+req.query.limit ;
    
    conn.query(sql, [req.session.uid],function(err, result){
        if(err) {
            console.error(err); 
            return false;
        }else if(!result[0]){
            res.send('<script>alert("Data does not exist."); location.href="/user/acceptRequest"; </script>');
        }
        else{
            var pageCount;
            var pages;
            async.waterfall([
                function(callbak){
                    if(result[0]){
                            conn.query('select count(*) cnt\
                                        from user_requests  \
                                        where p_code = ?', [req.session.uid], function(err,result){
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
                    res.render('user/acceptRequest.ejs',{
                        requestdetail : result,
                        pages : pages,
                        pageCount : pageCount,
                        userNm: req.session.uNm
                    });
                }
            ]);
        }
    });
});

//로그인 프로세스
router.post('/loginReg',function(req,res){
    var id = req.body.uid;
    var pw = req.body.upw;
    var radio = req.body.selectwho;
    var sql = '';

    //회원에 따른 sql 분기처리
    if(radio=="person"){            //개인회원 로그인
        sql = 'select * from user_phr_sample where p_code = ?';
    }else if(radio=="company"){     //기업회원 로그인
        sql = 'select * from com_info where com_email = ?';
    }

    conn.query(sql, [id], function(err,result){
        if(err) console.error(err);
        else{   //아이디가 존재하지 않는 경우
            if(result=='') {
                res.send('<script id="sc1" type="test/javascript">alert("USER NAME does not exist! Please check USER NAME."); location.href="/user/login"; </script>');
            }else if(radio=='person'){   //개인회원의 경우
                if(pw===result[0].p_phone){
                    req.session.uid = result[0].p_code;
                    req.session.uNm = result[0].p_name;
                    res.send('<script id="sc1" type="test/javascript">alert("Login Success!"); location.href="/user/acceptRequest"; </script>');

                }else res.send('<script id="sc1" type="test/javascript">alert("USER NAME and Password do not match"); location.href="/user/login"; </script>');
            }else if(radio=='company'){ //기업회원의 경우
                if(pw===result[0].com_pw){
                    req.session.comEmail = result[0].com_email;
                    req.session.userNm = result[0].user_nm;
                    req.session.apiUrl = result[0].com_api_url;
                    req.session.comNm = result[0].com_nm; 
                    app.locals.isLogin = true;
                    // res.send('<script>alert("로그인 성공!"); location.href="/company/requestData"; </script>');
                    res.send('<script id="sc1" type="text/javascript"> \
                            alert("Login Success!"); \
                            location.href="/company/requestData";\
                            </script>')
                }else res.send('<script id="sc1" type="test/javascript">alert("USER NAME and Password do not match"); location.href="/user/login"; </script>');
            }
        }
    });
});

//사용자 상세 페이지
router.get('/acceptRequestDetail/:num/:sex/:ageFrom/:bmiFrom/:systoleFrom/:relaxFrom/:astFrom/:altFrom/:rewardDesc/:purpose/:finishYn/:deadLine/:requestCnt/:requireCnt/:requestDt/:participationYn', function(req,res){
    var searchParams = {
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
        finishYn:req.params.finishYn,
        requestDt: req.params.requestDt,
        deadLine:req.params.deadLine,
        requestCnt:req.params.requestCnt,
        requireCnt:req.params.requireCnt,
        participationYn:req.params.participationYn
    };
    res.render('./user/acceptRequest_detail',{requestdetail:searchParams});
});


module.exports = router;