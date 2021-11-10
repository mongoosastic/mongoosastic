import { PluginDocument } from 'types'

export function postSave(doc: PluginDocument): void {

	if (!doc) {
		return
	}

	const options = doc.esOptions()

	const filter = options && options.filter

	function onIndex (err: unknown, res: unknown) {
		if (!filter || !filter(doc)) {
			doc.emit('es-indexed', err, res)
		} else {
			doc.emit('es-filtered', err, res)
		}
	}

	const populate = options && options.populate
	if (doc) {
		if (populate && populate.length) {
			populate.forEach(populateOpts => {
				doc.populate(populateOpts)
			})
			doc.execPopulate().then(popDoc => {
				popDoc.index()
					.then(res => onIndex(null, res))
					.catch(err => onIndex(err, null))
			})
		} else {
			doc.index()
				.then(res => onIndex(null, res))
				.catch(err => onIndex(err, null))
		}
	}
}

export function postRemove(doc: PluginDocument): void {
	
	if (!doc) {
		return
	}
	
	doc.unIndex()
}