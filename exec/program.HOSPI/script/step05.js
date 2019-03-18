$("#check_propal_0_0").click();
// location.href=$("#propal_0_0").find("a").attr("href");
setTimeout( function() { $("#valid_propal").click(); }, 5000);
function cleanText(text) {
	return text.replace(/[\n\t]/g, '').trim();
}
scriptFinish({nom_propal: cleanText($("#propal_0_0").find('.nom_propal').text()), montant_propal: cleanText($("#mttPropal_propal_0_0").text())});
