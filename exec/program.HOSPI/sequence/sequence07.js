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

			    promises.push(utils.api.call({
			    	url: '/api/demande/'+utils.env.id_demande,
			    	method: 'put',
			    	form: {
			    		f_produit_quote: utils.sessionData.nom_propal,
			    		f_montant_quotation: utils.sessionData.montant_propal
			    	}
			    }));

			    promises.push(utils.api.call({
			    	url: `/api/demande/set_status/${utils.env.id_demande}/s_statut/3`
			    }));

			    Promise.all(promises)
			    	.then(_ => {
			    		console.log("Sequence resolving");
			    		resolve();
			    	})
			    	.catch(error => {
			    		console.log("Sequence rejecting error");
			    		console.error(error);
			    		reject(error);
			    	})
			}).catch(reject);
		});
	}
};