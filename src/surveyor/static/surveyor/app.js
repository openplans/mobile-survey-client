/*globals jQuery Backbone moment Handlebars _ L Spinner */

var Surveyor = Surveyor || {};

(function($, S) {
  'use strict';

  S.Router = Backbone.Router.extend({
    routes : {
      '':         'placeList',
      ':placeId': 'placeForm'
    },

    placeList: function() {
      console.log('At the list');

      // Check whether we already have places...
      if (S.placeCollection.size() > 0) {
        S.placeListView.render();
        S.contentView.showView(S.placeListView);
        return;
      }

      // If not, init geolocation
      if (S.config.map.geolocation_enabled) {
        S.mapView.initGeolocation();
      }

      S.contentView.showSpinner();
    },

    placeForm: function(placeId) {
      var placeFormView, place,
          createPlaceFormView = function() {
            S.placeFormViews[placeId] = placeFormView = new S.PlaceFormView({
              model: place,
              template: S.placeFormTemplate
            });
            placeFormView.render();
            S.contentView.showView(placeFormView);
          };
      console.log('At the form for ' + placeId);

      // If the place is loaded and we already have a view for it...
      placeFormView = S.placeFormViews[placeId];
      if (placeFormView) {
        S.contentView.showView(placeFormView);
        return;
      }

      // If the place is loaded, but there's no view yet...
      place = S.placeCollection.get(placeId);
      if (place) {
        createPlaceFormView();
        return;
      }

      // If the place is not yet loaded...
      S.placeCollection.add({id: placeId});
      place = S.placeCollection.get(placeId);
      place.fetch({
        data: {
          include_submissions: true
        },
        success: function() {
          createPlaceFormView();
        }
      });

      S.contentView.showSpinner();
    }
  });

  S.ContentView = Backbone.View.extend({
    events: {
      'click a': 'navigate'
    },
    showSpinner: function() {
      var opts = {
            lines: 13, // The number of lines to draw
            length: 20, // The length of each line
            width: 10, // The line thickness
            radius: 30, // The radius of the inner circle
            corners: 1, // Corner roundness (0..1)
            rotate: 0, // The rotation offset
            direction: 1, // 1: clockwise, -1: counterclockwise
            color: '#000', // #rgb or #rrggbb
            speed: 1, // Rounds per second
            trail: 60, // Afterglow percentage
            shadow: false, // Whether to render a shadow
            hwaccel: false, // Whether to use hardware acceleration
            className: 'load-spinner', // The CSS class to assign to the spinner
            zIndex: 2e9, // The z-index (defaults to 2000000000)
            top: 'auto', // Top position relative to parent in px
            left: 'auto' // Left position relative to parent in px
          },
          spinner = new Spinner(opts).spin(this.el);
    },

    showView: function(view) {
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
      console.log('initialized');
    },

    prettifyTimes: function() {
      this.$('time').each(function(i, t) {
        var $time = $(t),
            datetime = new Date($time.text());
        $time.html(moment(datetime).fromNow());
      });
    },

    render: function() {
      var data = this.collection.toJSON(),
          html = this.template({'places': data});
      this.$el.html(html);
      this.prettifyTimes();
      return this;
    }
  });

  S.PlaceFormView = Backbone.View.extend({
    initialize: function() {
      this.template = this.options.template;
    },

    events: {
      'change input, textarea, select': 'updateConditionalFields',
      'submit form': 'saveSurvey'
    },

    updateConditionalFields: function() {
      var self = this;

      // Go through each of the fields for this survey. If one of them has a
      // condition-field data attribute, then only show it if the value of that
      // field is equal to the condition-value data attribute.
      self.$('.survey-field').each(function(i, field) {
        var $field = $(field),
            conditionField = $field.attr('data-condition-field'),
            conditionValue = $field.attr('data-condition-value'),
            $conditionField;

        if (conditionField) {
          // Get the field that this field depends on
          $conditionField = self.$('[name="' + conditionField + '"]');

          switch ($conditionField.attr('type')) {
            // Checkboxes are special. Their value is always 'on', so check
            // whether it's checked instead.
            case 'checkbox':
              if (($conditionField.is(':checked') && conditionValue === 'checked') ||
                  ($conditionField.is(':not(:checked)') && conditionValue === 'unchecked')) {
                $field.show();
              } else {
                $field.hide();
              }
              break;

            // For everything else, just check that the value matches.
            default:
              if ($conditionField.val() === conditionValue) {
                $field.show();
              } else {
                $field.hide();
              }
          }
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

    saveSurvey: function(evt) {
      evt.preventDefault();

      var attrs = this.getAttrs(),
          survey = this.model.responseCollection.first(),
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
              _.delay(function() { self.$('.survey-save-success').fadeOut(); }, 2000)
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
      } else {
        this.model.responseCollection.create(attrs, saveOpts);
      }
    },

    render: function() {
      var placeData = this.model.toJSON(),
          survey = this.model.responseCollection.first(),
          surveyData = (survey ? survey.toJSON() : {}),
          surveyConfig = S.config.survey,
          html;

      _.each(surveyConfig.items, function(item) {
        item.value = surveyData[item.name];
      });

      html = this.template({place: placeData, survey: surveyData, survey_config: surveyConfig});
      this.$el.html(html);
      this.updateConditionalFields();
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

      // Remove default prefix
      self.map.attributionControl.setPrefix('');
    },
    initGeolocation: function() {
      var self = this,
          currentLocationMarkers = L.layerGroup([]).addTo(self.map);

      var onLocationError = function(evt) {
        var mapOptions = self.options.mapConfig.options,
            message;

        // Fetch new data near this place
        self.collection.fetch({
          reset: true,
          data: {
            near: mapOptions.center.lat+','+mapOptions.center.lng
          }
        });
        self.map.setView([mapOptions.center.lat, mapOptions.center.lng], mapOptions.zoom);

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
        window.alert(message);
      };

      var onLocationFound = function(evt) {
        var msg, radius;

        if(!self.map.options.maxBounds || self.map.options.maxBounds.contains(evt.latlng)) {
          // Fetch new data near this place
          self.collection.fetch({
            reset: true,
            data: {
              near: evt.latlng.lat+','+evt.latlng.lng
            },
            success: function() {
              S.contentView.showView(S.placeListView);
            }
          });

          self.map.fitBounds(evt.bounds);

          radius = evt.accuracy / 2;
          currentLocationMarkers.clearLayers();

          currentLocationMarkers.addLayer(L.circleMarker(evt.latlng, {
            radius: 4,
            weight: 2,
            color: '#06f',
            fillOpacity: 1
          }));

          currentLocationMarkers.addLayer(L.circle(evt.latlng, radius, {
            weight: 1,
            color: '#06f',
            fillOpacity: 0.1
          }));
        } else {
          msg = 'It looks like you\'re not in a place where we\'re collecting ' +
            'data. I\'m going to leave the map where it is, okay?';
          window.alert(msg);
        }
      };

      // Add the geolocation control link
      this.$('.leaflet-top.leaflet-right').append(
        '<div class="leaflet-control-zoom leaflet-control-locate leaflet-bar leaflet-control"><a class="locate-me leaflet-bar-part" href="#" title="Zoom out"><div>➤</div></a></div>'
      );

      // Bind event handling
      this.map.on('locationerror', onLocationError);
      this.map.on('locationfound', onLocationFound);

      // Go to the current location if specified
      if (this.options.mapConfig.geolocation_onload) {
        this.map.locate();
      }
    },
    handleGeolocateClick: function(evt) {
      if (evt) {
        evt.preventDefault();
      }

      this.map.locate();
    }
  });


}(jQuery, Surveyor));
