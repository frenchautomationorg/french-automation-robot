if ("{ENV|F_CIVILITE}" == "M") { $("#civilite_MR").click(); }
if ("{ENV|F_CIVILITE}" == "MLLE") { $("#civilite_MLE").click(); }
if ("{ENV|F_CIVILITE}" == "MME") { $("#civilite_MME").click(); }
$("#nom").val("{ENV|F_NOM}");
$("#prenom").val("{ENV|F_PRENOM}");
$("#email").val("{ENV|F_EMAIL}");
var month = parseInt("{ENV|F_MOIS_NAISSANCE}")-1;
$("#dateNaissance_dateselector-day").val("{ENV|F_JOUR_NAISSANCE}");$("#dateNaissance_dateselector-day").change();
$("#dateNaissance_dateselector-month").val(month);$("#dateNaissance_dateselector-month").change();
$("#dateNaissance_dateselector-year").val("{ENV|F_ANNEE_NAISSANCE}");$("#dateNaissance_dateselector-year").change();
$("#email").val("{ENV|F_EMAIL}");

var phone = "{ENV|F_TELEPHONE}";
phone = phone.split(' ').join('').trim();
if (phone != "") { if ((phone.substring(0, 2) == "01") || (phone.substring(0, 2) == "02") || (phone.substring(0, 2) == "03") ||	(phone.substring(0, 2) == "04") || (phone.substring(0, 2) == "05") || (phone.substring(0, 2) == "09")) { $("#telFixe").val(phone); }}
if (phone != "") { if ((phone.substring(0, 2) == "06") || (phone.substring(0, 2) == "07") || (phone.substring(0, 2) == "08")) {	$("#telPort").val(phone); }}
$("#codePostal").val("{ENV|F_CP}");$("#codePostal").change();
$("#dateEntree_dateselector-day").val(1);
var DateMonth = new Date().getMonth(); if (DateMonth == 11) { $("#dateEntree_dateselector-month").val(0); $("#dateEntree_dateselector-year").val(new Date().getYear()+1); } else { $("#dateEntree_dateselector-month").val(DateMonth+1); }
$("#dateEntree_dateselector-day").change();$("#dateEntree_dateselector-month").change();$("#dateEntree_dateselector-year").change();
setTimeout( function () { $("#valid_compo").click(); }, 2000);