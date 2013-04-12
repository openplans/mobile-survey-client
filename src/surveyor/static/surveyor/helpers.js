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

Handlebars.registerHelper('get', function(attr) {
  if (this instanceof Backbone.Model)
    return this.get(attr);
  else
    return this[attr];
});

Handlebars.registerHelper('run', function(func) {
  return this[func]();
});

Handlebars.registerHelper('select', function(value, options) {
  var $el = $('<select />').html(options.fn(this));
  $el.find('[value="' + value + '"]').attr('selected', 'selected');
  return $el.html();
});


/**********************************************************
 * Place list helpers
 * ==================
 */

Handlebars.registerHelper('if_has_been_surveyed', function(options) {
  var surveys = this.responseCollection;
  if (surveys.length > 0) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});

Handlebars.registerHelper('last_surveyed_at', function() {
  var surveys = this.responseCollection,
      lastSurvey = _.last(surveys.sortBy('updated_datetime'));
  if (lastSurvey) return lastSurvey.get('updated_datetime');
});

Handlebars.registerHelper('last_surveyed_by', function() {
  var surveys = this.responseCollection,
      lastSurvey = _.last(surveys.sortBy('updated_datetime'));
  if (lastSurvey) return lastSurvey.get('submitter_name');
});
