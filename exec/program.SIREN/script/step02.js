 var elem = $("label:contains('Activité principale exercée'):eq(0)")
function extractTextNode(element) {
	return element.parent().contents().filter(function() {
	  return this.nodeType == Node.TEXT_NODE;
	}).text().trim().replace(/[\n\r\t]/g, '');
}
var naf = extractTextNode($("label:contains('Activité principale exercée'):eq(0)"));
var siret = extractTextNode($("label:contains('Siret du siège'):eq(0)"));
scriptFinish({naf: naf, siret: siret});