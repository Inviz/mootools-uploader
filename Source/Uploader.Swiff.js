/*
---
name: Swiff.Uploader

description: Swiff.Uploader - Flash FileReference Control

requires: [Uploader, Core/Swiff]

provides: [Swiff.Uploader, Swiff.Uploader.File, Uploader.Swiff, Uploader.Swiff.File]

version: 3.0

license: MIT License

author: Harald Kirschner <http://digitarald.de>
...
*/
	
Uploader.Swiff = Swiff.Uploader = new Class({

	Extends: Swiff,

	Implements: [Events, Uploader.Targeting],

	options: {
		path: 'Swiff.Uploader.swf',
		
		target: null,
		
		callBacks: null,
		params: {
			wMode: 'opaque',
			menu: 'false',
			allowScriptAccess: 'always'
		},

		typeFilter: null,
		multiple: true,
		queued: true,
		verbose: false,
		height: 30,
		width: 100,
		passStatus: null,

		url: null,
		method: null,
		data: null,
		mergeData: true,
		fieldName: null,

		fileSizeMin: 1,
		fileSizeMax: null, // Official limit is 100 MB for FileReference, but I tested up to 2Gb!
		allowDuplicates: false,
		timeLimit: (Browser.Platform.linux) ? 0 : 30,

		policyFile: null,
		buttonImage: null,
		
		fileListMax: 0,
		fileListSizeMax: 0,

		instantStart: false,
		appendCookieData: false,
		
		fileClass: null
		/*
		onLoad: $empty,
		onFail: $empty,
		onStart: $empty,
		onQueue: $empty,
		onComplete: $empty,
		onBrowse: $empty,
		onDisabledBrowse: $empty,
		onCancel: $empty,
		onSelect: $empty,
		onSelectSuccess: $empty,
		onSelectFail: $empty,
		
		onButtonEnter: $empty,
		onButtonLeave: $empty,
		onButtonDown: $empty,
		onButtonDisable: $empty,
		
		onFileStart: $empty,
		onFileStop: $empty,
		onFileRequeue: $empty,
		onFileOpen: $empty,
		onFileProgress: $empty,
		onFileComplete: $empty,
		onFileRemove: $empty,
		
		onBeforeStart: $empty,
		onBeforeStop: $empty,
		onBeforeRemove: $empty
		*/
	},

	initialize: function(options) {
		// protected events to control the class, added
		// before setting options (which adds own events)
		this.addEvent('load', this.initializeSwiff, true)
			.addEvent('select', this.processFiles, true)
			.addEvent('complete', this.setData, true)
			.addEvent('fileRemove', function(file) {
				this.fileList.erase(file);
			}.bind(this), true);

		this.setOptions(options);

		// callbacks are no longer in the options, every callback
		// is fired as event, this is just compat
		if (this.options.callBacks) {
			Hash.each(this.options.callBacks, function(fn, name) {
				this.addEvent(name, fn);
			}, this);
		}

		this.options.callBacks = {
			fireCallback: this.fireCallback.bind(this)
		};

		var path = this.options.path;
		if (!path.contains('?')) path += '?noCache=' + Date.now(); // cache in IE

		// target 
		if (this.options.target) {
			// we force wMode to transparent for the overlay effect
			this.parent(path, {
				params: {
					wMode: 'transparent'
				},
				height: '100%',
				width: '100%'
			});
		} else {
			this.parent(path);
		}

		this.inject(this.getBox());

		this.fileList = [];
		
		this.size = this.uploading = this.bytesLoaded = this.percentLoaded = 0;
		
		this.verifyLoad.delay(1000, this);
		
    var target = document.id(this.options.target);
    if (target) this.attach(target);
	},
	
	verifyLoad: function() {
		if (this.loaded) return;
		if (!this.object.parentNode) {
			this.fireEvent('fail', ['disabled']);
		} else if (this.object.style.display == 'none') {
			this.fireEvent('fail', ['hidden']);
		} else if (!this.object.offsetWidth) {
			this.fireEvent('fail', ['empty']);
		}
	},

	fireCallback: function(name, args) {
		// file* callbacks are relayed to the specific file
		if (name.substr(0, 4) == 'file') {
			// updated queue data is the second argument
			if (args.length > 1) this.setData(args[1]);
			var data = args[0];
			
			var file = this.findFile(data.id);
			this.fireEvent(name, file || data, 5);
			if (file) {
				var fire = name.replace(/^file([A-Z])/, function($0, $1) {
					return $1.toLowerCase();
				});
				file.setData(data).fireEvent(fire, [data], 10);
			}
		} else {
			this.fireEvent(name, args, 5);
		}
	},

	setData: function(data) {
		// the data is saved right to the instance 
		Object.append(this, data);
		this.fireEvent('queue', [this], 10);
		return this;
	},

	findFile: function(id) {
		for (var i = 0; i < this.fileList.length; i++) {
			if (this.fileList[i].id == id) return this.fileList[i];
		}
		return null;
	},

	initializeSwiff: function() {
		// extracted options for the swf 
		this.remote('xInitialize', {
			typeFilter: this.options.typeFilter,
			multiple: this.options.multiple,
			queued: this.options.queued,
			verbose: this.options.verbose,
			width: this.options.width,
			height: this.options.height,
			passStatus: this.options.passStatus,
			url: this.options.url,
			method: this.options.method,
			data: this.options.data,
			mergeData: this.options.mergeData,
			fieldName: this.options.fieldName,
			fileSizeMin: this.options.fileSizeMin,
			fileSizeMax: this.options.fileSizeMax,
			allowDuplicates: this.options.allowDuplicates,
			timeLimit: this.options.timeLimit,
			policyFile: this.options.policyFile,
			buttonImage: this.options.buttonImage
		});

		this.loaded = true;

		this.appendCookieData();
	},
	
	setOptions: function(options) {
		if (options) {
			if (options.url) options.url = Uploader.qualifyPath(options.url);
			if (options.buttonImage) options.buttonImage = Uploader.qualifyPath(options.buttonImage);
			this.parent(options);
			if (this.loaded) this.remote('xSetOptions', options);
		}
		return this;
	},

	setEnabled: function(status) {
		this.remote('xSetEnabled', status);
	},

	start: function() {
		this.fireEvent('beforeStart');
		this.remote('xStart');
	},

	stop: function() {
		this.fireEvent('beforeStop');
		this.remote('xStop');
	},

	remove: function() {
		this.fireEvent('beforeRemove');
		this.remote('xRemove');
	},

	fileStart: function(file) {
		this.remote('xFileStart', file.id);
	},

	fileStop: function(file) {
		this.remote('xFileStop', file.id);
	},

	fileRemove: function(file) {
		this.remote('xFileRemove', file.id);
	},

	fileRequeue: function(file) {
		this.remote('xFileRequeue', file.id);
	},

	appendCookieData: function() {
		var append = this.options.appendCookieData;
		if (!append) return;
		
		var hash = {};
		document.cookie.split(/;\s*/).each(function(cookie) {
			cookie = cookie.split('=');
			if (cookie.length == 2) {
				hash[decodeURIComponent(cookie[0])] = decodeURIComponent(cookie[1]);
			}
		});

		var data = this.options.data || {};
		if (typeOf(append) == 'string') data[append] = hash;
		else Object.append(data, hash);

		this.setOptions({data: data});
	},

	processFiles: function(successraw, failraw, queue) {
		var cls = this.options.fileClass || Swiff.Uploader.File;

		var fail = [], success = [];
		
		this.fireEvent('beforeSelect');

		if (successraw) {
			successraw.each(function(data) {
				var ret = new cls;
				ret.setBase(this, data);
				if (!ret.validate()) {
					ret.remove.delay(10, ret);
					fail.push(ret);
				} else {
					this.size += data.size;
					this.fileList.push(ret);
					success.push(ret);
					ret.render();
				}
			}, this);

			this.fireEvent('selectSuccess', [success], 10);
		}

		if (failraw || fail.length) {
			fail.append((failraw) ? failraw.map(function(data) {
				var row = new cls;
				row.setBase(this, data);
				return row;
			}, this) : []).each(function(file) {
				file.invalidate();
				file.render();
			});

			this.fireEvent('selectFail', [fail], 10);
		}

		this.setData(queue);

		if (this.options.instantStart && success.length) this.start();
	}

});

