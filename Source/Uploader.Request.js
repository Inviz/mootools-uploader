/*
---
name: Uploader.Request

description: XHR-based request uploader. Doesnt load files in memory on clientside, although sends malformed request.

requires: [Uploader]

provides: [Uploader.Request, Uploader.Request.File]

version: 1.0

license: MIT License

authors: 
  - Harald Kirschner <http://digitarald.de>
  - Yaroslaff Fedin
...
*/

(function($, $$){

if (!this.Uploader) this.Uploader = {}
this.Uploader.Request = new Class({

  Implements: [Options, Events],

  options: {
    container: null,

    multiple: true,
    queued: true,
    verbose: false,

    url: null,
    method: null,
    data: null,
    mergeData: true,
    fieldName: null,

    allowDuplicates: false,
    fileListMax: 0,

    instantStart: false,
    appendCookieData: false,

    fileClass: null
  },

  initialize: function(options) {
    this.setOptions(options);

    this.target = $(this.options.target);

    this.box = new Element('span', {'class': 'swiff-uploader-box'}).addEvents({
      'mouseenter': this.fireEvent.bind(this, 'buttonEnter'),
      'mouseleave': this.fireEvent.bind(this, 'buttonLnter')
    })

    this.file = new Element('input', {
      type: 'file',
      name: 'Filedata',
      multiple: this.options.multiple,
      styles: {
        margin: 0,
        padding: 0,
        border: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'block',
        visibility: 'visible'
      },
      events: {
        change: this.select.bind(this),
        focus: function() {
          return false;
        },
        mousedown: function() {
          if (Browser.opera || Browser.chrome) return true;
          (function() {
            this.file.click();
            this.fireEvent('buttonDown');
          }).delay(10, this)
          return false;
        }.bind(this),
        focus: function() {
          return false;
        }
      }
    }).inject(this.box);
    
    this.reposition();
    window.addEvent('resize', this.reposition.bind(this));

    this.box.inject(this.options.container || document.body);

    this.addEvents({
      buttonEnter: this.targetRelay.bind(this, ['mouseenter']),
      buttonLeave: this.targetRelay.bind(this, ['mouseleave']),
      buttonDown: this.targetRelay.bind(this, ['mousedown']),
      buttonDisable: this.targetRelay.bind(this, ['disable'])
    });

    this.uploading = 0;
    this.fileList = [];

    return this;
  },

  targetRelay: function(name) {
    if (this.target) this.target.fireEvent(name);
  },
  
  select: function() {
    var files = this.file.files, success = [], failure = [];
    //this.file.onchange = this.file.onmousedown = this.file.onfocus = null;
    for (var i = 0, file; file = files[i++];) {
      var cls = this.options.fileClass || Uploader.Request.File;
      var ret = new cls(this, file);
      if (!ret.validate()) {
        ret.invalidate()
        ret.render();
        failure.push(ret);
        continue;
      } else {        
        this.fileList.push(ret);
        ret.render();
        success.push(ret)
      }

    }

    
    if (success.length) this.fireEvent('onSelectSuccess', [success]);
    if (failure.length) this.fireEvent('onSelectFailed', [failure]);

    if (this.options.instantStart) this.start();
  },

  reposition: function(coords) {
    // update coordinates, manual or automatically
    coords = coords || (this.target && this.target.offsetHeight)
      ? this.target.getCoordinates(this.box.getOffsetParent())
      : {top: window.getScrollTop(), left: 0, width: 40, height: 40}
    this.box.setStyles(coords);
    this.fireEvent('reposition', [coords, this.box, this.target]);
  },


  start: function() {
    var queued = this.options.queued;
    queued = (queued) ? ((queued > 1) ? queued : 1) : 0;

    for (var i = 0, file; file = this.fileList[i]; i++) {
      if (this.fileList[i].status != Uploader.Request.STATUS_QUEUED) continue;
      this.fileList[i].start();
      if (queued && this.uploading >= queued) break;
    }
    return this;
  },

  stop: function() {
    for (var i = this.fileList.length; i--;) this.fileList[i].stop();
  },

  remove: function() {
    for (var i = this.fileList.length; i--;) this.fileList[i].remove();
  },

  setEnabled: function(status) {
    this.file.disabled = !!(status);
    if (status) this.fireEvent('buttonDisable');
  }

});

Object.append(Uploader.Request, {



});

this.Uploader.Request.File = new Class({

  Extends: Uploader.File,

  Implements: Options,
  
  options: {
    url: null,
    method: null,
    data: null,
    mergeData: true,
    fieldName: null
  },

  initialize: function(base, file) {
    this.base = base;
    this.file = file;
    this.id = $uid(this);
    this.status = Uploader.STATUS_QUEUED;
    this.dates = {};
    this.dates.add = new Date();
    
    if (!file) return;
    var name = file.name;
    if (typeOf(name) == "string") {
      this.name = name;
      this.extension = name.replace(/^.*\./, '').toLowerCase();
    } else {
      Object.append(this, name);
    }
    this.size = file.size;
  },

  fireEvent: function(name) {
    this.base.fireEvent('file' + name.capitalize(), [this]);
    Uploader.log('File::' + name, this);
    return this.parent(name, [this]);
  },

  validate: function() {
    var base = this.base.options;

    if (!base.allowDuplicates) {
      var name = this.name;
      var dup = this.base.fileList.some(function(file) {
        return (file.name == name);
      });
      if (dup) {
        this.validationError = 'duplicate';
        return false;
      }
    }
    
    if (base.fileListSizeMax && (this.base.size + this.size) > base.fileListSizeMax) {
      this.validationError = 'fileListSizeMax';
      return false;
    }

    if (base.fileListMax && this.base.fileList.length >= base.fileListMax) {
      this.validationError = 'fileListMax';
      return false;
    }

    return true;
  },

  invalidate: function() {
    this.invalid = true;
    return this.fireEvent('invalid');
  },

  render: function() {
    return this;
  },
  
  onProgress: function(progress) {
    this.progress = {
      bytesLoaded: progress.loaded,
      percentLoaded: progress.loaded / this.size * 100
    }
    this.fireEvent('progress', this);
    this.base.fireEvent('fileProgress', this);
  },
  
  onFailure: function() {
    if (this.status != Uploader.STATUS_RUNNING) return;
    
    this.status = Uploader.STATUS_ERROR;
    //this.complete()
    console.error('failure :(', this, $A(arguments))
  },

  onSuccess: function(response) {
    if (this.status != Uploader.STATUS_RUNNING) return;

    this.status = Uploader.STATUS_COMPLETE;

    this.base.uploading--;
    this.dates.complete = new Date();
    this.response = {
      text: this.xhr.responseText
    }

    this.fireEvent('complete');
    this.base.fireEvent('fileComplete', this)
    this.base.start();
  },

  start: function() {
    if (this.status != Uploader.STATUS_QUEUED) return this;

    var base = this.base.options, options = this.options;
    
    var merged = {};
    for (var key in base) {
      merged[key] = (this.options[key] != null) ? this.options[key] : base[key];
    }

    if (merged.data) {
      if (merged.mergeData && base.data && options.data) {
        if (typeOf(base.data) == 'string') merged.data = base.data + '&' + options.data;
        else merged.data = Object.merge(base.data, options.data);
      }      
    }  
		var query = (typeOf(merged.data) == 'string') ? merged.data : Hash.toQueryString(merged.data);
    var xhr = this.xhr = new XMLHttpRequest, self = this;
    xhr.upload.onprogress = this.onProgress.bind(this);
    xhr.upload.onload = function(response) {
      setTimeout(function(){
        if(xhr.readyState === 4) {
          $try(function(){
      			this.status = this.xhr.status;
      		}.bind(this));
      		self[(this.status < 300 && this.status > 199) ? 'onSuccess' : 'onFailure'](response)
        } else setTimeout(arguments.callee, 15);
      }, 15);
    }
    xhr.upload.onerror = xhr.upload.onabort = this.onFailure.bind(this)

    this.status = Uploader.STATUS_RUNNING;
    this.base.uploading++;
    
    this.base.fireEvent('fileStart', this);
    
    xhr.open("post", (merged.url) + "?" + query, true);
    xhr.setRequestHeader("If-Modified-Since", "Mon, 26 Jul 1997 05:00:00 GMT");
    xhr.setRequestHeader("Cache-Control", "no-cache");
    xhr.setRequestHeader("Content-Type", "multipart/form-data");
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.setRequestHeader("X-File-Size", this.file.size);
    xhr.setRequestHeader("X-File-Type", this.file.type);
    xhr.send(this.file)

    this.dates.start = new Date();

    this.fireEvent('start');

    return this;
  },

  requeue: function() {
    this.stop();
    this.status = Uploader.STATUS_QUEUED;
    this.fireEvent('requeue');
  },

  stop: function(soft) {
    if (this.status == Uploader.STATUS_RUNNING) {
      this.status = Uploader.STATUS_STOPPED;
      this.base.uploading--;
      this.base.start();
      this.xhr.abort()
      this.fireEvent('stop');
    }
    return this;
  },

  remove: function() {
    this.stop();
    delete thix.xhr;
    this.base.fileList.erase(this);
    this.fireEvent('remove');
    this.base.fireEvent('fileRemove', this);
    
    return this;
  }
});

this.Uploader.Request.condition = function() {
  return (Browser.safari && Browser.version > 3) || Browser.chrome || (Browser.firefox && Browser.firefox.version > 2);
}

}).call(this, document.id, document.getElements);
