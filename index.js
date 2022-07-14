/*
const localStorage = {
	getItem(id) {
		return this[id]
	},
	setItem(id, dat) {
		this[id] = dat
	},
	removeItem(id) {
		delete this[id]
	}
}
*/

window.fs = (() => {
	const FILE = "_FS_"
	const DATA = "D_"

	let last_id = 0
	const index = []
	const children = {}
	const dataTypes = {}
	const structure = {id:0,children:{}}
	const reset = () => {
		for (const key in localStorage) {
			if (key.slice(0,FILE.length) !== FILE) continue;
			localStorage.removeItem(key)
		}
	}
	const initialize = () => {
		// Find something to check init already state?
		// Get latest id from data
		// Read in files, folders & data
		for (const key in localStorage) {
			if (key.slice(0,FILE.length) !== FILE) continue;
			const id_str = key.slice(FILE.length)
			if (id_str.slice(0, DATA.length) === DATA) {
				// const id = parseInt(id_str.slice(DATA.length))
				// if (id > last_id) last_id = id

			} else {
				const id = parseInt(id_str)
				if (id > last_id) last_id = id
				index[id] = JSON.parse(localStorage.getItem(key))
			}
		}
		const meta_structure = {}
		// for (const id in index) {
		index.forEach(({ parent, name, type }, id) => {
			if (type === "folder")
				meta_structure[id] = meta_structure[id] || {id,children:{}}
			else meta_structure[id] = meta_structure[id] || {id}
			meta_structure[parent] = meta_structure[parent] || {id:parent,children:{}}
			meta_structure[parent].children[name] = meta_structure[id]
		})
		if (meta_structure[0])
			structure.children = meta_structure[0].children
		children[0] = structure.children
		index[0] = {type:'folder',parent:undefined,created:0,modified:0,name:''}
		for (const id in meta_structure) {
			children[id] = meta_structure[id].children
		}
	}


	class Index {
		#id = 0
		constructor(id) {
			this.#id = id
		}
		get contents () {
			return Object.values(children[this.#id])
				.map(({ id }) => {
					const { parent, ...parentRemoved } = index[id]
					return parentRemoved
				})
		}
	}

	const next_id = () => {last_id++;return last_id}
	const split_path = ({ path }) => path.split('/').filter(a=>a)
	const normalise_path = ({ path }) => split_path({ path }).join('/')

	const get_last_parent = ({ path }) => {
		const path_list = split_path({ path })
		let dir = structure
		for (const i in path_list) {
			const name = path_list[i]
			if (!dir.children){
				return {parent:dir.id,remainder:path_list.slice(i).join('/')}
			}
			if (name in dir.children)
				dir = dir.children[name]
			else {
				return {parent:dir.id,remainder:path_list.slice(i).join('/')}
			}
		}
		return {parent:dir.id,remainder:''}
	}

	const register_data_type = ({ name, constructor }) => {
		dataTypes[name] = constructor
	}

	const get_path_exists = ({ path }) => {
		const {parent,remainder} = get_last_parent({ path })
		if (remainder) return false
		const dat = index[parent]
		return dat.type
	}

	const PROT_create_child = ({ parent, name, isLeaf, protocol }) => {
		const childs = children[parent]
		if (name in childs) throw new Error()
		const id = next_id()
		if (isLeaf) {
			childs[name] = {id}
			children[id] = undefined
			const dat = {
				parent, name, created: Date.now(), modified: Date.now(), type: 'file'
			}
			index[id] = dat
			protocol.set(id, dat)
		} else {
			const newChildren = {}
			childs[name] = {id,children:newChildren}
			children[id] = newChildren
			const dat = {
				parent, name, created: Date.now(), modified: Date.now(), type: 'folder'
			}
			index[id] = dat
			protocol.set(id, dat)
		}

		return id
	}
	const PROT_create_path = ({ path, isLeaf, protocol }) => {
		const { parent, remainder } = get_last_parent({ path })
		return split_path({ path: remainder })
		.reduce((par, name, i, list) =>
			PROT_create_child({ parent: par, name, isLeaf: isLeaf && i===list.length-1, protocol }),
			parent)
	}

	const PROT_save_data_to_path = ({ path, data, type, protocol }) => {
		const {parent,remainder} = get_last_parent({ path })
		const id = remainder ? PROT_create_path({ path, isLeaf: Boolean(data), protocol }) : parent
		if (data) {
			const dat = index[id]
			if (dat.type === 'folder')
				throw new Error(`Cannot save data to a folder`)
			if (type) {
				if (!dataTypes[type])
					throw new Error(`Data type '${type}' is not registered`)
				dat.type = type
			} else {
				dat.type = 'file'
			}
			dat.modified = Date.now()
			protocol.setData(id, dat, data)
		}
	}

	const PROT_get_data_from_path = ({ path, protocol }) => {
		// if path is not leaf, return an index object as data
		const {parent,remainder} = get_last_parent({ path })
		if (remainder) throw new Error(`This path does not exist`)
		const dat = index[parent]
		if (dat.type === 'folder') {
			return new Index(parent)
		} else {
			if ((protocol.name === 'all' && !protocols.any.hasData(parent)) || (protocol.name !== 'all' && !protocol.hasData(parent)))
				return;
			const parsed = protocol.get(parent)
			if (dat.type === 'file')
				return parsed
			else if (!dataTypes[dat.type])
				throw new Error(`Data type '${dat.type}' is not registered`)
			if (protocol.name === 'all') {
				return Object.fromEntries(Object.entries(parsed).map(([ protocol, result ]) =>
					[ protocol, dataTypes[dat.type](result) ]))
			}
			return dataTypes[dat.type](parsed)
		}
	}

	const PROT_delete_id = ({ id, protocol }) => {
		const dat = index[id]
		if (dat.type === 'folder') {
			Object.values(children[id]).forEach(delete_id)
		}

		delete children[dat.parent][dat.name]
		delete index[id]
		delete children[id]

		if (dat.type === 'folder')
			protocol.del(id)
		else protocol.delData(id)
	}

	const PROT_delete_path = ({ path, protocol }) => {
		const {parent,remainder} = get_last_parent({ path })
		if (remainder) throw new Error(`This path does not exist`)
		PROT_delete_id({ id: parent, protocol })
	}

	const PROT_move_path_to_path = ({ path, newPath, protocol }) => {
		const normal_path = normalise_path({ path })
		const normal_newPath = normalise_path({ path: newPath })

		if (!normal_path)
			throw new Error(`Cannot move the root folder`)

		if (!normal_newPath)
			throw new Error(`Cannot move something to the root folder`)

		if (normal_path === normal_newPath)
			throw new Error(`Both paths are the same`)

		// get metadata of old path
		const {parent: id, remainder: notFound} = get_last_parent({ path })
		if (notFound) throw new Error(`This path does not exist`)
		const dat = index[id]

		// Delete anything already at the new path
		if (get_path_exists({ path: newPath }))
			PROT_delete_path({ path: newPath, protocol })

		// Create new parent path
		const splitPath = split_path({ path: newPath })
		const parentPath = splitPath.slice(0,-1).join('/')
		const {parent,remainder} = get_last_parent({ path: parentPath })
		const parentId = remainder ? PROT_create_path({ path: parentPath, isLeaf: false, protocol }) : parent

		// change parent and name
		const newName = splitPath.slice(-1)[0]
		dat.name = newName
		dat.parent = parentId
		dat.modified = Date.now()
		protocol.set(id, dat)
	}


	const data_store = {}

	const protocol_priority = ['file','data']
	const protocols = {
		file: {
			name: 'file',
			has: (id) => {
				return localStorage.hasOwnProperty(FILE+id)
			},
			hasData: (id) => {
				return localStorage.hasOwnProperty(FILE+DATA+id)
			},
			get: (id) => {
				return JSON.parse(localStorage.getItem(FILE+DATA+id))
			},
			set: (id, metadata) => {
				localStorage.setItem(FILE+id, JSON.stringify(metadata))
			},
			setData: (id, metadata, data) => {
				localStorage.setItem(FILE+id, JSON.stringify(metadata))
				localStorage.setItem(FILE+DATA+id, JSON.stringify(data))
			},
			del: (id) => {
				localStorage.removeItem(FILE+id)
			},
			delData: (id) => {
				localStorage.removeItem(FILE+id)
				localStorage.removeItem(FILE+DATA+id)
			}
		},
		data: {
			name: 'data',
			hasData: (id) => {
				return id in data_store
			},
			has: (id) => {
				return false
			},
			get: (id) => {
				return JSON.parse(data_store[id])
			},
			set: (id, metadata) => {
				// localStorage.setItem(FILE+id, JSON.stringify(metadata))
			},
			setData: (id, metadata, data) => {
				// localStorage.setItem(FILE+id, JSON.stringify(metadata))
				// localStorage.setItem(FILE+DATA+id, JSON.stringify(data))
				data_store[id] = JSON.stringify(data)
			},
			del: (id) => {
				// localStorage.removeItem(FILE+id)
			},
			delData: (id) => {
				// localStorage.removeItem(FILE+id)
				// localStorage.removeItem(FILE+DATA+id)
				delete data_store[id]
			}
		},
		any: {
			name: 'any',
			has: (id) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].has
					if (!funct) continue;
					const result = funct(id)
					if (!result) continue;
					return true
				}
			},
			hasData: (id) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].hasData
					if (!funct) continue;
					const result = funct(id)
					if (!result) continue;
					return true
				}
			},
			get: (id) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].get
					if (!funct) continue;
					if (!(protocols[protocol].hasData && protocols[protocol].hasData(id)))
						continue;
					const result = funct(id)
					if (!result) continue;
					return result
				}
			},
			set: (id, metadata) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].set
					if (!funct) continue;
					return funct(id, metadata)
				}
			},
			setData: (id, metadata, data) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].setData
					if (!funct) continue;
					return funct(id, metadata, data)
				}
			},
			del: (id) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].del
					if (!funct) continue;
					return funct(id)
				}
			},
			delData: (id) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].delData
					if (!funct) continue;
					return funct(id)
				}
			}
		},
		all: {
			name: 'all',
			has: (id) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].has
					if (!funct) continue;
					const result = funct(id)
					if (!result) return false
				}
				return true
			},
			hasData: (id) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].hasData
					if (!funct) continue;
					const result = funct(id)
					if (!result) return false
				}
				return true
			},
			get: (id) => {
				const results = {}
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].get
					if (!funct) continue;
					if (!(protocols[protocol].hasData && protocols[protocol].hasData(id)))
						continue;
					const result = funct(id)
					if (!result) continue;
					results[protocol] = result
				}
				return results
			},
			set: (id, metadata) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].set
					if (!funct) continue;
					funct(id, metadata)
				}
			},
			setData: (id, metadata, data) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].setData
					if (!funct) continue;
					funct(id, metadata, data)
				}
			},
			del: (id) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].del
					if (!funct) continue;
					funct(id)
				}
			},
			delData: (id) => {
				for (const protocol of protocol_priority) {
					const funct = protocols[protocol].delData
					if (!funct) continue;
					funct(id)
				}
			}
		}
	}
	const getProtocolPath = (path, protocol) => {//}, action) => {
		protocol = Object.keys(protocols).find(prot => path.slice(0,prot.length+3) === `${prot}://`) || protocol
		path = path.replace(/^([a-z]+:)\/\//, '')

		const protocolPaths = protocols[protocol]
		if (!protocolPaths)
			throw new Error(`Unsupported protocol: '${protocol}'`)

		return {
			protocol,
			path
		}
	}
	const delete_path = ({ path, protocol = 'all' }) => {
		const protocolPath = getProtocolPath(path, protocol)
		return PROT_delete_path({
			path: protocolPath.path,
			protocol: protocols[protocolPath.protocol]
		})
	}
	const save_data_to_path = ({ path, data, type, protocol = 'file' }) => {
		const protocolPath = getProtocolPath(path, protocol)
		return PROT_save_data_to_path({
			path: protocolPath.path,
			protocol: protocols[protocolPath.protocol],
			data,
			type
		})
	}
	const get_data_from_path = ({ path, protocol = 'any' }) => {
		const protocolPath = getProtocolPath(path, protocol)
		return PROT_get_data_from_path({
			path: protocolPath.path,
			protocol: protocols[protocolPath.protocol]
		})
	}
	const move_path_to_path = ({ path, newPath, protocol = 'any' }) => {
		// PROT_move_path_to_path
		console.warn('TODO: change protocols?')
		// const protocolPath = getProtocolPath(path, protocol, 'move_path_to_path')
		// protocolPath.action({
		// 	path: protocolPath.path,
		// 	newPath:
		// })
	}

	initialize();

	return {
		register: register_data_type,
		delete: delete_path,
		save: save_data_to_path,
		get: get_data_from_path,
		move: move_path_to_path,
		exists: get_path_exists,
		reset
	}
})()
