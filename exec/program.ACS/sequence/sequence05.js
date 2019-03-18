let fs = require('fs-extra');

module.exports = {
	execute: (utils) => {
		return new Promise((resolve, reject) => {
			utils.waitDownloads().then(downloads => {
			    let promises = [];
			    for (let i = 0; i < downloads.done.length; i++) {
			        promises.push(utils.api.upload({
			            url: '/api/demande/'+utils.env.id_demande+'/upload',
			            method: 'post',
			            stream: fs.createReadStream('./exec/program/download/'+downloads.done[i].name)
			        }));
			    }
			    console.log("UPDATING FROM SEQUENCE");
				console.log({
					f_montant_quotation: parseInt(utils.sessionData.montant),
					f_produit_quote: utils.sessionData.produit
				});
			    promises.push(utils.api.call({
			    	url: '/api/demande/'+utils.env.id_demande,
			    	method: 'put',
			    	form: {
			    		f_montant_quotation: parseInt(utils.sessionData.montant),
			    		f_produit_quote: utils.sessionData.produit
			    	}
			    }))

			    promises.push(utils.api.call({
			    	url: `/api/demande/set_status/${utils.env.id_demande}/s_statut/3`
			    }));

			    Promise.all(promises)
			    	.then(resolve)
			    	.catch(reject)
			});
		});
	}
};