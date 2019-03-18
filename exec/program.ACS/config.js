[
	{
		"step":1,
		"start_url": "https://extranet.apivia-courtage.fr/?marque_blanche=",
		"method": "GET",
		"type": "script",
		"snippet": "script/step01.js"
	},
	{
		"step":2,
		"start_url": "https://extranet.apivia-courtage.fr/index_admin.php",
		"method": "GET",
		"type": "script",
		"snippet": "script/step02.js"
	},
	{
		"step":3,
		"start_url": "https://extranet.apivia-courtage.fr/modules/tarif_acs/detail_dossier.php",
		"method": "GET",
		"type": "script",
		"snippet": "script/step03.js"
	},
	{
		"step":4,
		"start_url": "https://extranet.apivia-courtage.fr/modules/tarif_acs/detail_dossier.php",
		"method": "POST",
		"type": "script",
		"snippet": "script/step04.js",
		"downloadFiles": [{"url": "https://extranet.apivia-courtage.fr/readfile.php?mode=view&filetype=pdf&category=biblio&filename=presta/ACSCM.pdf", "name": "garanties.pdf"}]
	},
	{
		"step":5,
		"start_url": "https://extranet.apivia-courtage.fr/readfile.php?mode=view&filetype=pdf&category=biblio&filename=presta/ACSCM.pdf",
		"method": "GET",
		"type": "script",
		"snippet": "script/disconnect.js"
	},
	{
		"step":6,
		"start_url": "https://extranet.apivia-courtage.fr/",
		"method": "GET",
		"type": "sequence",
		"snippet": "sequence/sequence05.js"
	}
]