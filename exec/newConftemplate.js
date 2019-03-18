{
	loginStep: 'login',
	logoutStep: 'logout',
	firstStep: 'login',
	steps: {
		login: {
			type: 'script',
			startWith: {
				url: 'https://extranet.apivia-courtage.fr/?marque_blanche='
				method: 'GET'
			},
			snippet: 'script/step01.js',
			endType: 'url',
			endWith: {
				url: 'https://extranet.apivia-courtage.fr/index_admin.php',
				method: 'GET'
			},
			next: 'userDataForm'
		},
		userDataForm: {
			type: 'script',
			startWith: {
				url: "https://extranet.apivia-courtage.fr/modules/tarif_acs/detail_dossier.php",
				method: 'GET'
			},
			snippet: 'script/step03.js',
			endType: 'url',
			endWith: {
				url: 'https://extranet.apivia-courtage.fr/modules/tarif_acs/detail_dossier.php',
				method: 'POST'
			},
			next: 'extractData'
		},
		extractData: {
			type: 'script',
			snippet: 'script/step04.js',
			downloads: [{
				"url": "https://extranet.apivia-courtage.fr/readfile.php?mode=view&filetype=pdf&category=biblio&filename=presta/ACSCM.pdf",
				"name": "garanties.pdf"
			}],
			timeout: 150000,
			endType: 'script',
			next: 'updateDemande'
		},
		updateDemande: {
			type: 'sequence',
			snippet: 'sequence/sequence05.js',
			next: 'logout'
		},
		logout: {
			type: 'script',
			snippet: 'script/disconnect.js',
			endType: 'url',
			endWith: {
				url: "https://extranet.apivia-courtage.fr/",
				method: "GET"
			}
		}
	}
}