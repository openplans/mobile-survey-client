/*globals jQuery Backbone moment Handlebars _ L Spinner */

var Surveyor = Surveyor || {};

(function($, S) {
  'use strict';

  S.Router = Backbone.Router.extend({
    routes : {
      '':         'placeList',
      ':placeId': 'placeForm'
    },

    initPlaceCollection: function(locateOptions) {
      if (S.currentLocation) {
        S.fetchNearbyPlaces(S.currentLocation.latlng.lat, S.currentLocation.latlng.lng);
      } else {
        S.mapView.map.locate(locateOptions);
      }
    },

    needsConfirmation: function() {
      if (S.currentContentView && S.currentContentView.confirmLeave) {
        return S.currentContentView.confirmLeave();
      }

      return false;
    },

    hideBackButton: function() {
      $('.back-btn').hide();
    },

    placeList: function() {
      // If we need to confirm something before moving on, then do so. The
      // confirmation method is responsible for restarting the routing.
      if (this.needsConfirmation())
        return;

      this.hideBackButton();

      S.contentView.showView(S.placeListView.render());

      // Init nearby places if we need them
      if (S.placeCollection.size() === 0) {
        this.initPlaceCollection({setView: true});
      } else {
        S.mapView.viewLayers.clearLayers();
        if (S.currentLocation) {
          S.mapView.map.fitBounds(S.currentLocation.bounds);
        } else {
          S.mapView.map.setView([S.config.map.options.center.lat, S.config.map.options.center.lng], S.config.map.options.zoom);
        }
      }
    },

    placeForm: function(placeId) {
      $('.back-btn').show();

      var placeFormView, place,
          createPlaceFormView = function(place) {
            S.placeFormViews[placeId] = placeFormView = new S.PlaceFormView({
              model: place,
              template: S.placeFormTemplate,
              layerGroup: S.mapView.viewLayers
            });
            S.contentView.showView(placeFormView.render());
          };

      // Init nearby places if we need them
      if (S.placeCollection.size() === 0) {
        this.initPlaceCollection();
      }

      // If the place is loaded and we already have a view for it...
      placeFormView = S.placeFormViews[placeId];
      if (placeFormView) {
        S.contentView.showView(placeFormView.render());
        return;
      }

      // If the place is loaded, but there's no view yet...
      place = S.placeCollection.get(placeId);
      if (place) {
        createPlaceFormView(place);
        return;
      }

      // If the place is not yet loaded...
      S.placeCollection.add({id: placeId});
      place = S.placeCollection.get(placeId);

      // Render an empty place with a spinner, it will update on model change
      createPlaceFormView(place);

      place.fetch({
        data: {
          include_submissions: true
        }
      });
    }
  });

  S.NavbarView = Backbone.View.extend({
    events: {
      'click .back-btn': 'goBack',
      'click a:not(.back-btn)': 'navigate'
    },

    goBack: function(evt) {
      evt.preventDefault();
      Backbone.history.history.back();
    },

    navigate: function(evt) {
      evt.preventDefault();
      S.router.navigate(evt.target.getAttribute('href'), {trigger: true});
    }
  });

  S.ContentView = Backbone.View.extend({
    events: {
      'click a': 'navigate'
    },

    showView: function(view) {
      S.currentModel = view.model;
      S.currentContentView = view;

      view.delegateEvents();
      this.$el.html(view.el);
    },

    navigate: function(evt) {
      evt.preventDefault();
      S.router.navigate(evt.target.getAttribute('href'), {trigger: true});
    }
  });

  S.PlaceListView = Backbone.View.extend({
    initialize: function() {
      this.template = this.options.template;
      this.collection.on('reset', this.render, this);
      this.collection.on('sort', this.render, this);
    },

    prettifyTimes: function() {
      this.$('time').each(function(i, t) {
        var $time = $(t),
            datetime = new Date($time.text());
        $time.html(moment(datetime).fromNow());
      });
    },

    render: function() {
      var data, html;

      if (this.collection.size() > 0) {
        data = this.collection.toJSON();
        html = this.template({'places': this.collection});

        this.$el.html(html);
        this.prettifyTimes();
      } else {
        // Show a spinner
        S.loadSpinner.spin(this.el);
      }

      return this;
    }
  });

  S.PlaceFormView = Backbone.View.extend({
    initialize: function() {
      this.template = this.options.template;
      this.model.on('change', this.render, this);
    },

    events: {
      'change input, textarea, select': 'onInputChanged',
      'submit form': 'saveSurvey',
      'click .discard-confirmation .yes-btn': 'discardChanges'
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

      // Disable the discard button
      this.$('.discard-btn').attr('disabled', 'disabled');
    },

    finishSave: function() {
      this.$('.survey-save-inprogress').hide();
      this.$('.save-btn').removeAttr('disabled');
      this.$('.discard-btn').removeAttr('disabled');
    },

    getSurvey: function() {
      if (!this.survey)
        this.survey = this.model.responseCollection.first();

      return this.survey;
    },

    getPlace: function() {
      return this.model;
    },

    saveSurvey: function(evt) {
      evt.preventDefault();

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
          };

      this.startSave();

      if (survey) {
        survey.save(attrs, saveOpts);
        S.currentUser = attrs['submitter_name'];
      } else {
        place.responseCollection.create(attrs, saveOpts);
      }
    },

    render: function() {
     var placeData,
         survey,
         surveyData,
         surveyConfig,
         html;

      if (this.model.has('location')) {
        placeData = this.model.toJSON();
        survey = this.model.responseCollection.first();
        surveyData = (survey ? survey.toJSON() : {});
        surveyConfig = S.config.survey;

        _.each(surveyConfig.items, function(item) {
          item.value = surveyData[item.name];
        });

        html = this.template({place: placeData, survey: surveyData, survey_config: surveyConfig});
        this.$el.html(html);
        this.updateConditionalFields();

        if (this.options.layerGroup) {
          this.options.layerGroup.clearLayers();
          this.layer = L.marker([placeData.location.lat, placeData.location.lng]).addTo(this.options.layerGroup);
        }
      } else {
        // Show a spinner
        S.loadSpinner.spin(this.el);
      }

      this.$('.switch').bootstrapSwitch();

      // Take all the toggle check boxes and turn them into buttons
      this.$('.toggle button').on('click', function() {
        var $btn = $(this),
            $checkbox = $btn.siblings('input[type="checkbox"]');
        $checkbox.click();
      });

      return this;
    }
  });

  S.MapView = Backbone.View.extend({
    events: {
      'click .locate-me': 'handleGeolocateClick'
    },
    initialize: function() {
      var self = this,
          mapConfig = self.options.mapConfig,
          baseLayer = L.tileLayer(mapConfig.base_layer.url, mapConfig.base_layer);

      // Init the map
      self.map = L.map(self.el, mapConfig.options);
      self.map.addLayer(baseLayer);

      // Init layer group for views
      self.viewLayers = L.featureGroup().addTo(self.map);
      self.viewLayers.on('layeradd', function(evt){
        self.map.fitBounds(self.viewLayers.getBounds());
      });

      // Remove default prefix
      self.map.attributionControl.setPrefix('');

      // If not, init geolocation
      if (mapConfig.geolocation_enabled) {
        this.initGeolocation();
      }
    },

    initGeolocation: function() {
      var self = this;

      this.locateControl = L.control.locate({
        onLocationError: function() {}
      }).addTo(this.map);
      this.locateControl._active = true;

      var onLocationError = function(evt) {
        var mapOptions = self.options.mapConfig.options,
            message;

        switch (evt.code) {
          // Unknown
          case 0:
            message = 'An unknown error occured while locating your position. Please try again.';
            break;
          // Permission Denied
          case 1:
            message = 'Geolocation is disabled for this page. Please adjust your browser settings.';
            break;
          // Position Unavailable
          case 2:
            message = 'Your location could not be determined. Please try again.';
            break;
          // Timeout
          case 3:
            message = 'It took too long to determine your location. Please try again.';
            break;
        }

        self.trigger('locationerror', evt);
        window.alert(message);
      };

      var onLocationFound = function(evt) {
        self.trigger('locationfound', evt);
      };

      // Bind event handling
      this.map.on('locationerror', onLocationError);
      this.map.on('locationfound', onLocationFound);
    },
    handleGeolocateClick: function(evt) {
      if (evt) {
        evt.preventDefault();
      }

      this.map.locate();
    }
  });


}(jQuery, Surveyor));
