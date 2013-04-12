Handlebars.registerHelper('isInput', function(options) {
  if (!this.type || (this.type !== 'textarea' && this.type !== 'select' && this.type !== 'file')) {
    return options.fn(this);
  }
});

Handlebars.registerHelper('isTextarea', function(options) {
  if (this.type === 'textarea') {
    return options.fn(this);
  }
});

Handlebars.registerHelper('isSelect', function(options) {
  if (this.type === 'select') {
    return options.fn(this);
  }
});

Handlebars.registerHelper('isFile', function(options) {
  if (this.type === 'file') {
    return options.fn(this);
  }
});

Handlebars.registerHelper('isFileInputSupported', function(options) {
  if (Shareabouts.Util.fileInputSupported()) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});

Handlebars.registerHelper('getAttr', function(obj, attr, options) {
  if (obj !== undefined) {
    return obj[attr];
  }
});

Handlebars.registerHelper('select', function(value, options) {
  var $el = $('<select />').html(options.fn(this));
  $el.find('[value="' + value + '"]').attr('selected', 'selected');
  return $el.html();
});
