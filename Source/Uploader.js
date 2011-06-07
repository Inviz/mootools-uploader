/*
---
name: Uploader

description: Base classes for uploaders

requires: [Core/Browser, Core/Class, Core/Class.Extras, Core/Element, Core/Element.Event, Core/Element.Dimensions]

provides: [Uploader, Uploader.File]

version: 1.0

license: MIT License

authors: 
  - Harald Kirschner <http://digitarald.de>
...
*/

!function() {
  

var Uploader = this.Uploader = function(options) {
  options = Object.merge(Uploader.options, options)
  if (!options.adapter) options.adapter = Uploader.getAdapter();
  var Klass = Uploader.getAdapterClass(options.adapter);
  if (!options.fileClass) 
    options.fileClass = (options.getFileClass ? options : Uploader).getFileClass(options.adapter, Klass);
  var uploader = new Klass(options);
  uploader.addEvent('fileProgress', function(file) {
    if (file.id && uploader.fildFile) file = uploader.findFile(file.id);
    if (file) file.fireEvent('progress');
  });
  return uploader;
};

Uploader.options = {
  verbose: true,
  target: true
}

Object.append(Uploader, {
  METHODS: ['Request', 'Swiff', 'Iframe', 'Request'],

  STATUS_QUEUED: 0,
  STATUS_RUNNING: 1,
  STATUS_ERROR: 2,
  STATUS_COMPLETE: 3,
  STATUS_STOPPED: 4,

  log: function() {
    if (window.console && console.info) console.info.apply(console, arguments);
  },

  unitLabels: {
    b: [{min: 1, unit: 'B'}, {min: 1024, unit: 'kB'}, {min: 1048576, unit: 'MB'}, {min: 1073741824, unit: 'GB'}],
    s: [{min: 1, unit: 's'}, {min: 60, unit: 'm'}, {min: 3600, unit: 'h'}, {min: 86400, unit: 'd'}]
  },
  
  getAdapterClass: function(name) {
    return Uploader[name.capitalize()];
  },
  
  getAdapter: function(options) {
    if (this.adapter) return this.adapter;
    for (var adapter, i = 0; adapter = Uploader.METHODS[i++];)
      if (Uploader[adapter] && Uploader[adapter].condition(options))
        return (this.adapter = adapter);
  },

  formatUnit: function(base, type, join) {
    var labels = Uploader.unitLabels[(type == 'bps') ? 'b' : type];
    var append = (type == 'bps') ? '/s' : '';
    var i, l = labels.length, value;

    if (base < 1) return '0 ' + labels[0].unit + append;

    if (type == 's') {
      var units = [];

      for (i = l - 1; i >= 0; i--) {
        value = Math.floor(base / labels[i].min);
        if (value) {
          units.push(value + ' ' + labels[i].unit);
          base -= value * labels[i].min;
          if (!base) break;
        }
      }

      return (join === false) ? units : units.join(join || ', ');
    }

    for (i = l - 1; i >= 0; i--) {
      value = labels[i].min;
      if (base >= value) break;
    }

    return (base / value).toFixed(1) + ' ' + labels[i].unit + append;
  },

  qualifyPath: (function() {
    var anchor;
    return function(path) {
      (anchor || (anchor = new Element('a'))).href = path;
      return anchor.href;
    };
  })(),
  
  getFileClass: function(method, klass) {
    return klass.File;
  }

});

Uploader.File = new Class({
  Implements: [Events, Options],
  
  options: {
    url: null,
    method: null,
    data: null,
    mergeData: true,
    fieldName: null
  },
  
  setBase: function(base) {
    this.base = base;
    if (this.options.fieldName == null)
      this.options.fieldName = this.base.options.fieldName;
    this.fireEvent('setBase', base);
    var args = Array.prototype.slice.call(arguments, 1);
    if (args.length) this.setData.apply(this, args);
	  return this;
  },
  
  setData: function(data) {
    this.setFile(data);
    return this;
  },
  
  setFile: function(file) {
    if (file) Object.append(this, file);
    if (!this.name && this.filename) this.name = this.filename;
    this.fireEvent('setFile', this);
    if (this.name) this.extension = this.name.replace(/^.*\./, '').toLowerCase();
    return this;
  },
  
  render: function() {
    return this;
  },
  
  cancel: function() {
    if (this.base) this.stop();
    this.remove();
  }
});

Uploader.Targeting = new Class({
  options: {
    zIndex: 9999
  },
  
  getTargetRelayEvents: function() {
    return {
      buttonEnter: this.targetRelay.bind(this, 'mouseenter'),
      buttonLeave: this.targetRelay.bind(this, 'mouseleave'),
      buttonDown: this.targetRelay.bind(this, 'mousedown'),
      buttonDisable: this.targetRelay.bind(this, 'disable')
    }
  },
  
  getTargetEvents: function() {
    if (this.targetEvents) return this.targetEvents;
    this.targetEvents = {
      mousemove: this.reposition.bind(this)
    };
    return this.targetEvents;
  },
  
  targetRelay: function(name) {
    if (this.target) this.target.fireEvent(name);
  },
  
  attach: function(target) {
    if (!this.target) this.addEvents(this.getTargetRelayEvents());
    else this.detach();
    this.target = target;
    this.target.addEvents(this.getTargetEvents(this.target));
  },
  
  detach: function(target) {
    if (!target) target = this.target;
    target.removeEvents(this.getTargetEvents(target));
    delete this.target;
  },

  reposition: function(coords) {
    // update coordinates, manual or automatically
    coords = coords || (this.target && this.target.offsetHeight)
      ? this.target.getCoordinates(this.box.getOffsetParent())
      : {top: window.getScrollTop(), left: 0, width: 40, height: 40}
    this.box.setStyles(coords);
    this.fireEvent('reposition', [coords, this.box, this.target]);
  },
  
  getBox: function() {
    if (this.box) return this.box;
    this.box = new Element('div').setStyles({
      position: 'absolute',
      opacity: 0.02,
      zIndex: this.options.zIndex,
      overflow: 'hidden',
      height: 100, width: 100,
      top: scroll.y, left: scroll.x
    });
    this.box.inject(document.id(this.options.container) || document.body);
    return this.box;
  }
})

}.call(this);