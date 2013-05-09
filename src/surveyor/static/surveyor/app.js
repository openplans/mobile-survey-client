/*globals jQuery Backbone moment Handlebars _ L Spinner */

var Surveyor = Surveyor || {};

(function($, S) {
  'use strict';

  S.Router = Backbone.Router.extend({
    routes : {
       ':placeId': 'surveyList'
    },

    needsConfirmation: function() {
      var i, fv;
      if (S.currentListView) {
        for(i=0;i<S.currentListView.formViews.length; i++) {
          fv = S.currentListView.formViews[i];
          if (fv.confirmLeave) {
            return fv.confirmLeave();
          }
        }
      }

      return false;
    },

    surveyList: function(placeId) {
      var model = S.placeCollection.get(parseInt(placeId, 10));

      // If we need to confirm something before moving on, then do so. The
      // confirmation method is responsible for restarting the routing.
      if (this.needsConfirmation())
        return;

      S.currentListView = new S.SurveyListView({
        el: '#survey-list-content',
        template: S.surveyListTemplate,
        model: model
      }).render();
    }
  });


  S.SurveyListView = Backbone.View.extend({
    initialize: function() {
      this.template = this.options.template;
      this.formViews = [];
    },

    render: function() {
      var self = this,
          html = this.template({
            address: this.model.get('address'),
            submissions: this.model.responseCollection.toJSON()
          });

      // Render the template
      this.$el.html(html);

      // Iterate over the surveys and render them
      this.model.responseCollection.each(function(model, i, list) {
        var view = new S.PlaceFormView({
          model: model,
          template: S.placeFormTemplate,
          placeModel: self.model
        });

        self.formViews[i] = view;

        self.$('#survey-' + model.id + ' .accordion-inner').html(view.render().el);
      });

      return this;
    }
  });

  S.PlaceSearchView = Backbone.View.extend({
    initialize: function() {
      // Bind collection event listeners
      this.collection.on('reset', this.render, this);

      this.template = this.options.template;

      S.loadSpinner.spin(this.el);
    },

    render: function() {
      var self = this,
          html = this.template(this.collection.toJSON());

      // Render the template
      this.$el.html(html);

      // Init the typeahead plugin
      this.$('input[type="text"]').typeahead({
        source: self.collection.pluck('address'),
        updater: function(item) {
          // Note that this assumes unique addresses!
          var model = self.collection.findWhere({'address': item});

          if (model) {
            S.router.navigate(model.id.toString(), {trigger: true});
          } else {
            window.alert('Oops, that\'s not a location we know about. Try again please.');
          }
        }
      });
    }
  });


  S.PlaceFormView = Backbone.View.extend({
    initialize: function() {
      this.template = this.options.template;
      this.placeModel = this.options.placeModel;
    },

    events: {
      'change input, textarea, select': 'onInputChanged',
      'submit form': 'onFormSubmit',
      'click .discard-confirmation .yes-btn': 'discardChanges'
    },

    getScrollTop: function() {
      return 0;
    },

    onInputChanged: function(evt) {
      var $field = $(evt.target);
      if ($field.hasClass('survey-input')) {
        this.isDirty = true;
      }

      this.updateConditionalFields();
    },

    confirmLeave: function() {
      if (this.isDirty) {
        // Store the path that we were going to, but change the path back to
        // the one for this form.
        this.nextPath = Backbone.history.location.pathname;
        S.router.navigate('/' + this.model.id);

        // Show the confirmation modal.
        this.$('.discard-confirmation').modal('show');

        // Inform the caller that there's a confirmation necessary.
        return true;

      } else {

        // Inform the caller tha there's no confirmation necessary.
        return false;
      }
    },

    discardChanges: function() {
      this.$('form')[0].reset();
      this.isDirty = false;
      this.$('.discard-confirmation').modal('hide');
      S.router.navigate(this.nextPath, {trigger: true});
    },

    isConditionSatisfied: function($field) {
      var conditionField = $field.attr('data-condition-field'),
          conditionValue = $field.attr('data-condition-value'),
          $conditionField;

      if (!conditionField) {
        // When there is no condition to be satisfied, just return true.
        return true;
      }

      // Get the field that this field depends on
      $conditionField = this.$('[name="' + conditionField + '"]');

      if (!this.isConditionSatisfied($conditionField.closest('.survey-field'))) {
        // All fields that this field depends on must also be satisfied.
        return false;
      }

      switch ($conditionField.attr('type')) {
        // Checkboxes are special. Their value is always 'on', so check
        // whether it's checked instead.
        case 'checkbox':
          if (($conditionField.is(':checked') && conditionValue === 'checked') ||
              ($conditionField.is(':not(:checked)') && conditionValue === 'unchecked')) {
            return true;
          } else {
            return false;
          }
          break;

        // For everything else, just check that the value matches.
        default:
          if ($conditionField.val() === conditionValue) {
            return true;
          } else {
            return false;
          }
      }
    },

    updateConditionalFields: function() {
      var self = this;

      // Go through each of the fields for this survey. If one of them has a
      // condition-field data attribute, then only show it if the value of that
      // field is equal to the condition-value data attribute.
      self.$('.survey-field').each(function(i, field) {
        var $field = $(field);

        if (self.isConditionSatisfied($field)) {
          $field.show();
        } else {
          $field.hide();
        }
      });
    },

    getAttrs: function() {
      var attrs = {};

      // Get attributes from the form
      _.each(this.$('form').serializeArray(), function(item, i) {
        attrs[item.name] = item.value;
      });

      return attrs;
    },

    showSaveSpinner: function() {
      var opts = {
            lines: 13, // The number of lines to draw
            length: 0, // The length of each line
            width: 4, // The line thickness
            radius: 5, // The radius of the inner circle
            corners: 1, // Corner roundness (0..1)
            rotate: 0, // The rotation offset
            direction: 1, // 1: clockwise, -1: counterclockwise
            color: '#000', // #rgb or #rrggbb
            speed: 1, // Rounds per second
            trail: 60, // Afterglow percentage
            shadow: false, // Whether to render a shadow
            hwaccel: false, // Whether to use hardware acceleration
            className: 'save-spinner', // The CSS class to assign to the spinner
            zIndex: 2e9, // The z-index (defaults to 2000000000)
            top: 'auto', // Top position relative to parent in px
            left: 'auto' // Left position relative to parent in px
          },
          target = this.$('.save-spinner-wrapper'),
          spinner = new Spinner(opts).spin(target[0]);
    },

    startSave: function() {
      // Show the save box, and render a spinner into it
      this.$('.survey-save-inprogress').show();
      this.showSaveSpinner();

      // Disable the save button
      this.$('.save-btn').attr('disabled', 'disabled');
    },

    finishSave: function() {
      this.$('.survey-save-inprogress').hide();
      this.$('.save-btn').removeAttr('disabled');
    },

    getSurvey: function() {
      if (!this.survey)
        this.survey = this.model;

      return this.survey;
    },

    getPlace: function() {
      return this.placeModel;
    },

    invalidInput: function() {
      var firstInvalidEl;

      this.$('form').find('input, select, textarea').each(function(i, el) {
        if (!el.validity.valid) {
          firstInvalidEl = el;
          return false;
        }
      });

      return firstInvalidEl;
    },

    onFormSubmit: function(evt) {
      evt.preventDefault();

      // Validate manually, in case HTML5 validation doesn't happen
      var firstInvalidEl = this.invalidInput();

      if (firstInvalidEl) {
        $(firstInvalidEl).focus();
      } else {
        this.saveSurvey();
      }
    },

    saveSurvey: function() {
      var attrs = this.getAttrs(),
          place = this.getPlace(),
          survey = this.getSurvey(),
          self = this,
          saveOpts = {
            complete: function() {
              // Regardless of whether the save was successful, hide the save
              // progress box, and re-enable the buttons.
              self.finishSave();
            },
            success: function() {
              // On successful save, show the success box and fade it out
              // after a couple of seconds.
              self.$('.survey-save-success').show();
              _.delay(function() { self.$('.survey-save-success').fadeOut(); }, 2000);

              // Mark the form as clean.
              self.isDirty = false;
            },
            error: function() {
              // Display a clone of the error modal, in case this view is no
              // longer displayed.
              self.$('.survey-save-error').clone().modal('show');
            }
          },
          attr;

      this.startSave();

      if (survey) {
        for (attr in survey.attributes) {
          if (attr !== 'id' && !_.has(attrs, attr)) {
            survey.unset(attr);
          }
        }

        survey.save(attrs, saveOpts);
        S.currentUser = attrs['submitter_name'];
      } else {
        place.responseCollection.create(attrs, saveOpts);
      }
    },

    initializeFieldSet: function(fieldset, surveyData) {
      var self = this;
      _.each(fieldset.items, function(item) {
        if (item.type === 'fieldset') {
          self.initializeFieldSet(item, surveyData);
        } else {
          item.value = surveyData[item.name];
        }
      });
    },

    render: function() {
     var placeData,
         survey,
         surveyData,
         surveyConfig,
         html;

      placeData = this.placeModel.toJSON();
      survey = this.model;
      surveyData = (survey ? survey.toJSON() : {});
      surveyConfig = S.config.survey;

      this.initializeFieldSet(surveyConfig, surveyData);

      html = this.template({place: placeData, survey: surveyData, survey_config: surveyConfig});
      this.$el.html(html);
      this.updateConditionalFields();

      this.$('.switch').bootstrapSwitch();

      // Take all the toggle check boxes and turn them into buttons
      this.$('.toggle button').on('click', function() {
        var $btn = $(this),
            $checkbox = $btn.siblings('input[type="checkbox"]');
        $checkbox.click();
        $btn.toggleClass('btn-primary');
      });

      return this;
    }
  });

}(jQuery, Surveyor));
