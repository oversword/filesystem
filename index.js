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

	const create_child = ({ parent, name, isLeaf }) => {
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
			localStorage.setItem(FILE+id, JSON.stringify(dat))
		} else {
			const newChildren = {}
			childs[name] = {id,children:newChildren}
			children[id] = newChildren
			const dat = {
				parent, name, created: Date.now(), modified: Date.now(), type: 'folder'
			}
			index[id] = dat
			localStorage.setItem(FILE+id, JSON.stringify(dat))
		}

		return id
	}
	const create_path = ({ path, isLeaf }) => {
		const { parent, remainder } = get_last_parent({ path })
		return split_path({ path: remainder })
		.reduce((par, name, i, list) =>
			create_child({ parent: par, name, isLeaf: isLeaf && i===list.length-1 }),
			parent)
	}

	const save_data_to_path = ({ path, data, type }) => {
		const {parent,remainder} = get_last_parent({ path })
		const id = remainder ? create_path({ path, isLeaf: Boolean(data) }) : parent
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
			localStorage.setItem(FILE+id, JSON.stringify(dat))
			localStorage.setItem(FILE+DATA+id, JSON.stringify(data))
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

	const get_data_from_path = ({ path }) => {
		// if path is not leaf, return an index object as data
		const {parent,remainder} = get_last_parent({ path })
		if (remainder) throw new Error(`This path does not exist`)
		const dat = index[parent]
		if (dat.type === 'folder') {
			return new Index(parent)
		} else {
			const parsed = JSON.parse(localStorage.getItem(FILE+DATA+parent))
			if (dat.type === 'file')
				return parsed
			else if (!dataTypes[dat.type])
				throw new Error(`Data type '${dat.type}' is not registered`)
			return dataTypes[dat.type](parsed)
		}
	}

	const get_path_exists = ({ path }) => {
		const {parent,remainder} = get_last_parent({ path })
		if (remainder) return false
		const dat = index[parent]
		return dat.type
	}

	const delete_id = ({ id }) => {
		const dat = index[id]
		if (dat.type === 'folder') {
			Object.values(children[id]).forEach(delete_id)
		}

		delete children[dat.parent][dat.name]
		delete index[id]
		delete children[id]
		localStorage.removeItem(FILE+id)

		if (dat.type !== 'folder') {
			localStorage.removeItem(FILE+DATA+id)
		}
	}

	const delete_path = ({ path }) => {
		const {parent,remainder} = get_last_parent({ path })
		if (remainder) throw new Error(`This path does not exist`)
		delete_id({ id: parent })
	}

	const move_path_to_path = ({ path, newPath }) => {
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
			delete_path({ path: newPath })

		// Create new parent path
		const splitPath = split_path({ path: newPath })
		const parentPath = splitPath.slice(0,-1).join('/')
		const {parent,remainder} = get_last_parent({ path: parentPath })
		const parentId = remainder ? create_path({ path: parentPath, isLeaf: false }) : parent

		// change parent and name
		const newName = splitPath.slice(-1)[0]
		dat.name = newName
		dat.parent = parentId
		dat.modified = Date.now()
		localStorage.setItem(FILE+id, JSON.stringify(dat))
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
