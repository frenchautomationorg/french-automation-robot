var produit = $("#container_tarif table td:eq(2)").text();
var montant = $("#container_tarif table td:eq(3)").text();
location.href="https://extranet.apivia-courtage.fr/readfile.php?mode=view&filetype=pdf&category=biblio&filename=presta/ACSCM.pdf";
scriptFinish({produit, montant});