Swiff.Uploader.log = Uploader.log;

Swiff.Uploader.File = new Class({
	Implements: Uploader.File,

	validate: function() {
		var options = this.base.options;
		
		if (options.fileListMax && this.base.fileList.length >= options.fileListMax) {
			this.validationError = 'fileListMax';
			return false;
		}
		
		if (options.fileListSizeMax && (this.base.size + this.size) > options.fileListSizeMax) {
			this.validationError = 'fileListSizeMax';
			return false;
		}
		
		return true;
	},

	invalidate: function() {
		this.invalid = true;
		this.base.fireEvent('fileInvalid', this, 10);
		return this.fireEvent('invalid', this, 10);
	},

	setSwiffOptions: function(options) {
		if (options) {
			if (options.url) options.url = Uploader.qualifyPath(options.url);
			this.base.remote('xFileSetOptions', this.id, options);
			this.options = Object.merge(this.options, options);
		}
		return this;
	},

	start: function() {
		this.base.fileStart(this);
		return this;
	},

	stop: function() {
		this.base.fileStop(this);
		return this;
	},

	remove: function() {
		this.base.fileRemove(this);
		return this;
	},

	requeue: function() {
		this.base.fileRequeue(this);
	} 

});

Swiff.Uploader.condition = function() {
	return Browser.Plugins.Flash && Browser.Plugins.Flash.version > 8;
};
