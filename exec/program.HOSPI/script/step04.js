// setTimeout( function () { var id = $(".questionsPersCtn").attr('id'); nextQuestion(100, 228, id, 2);  setTimeout( function () { $("#valid_quest").click(); }, 2000); }, 4000);
setTimeout(_ => {
	console.log($("a.plus"));
	$("a.plus").click();
	setTimeout(_ => {
		$("#valid_quest").click();
	}, 2000);
}, 1000);
