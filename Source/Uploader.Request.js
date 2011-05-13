/*
---
name: Uploader.Request

description: XHR-based request uploader. Doesnt load files in memory on clientside, although sends malformed request.

requires: [Uploader]

provides: [Uploader.Request, Uploader.Request.File]

version: 1.0

license: MIT License

credits:
  - François de Metz <https://github.com/coolaj86/html5-formdata> 

authors: 
  - Harald Kirschner <http://digitarald.de>
  - Yaroslaff Fedin
...
*/

Uploader.Request = new Class({

  Implements: [Options, Events, Uploader.Targeting],

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

    this.box = this.getBox().addEvents({
      'mouseenter': this.fireEvent.bind(this, 'buttonEnter'),
      'mouseleave': this.fireEvent.bind(this, 'buttonLnter')
    });

    this.createInput().inject(this.box);
    
    this.reposition();
    window.addEvent('resize', this.reposition.bind(this));

    this.box.inject(this.options.container || document.body);
    
    this.uploading = 0;
    this.fileList = [];
    
    var target = document.id(this.options.target);
    if (target) this.attach(target);
  },
  
  createInput: function() {
    return this.input = new Element('input', {
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
            this.input.click();
            this.fireEvent('buttonDown');
          }).delay(10, this)
          return false;
        }.bind(this)
      }
    });
  },
  
  select: function() {
    var files = this.input.files, success = [], failure = [];
    //this.file.onchange = this.file.onmousedown = this.file.onfocus = null;
    for (var i = 0, file; file = files[i++];) {
      var cls = this.options.fileClass || Uploader.Request.File;
      var ret = new cls;
      ret.setBase(this, file);
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

  start: function() {
    var queued = this.options.queued;
    queued = (queued) ? ((queued > 1) ? queued : 1) : 0;

    for (var i = 0, file; file = this.fileList[i]; i++) {
      if (this.fileList[i].status != Uploader.STATUS_QUEUED) continue;
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
    this.input.disabled = !!(status);
    if (status) this.fireEvent('buttonDisable');
  }

});

Uploader.Request.File = new Class({

  Implements: Uploader.File,
  
  setBase: function(base, file) {
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
    
		this.fireEvent('setBase', [base, name, this.size]);
  },

  triggerEvent: function(name) {
    this.base.fireEvent('file' + name.capitalize(), [this]);
    Uploader.log('File::' + name, this);
    return this.fireEvent(name, [this]);
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
    return this.triggerEvent('invalid');
  },

  render: function() {
    return this;
  },
  
  onProgress: function(progress) {
    this.progress = {
      bytesLoaded: progress.loaded,
      percentLoaded: progress.loaded / progress.total * 100
    }
    this.triggerEvent('progress', progress);
  },
  
  onFailure: function() {
    if (this.status != Uploader.STATUS_RUNNING) return;
    
    this.status = Uploader.STATUS_ERROR;
    delete this.xhr;
    
    this.triggerEvent('fail')
    console.error('failure :(', this, Array.from(arguments))
  },

  onSuccess: function(response) {
    if (this.status != Uploader.STATUS_RUNNING) return;

    this.status = Uploader.STATUS_COMPLETE;
    
    delete this.file;
      
    this.base.uploading--;
    this.dates.complete = new Date();
    this.response = {
      text: this.xhr.responseText
    }

    this.triggerEvent('complete');
    this.base.start();
    
    delete this.xhr;
    
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
  		var query = (typeOf(merged.data) == 'string') ? merged.data : Hash.toQueryString(merged.data);      
    } 
    
    var xhr = this.xhr = new XMLHttpRequest, self = this;
    xhr.upload.onprogress = this.onProgress.bind(this);
    xhr.upload.onload = function() {
      setTimeout(function(){
        if(xhr.readyState === 4) {
          try { var status = xhr.status } catch(e) {};
          self.response = {text: xhr.responseText}
          self[(status < 300 && status > 199) ? 'onSuccess' : 'onFailure'](self.response)
        } else setTimeout(arguments.callee, 15);
      }, 15);
    }
    xhr.upload.onerror = xhr.upload.onabort = this.onFailure.bind(this)

    this.status = Uploader.STATUS_RUNNING;
    this.base.uploading++;
    
    xhr.open("post", (merged.url) + (query ? "?" + query : ""), true);
    xhr.setRequestHeader("Cache-Control", "no-cache");
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    
    var data = new FormData();
    data.append(this.options.fieldName, this.file);
    if (data.fake) {
       xhr.setRequestHeader("Content-Type", "multipart/form-data; boundary="+ data.boundary);
       xhr.sendAsBinary(data.toString());
    } else {
       xhr.send(data);
    }
    
    this.dates.start = new Date();

    this.triggerEvent('start');

    return this;
  },

  requeue: function() {
    this.stop();
    this.status = Uploader.STATUS_QUEUED;
    this.triggerEvent('requeue');
  },

  stop: function(soft) {
    if (this.status == Uploader.STATUS_RUNNING) {
      this.status = Uploader.STATUS_STOPPED;
      this.base.uploading--;
      this.base.start();
      this.xhr.abort()
      this.triggerEvent('stop');
    }
    return this;
  },

  remove: function() {
    this.stop();
    delete this.xhr;
    this.base.fileList.erase(this);
    this.triggerEvent('remove');
    
    return this;
  }
});

Uploader.Request.condition = function() {
  return (Browser.safari && Browser.version > 3) || Browser.chrome || (Browser.firefox && Browser.firefox.version > 2);
};

(function(w) {
    if (w.FormData)
        return;
    function FormData() {
        this.fake = true;
        this.boundary = "--------FormData" + Math.random();
        this._fields = [];
    }
    FormData.prototype.append = function(key, value) {
        this._fields.push([key, value]);
    }
    FormData.prototype.toString = function() {
        var boundary = this.boundary;
        var body = "";
        this._fields.forEach(function(field) {
            body += "--" + boundary + "\r\n";
            // file upload
            if (field[1].name) {
                var file = field[1];
                body += "Content-Disposition: form-data; name=\""+ field[0] +"\"; filename=\""+ file.name +"\"\r\n";
                body += "Content-Type: "+ file.type +"\r\n\r\n";
                body += file.getAsBinary() + "\r\n";
            } else {
                body += "Content-Disposition: form-data; name=\""+ field[0] +"\";\r\n\r\n";
                body += field[1] + "\r\n";
            }
        });
        body += "--" + boundary +"--";
        return body;
    }
    w.FormData = FormData;
})(window);