Helpers = {
  condition: function(f) {
    // Return a handlebars block helper function predicated on the condition
    // function f.
    return function(/*arg1, arg2, ..., options*/) {
      var args = _.initial(arguments),
          options = _.last(arguments);

      if (f.apply(this, args)) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    }
  },

  inverse: function(f) {
    // Return a handlebars block helper function predicated the inverse of the
    // condition function f.
    var inverseF = function(/*...*/) {
          return !(f.apply(this, arguments));
        };
    return Helpers.condition(inverseF);
  }
};

Conditions = {
  iseq: function(arg1, arg2) {
    return arg1 === arg2;
  },

  isin: function(/*elem, arr[0], arr[1], ...*/) {
    var elem = _.first(arguments),
        arr = _.rest(arguments);
    return _.contains(arr, elem);
  }
};

Handlebars.registerHelper('ifeq', Helpers.condition(Conditions.iseq));
Handlebars.registerHelper('ifin', Helpers.condition(Conditions.isin));
Handlebars.registerHelper('unlesseq', Helpers.inverse(Conditions.iseq));
Handlebars.registerHelper('unlessin', Helpers.inverse(Conditions.isin));

Handlebars.registerHelper('isFileInputSupported', Helpers.condition(Shareabouts.Util.fileInputSupported));

Handlebars.registerHelper('default', function(val, default_val) {
  return val || default_val;
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

/**********************************************************
 * Place form helpers
 * ==================
 */

Handlebars.registerHelper('withCurrentUser', function(options) {
  return options.fn(_.extend(this, {current_user: Surveyor.currentUser}));
});
