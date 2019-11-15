var express = require('express');
var router = express.Router();
var mysqlConnection = require('../server');
var conn = mysqlConnection.conn;
var paginate = require('express-paginate');
var app = express();
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
                select @rownum:=@rownum+1 as num, \
                      a.com_email,\
                      b.com_nm, \
                      case when date_format(a.request_dt,"%y%m%d")=date_format(now(),"%y%m%d") then date_format(a.request_dt, "%h:%i") \
                           else date_format(a.request_dt,"%y%m%d") end as request_dt,\
                      a.request_dt as create_dt,\
                      a.request_purpose,\
                      count(*) over() cnt \
                 from user_requests a, com_info b,\
                      (select @rownum:=0) tmp\
                where 1=1\
                  and a.p_code = ?\
                  and a.com_email = b.com_email\
                order by a.request_dt) main\
                order by create_dt desc\
                limit '+ (req.query.page-1)*req.query.limit+','+req.query.limit ;
    
    conn.query(sql, [req.session.uid],function(err, result){
        if(err) {
            console.error(err); 
            return false;
        }else if(!result[0]){
            res.send('<script>alert("데이터가 존재하지 않습니다."); location.href="/user/acceptRequest"; </script>');
        }
        else{
            var pageCount = Math.ceil(result[0].cnt / req.query.limit);
            var pages = paginate.getArrayPages(req)( 4 , pageCount, req.query.page);

            res.render('user/acceptRequest.ejs', 
                {   requestdetail : result,
                    pages : pages,
                    pageCount : pageCount});
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
            if(!result[0]) res.send('<script>alert("아이디가 존재하지 않습니다. id를 확인하세요."); location.href="/user/login"; </script>');

            else if(radio=='person'){   //개인회원의 경우
                if(pw===result[0].p_phone){
                    req.session.uid = result[0].p_code;
                    res.send('<script>alert("로그인 성공!"); location.href="/user/acceptRequest"; </script>');
                }else res.send('<script>alert("아이디와 비밀번호가 일치하지 않습니다."); location.href="/user/login"; </script>');
            }else if(radio=='company'){ //기업회원의 경우
                if(pw===result[0].com_pw){
                    req.session.comEmail = result[0].com_email;
                    app.locals.isLogin = true;
                    // req.session.comNm = result[0].com_nm;
                    res.send('<script>alert("로그인 성공!"); location.href="/company/requestData"; </script>');
                }else res.send('<script>alert("아이디와 비밀번호가 일치하지 않습니다."); location.href="/user/login"; </script>');
            }
        }
    });
});

module.exports = router;