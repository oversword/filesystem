if (!window.fs) throw new Error(`File system module must exist before interface can be initialised`)

Object.assign(window.fs, (() => {


htma.add(class Confirm {
	static template = `
	<div.confirm>
		<div.confirm-contents>
			<div.confirm-message>
				<if#message>
					<var#message>
			<div.confirm-input>
				<if#type=='string'>
					<input
						value=<var#default>
						onchange=<fun#handleInputChange(event.target.value)>
					>
		<div.confirm-buttons>
			<button.confirm-accept.confirm-button
				onclick=<fun#handleClickAccept()>
			>
				<var#acceptLabel>
			<button.confirm-reject.confirm-button
				onclick=<fun#handleClickReject()>
			>
				<var#rejectLabel>
	`
	type = 'button'
	message = 'Are you sure?'
	default = 'yes'
	acceptLabel = 'confirm'
	rejectLabel = 'cancel'
	onaccept = () => {}
	onreject = () => {}

	handleClickAccept() {
		this.onaccept(this.default)
	}
	handleClickReject() {
		this.onreject()
	}
	handleInputChange(value) {
		this.default = value
	}
})

htma.add(class Context {
	static template = `
	<div.context
		pos=absolute;top:<var#pos.y>;left:<var#pos.x>;
	>
		<for#option in=options>
			<div.context-item
				onclick=<fun#option.action()>
			>
				<var#option.name>
	`
	pos = { x:0, y:0 }
	options = []
})

htma.add(class FileBrowser {
	static template = `
	<div.file-browser
		oncontextmenu=<fun#handleMainContext(event)>
		onclick=<fun#handleMainClick()>
	>
		<div.file-browser-nav>
			<div.file-browser-nav-buttons>
				<button.file-browser-nav-back
					onclick=<fun#handleBackClick()>
					<if#history.length===0>
						disabled
				>
					&lt;
				<button.file-browser-nav-forth
					onclick=<fun#handleForthClick()>
					<if#future.length===0>
						disabled
				>
					&gt;
				<button.file-browser-nav-up
					onclick=<fun#handleUpClick()>
					<if#pathList.length===0>
						disabled
				>
					^
			<div.file-browser-nav-path>
				<input style="display:none" value=<var#path> onchange=<fun#handlePathInput(this.value)> >
				<div.file-browser-nav-path-breadcrumbs>
					<button.file-browser-nav-path-breadcrumbs-crumb
						onclick=<fun#handleBreadcrumbClick('/')>
					>
						/
					<for#name in=pathList key=i >
						<button.file-browser-nav-path-breadcrumbs-crumb
							onclick=<fun#handleBreadcrumbClick('/'+pathList.slice(0,i+1).join('/'))>
						>
							<var#name>
		<div.file-browser-list
			oncontextmenu=<fun#handleFileListContext(event,index)>
		>
			<for#file in=index >
				<div.file-browser-list-entry
					<if#file.type==='folder'>
						class="file-browser-list-entry-folder"
					<else>
						class="file-browser-list-entry-file"
					onclick=<fun#handleFileClick(file)>
					ondblclick=<fun#handleFileDoubleClick(file)>
					oncontextmenu=<fun#handleFileContext(event,file)>
					title=<var#file.name>
				>
					<var#file.name>
		<div.file-browser-selection>
			<dv.file-browser-selection-display>
				<if#selectionType==='newFile'>
					<input
						value=<var exp="selection.join(', ')" >
						onchange=<fun#handleSelectionChange(event.target.value)>
					>
				<else>
					<var exp="selection.join(', ')" >
			<dv.file-browser-selection-buttons>
				<button.file-browser-selection-select
					onclick=<fun#handleSelectClick()>
				>
					<var#selectLabel>
				<button.file-browser-selection-close
					onclick=<fun#handleCloseClick()>
				>
					Cancel
	`
	path = '/'
	history = []
	future = []
	selectionType = 'file'
	selectLabel = 'Select'
	selection = []
	multiple = false
	onselect = () => {}
	onnavigate = () => {}
	onbutton = () => {}
	oncontext = () => {}
	get pathList () {
		return this.path.split('/').filter(a => a)
	}
	get index() {
		const index = window.fs.get({ path: this.path })
		return index.contents
	}
	handleMainClick() {
		this.oncontext(false)
	}
	handleMainContext(event) {
		event.preventDefault()
		event.stopPropagation()
		this.oncontext('main', {
			x: event.pageX,
			y: event.pageY,
		})
	}
	handleFileContext(event, file) {
		event.preventDefault()
		event.stopPropagation()
		this.oncontext('file', {
			x: event.pageX,
			y: event.pageY,
		}, file)
	}
	handleFileListContext(event) {
		event.preventDefault()
		event.stopPropagation()
		this.oncontext('list', {
			x: event.pageX,
			y: event.pageY,
		})
	}
	handleBackClick() {
		this.onbutton('back')
	}
	handleForthClick() {
		this.onbutton('forth')
	}
	handleCloseClick() {
		this.onbutton('close')
	}
	handleSelectClick() {
		this.onbutton('select')
	}
	handleUpClick() {
		const pathList = this.pathList
			this.onnavigate('/'+pathList.slice(0,-1).join('/'))
	}
	handlePathInput(newPath) {
		this.onnavigate(newPath)
	}
	handleBreadcrumbClick(newPath) {
		this.onnavigate(newPath)
	}
	handleFileClick(file) {
		if (this.selectionType === 'folder' && file.type === 'folder') {
			this.onselect(file.name)
		} else
		if (this.selectionType !== 'folder' && file.type !== 'folder') {
			this.onselect(file.name)
		}
	}
	handleFileDoubleClick(file) {
		if (file.type === 'folder') {
			this.onnavigate('/'+this.pathList.concat([file.name]).join('/'))
		} else
		if (this.selectionType !== 'folder') {
			this.onselect(file.name)
			this.onbutton('select')
		}
	}
	handleSelectionChange(newSelection) {
		this.onselect(newSelection)
	}
})

const navigate_back = args => {
	args.future.push(args.path)
	args.path = args.history.pop()
	args.selection = []
}
const navigate_forth = args => {
	args.history.push(args.path)
	args.path = args.future.pop()
	args.selection = []
}

const select_file_to_save = ({ path }) => file_browser({ path, multiple: false, type: 'newFile', selectLabel: 'Save' })
const select_file = ({ path, multiple = false }) => file_browser({ path, multiple, type: 'file', selectLabel: 'Open' })
const select_folder = ({ path, multiple = false }) => file_browser({ path, multiple, type: 'folder', selectLabel: 'Open' })

const file_browser = ({ path, multiple = false, type = 'file', selectLabel = 'Select' }) => {
	// Select folder or folders
	const concatPath = (path, sub) =>
		'/'+path.split('/').filter(a => a).concat([sub]).join('/')
	const onSelected = []
	const selected = (selection) => {
		onSelected.forEach(callback => callback(selection))
	}
	const container = document.createElement('div')
	const contextContainer = document.createElement('div')
	const confirmContainer = document.createElement('div')
	const confirm = (args) => {
		let cb
		const onaccept = (value) => {
			confirmContainer.innerHTML = ''
			cb(value)
		}
		const onreject = () => {
			confirmContainer.innerHTML = ''
		}
		confirmContainer.innerHTML = htma.parse(
			`<Confirm <args#args> onaccept=<var#onaccept> onreject=<var#onreject> >`,
			{ args, onaccept, onreject }
		)
		return (callback) => {
			cb = callback
		}
	}
	const contextOptions = {
		main: () => [
		],
		list: () => [
			{ name: "New Folder", action() {
				contextContainer.innerHTML = ''
				confirm({ type: 'string', default: 'New folder', message: `New folder name:` })((folderName) => {
					window.fs.save({ path: `${path}/${folderName}` })
					reRender()
				})
			} },
			{ name: "New File", action() {
				contextContainer.innerHTML = ''
				confirm({ type: 'string', default: 'New file', message: `New file name:` })((fileName) => {
					window.fs.save({ path: `${path}/${fileName}`, data: {} })
					reRender()
				})
			} }
		],
		file: (file) => [
			{ name: "Rename", action() {
				contextContainer.innerHTML = ''
				confirm({ type: 'string', default: file.name, message: `New name:` })((fileName) => {
					window.fs.move({
						path: `${path}/${file.name}`,
						newPath: `${path}/${fileName}`
					})
					reRender()
				})
			} },
			{ name: "Delete", action() {
				contextContainer.innerHTML = ''
				confirm({ type: 'button', message: `Are you sure you want to delete this file: "${file.name}"?` })(() => {
					window.fs.delete({ path: `${path}/${file.name}` })
					reRender()
				})
			} }
		]
	}
	const args = {
		path,
		multiple,
		selectLabel,
		selectionType: type,
		history: [],
		future: [],
		selection: [],
		onselect: (newSelection) => {
			if (args.multiple)
				args.selection.push(newSelection)
			else args.selection = [newSelection]
			reRender()
		},
		onbutton: (button) => {
			if (button === 'back') {
				navigate_back(args)
				reRender()
			} else
			if (button === 'forth') {
				navigate_forth(args)
				reRender()
			} else
			if (button === 'select') {
				if (args.selection.length) {
					selected(args.selection.map(
						s => concatPath(args.path, s)
					))
				} else {
					selected([args.path])
				}
			} else
			if (button === 'close') {
				container.remove()
			}
		},
		onnavigate: (newPath) => {
			if (newPath !== args.path) {
				args.history.push(args.path)
				args.future = []
				args.selection = []
				args.path = newPath
				reRender()
			}
		},
		oncontext: (name, pos, data) => {
			if (name)
				contextContainer.innerHTML = htma.parse(`<Context <args#args> >`, { args: { pos: pos, options: contextOptions[name](data) } })
			else contextContainer.innerHTML = ''
		}
	}
	const reRender = () => {
		setTimeout(() => {
			container.innerHTML = htma.parse(`<FileBrowser <args#args> >`, { args })
		}, 100)
	}

	document.body.appendChild(container)
	document.body.appendChild(contextContainer)
	document.body.appendChild(confirmContainer)
	reRender()
	return {
		close() {
			container.remove()
			contextContainer.remove()
			confirmContainer.remove()
		},
		then(callback) {
			onSelected.push(callback)
		}
	}
}


return {
	selectFile: select_file,
	selectFolder: select_folder,
	saveFile: select_file_to_save,
}

})())
