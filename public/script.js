$(function(){
	
	$('.menu-btn').on('click', function(){
		$('.gnb').show();
	});
	$('.gnb-close').on('click', function(){
		$('.gnb').hide();
	});
	
	$('.gnb-close').on('each', function(){
		$('.breadcrumb ul li').index();
	});
	
});