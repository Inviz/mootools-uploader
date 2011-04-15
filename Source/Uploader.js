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
	if (!options.method) {
		for (var method, i = 0; method = Uploader.METHODS[i++];) {
			if (Uploader[method] && Uploader[method].condition(options)) {
				options.method = method;
				break;
			}
		}
	}
	return new Uploader[options.method.capitalize()](options);
};

Object.append(Uploader, {
	METHODS: ['Swiff', 'Iframe', 'Request'],

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
	})()

});

Uploader.File = new Class({
	Implements: Events
});

}.call(this);