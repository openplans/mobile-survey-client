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

    placeList: function() {
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
      var placeFormView, place,
          createPlaceFormView = function() {
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
        createPlaceFormView();
        return;
      }

      // If the place is not yet loaded...
      S.placeCollection.add({id: placeId});
      place = S.placeCollection.get(placeId);

      // Render an empty place with a spinner, it will update on model change
      createPlaceFormView();

      place.fetch({
        data: {
          include_submissions: true
        }
      });
    }
  });

  S.ContentView = Backbone.View.extend({
    events: {
      'click a': 'navigate'
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
        html = this.template({'places': data});

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

    saveSurvey: function(evt) {
      evt.preventDefault();

      var attrs = this.getAttrs(),
          survey = this.model.responseCollection.first();

      if (survey) {
        survey.save(attrs);
      } else {
        this.model.responseCollection.create(attrs);
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
      var self = this,
          currentLocationMarkers = L.layerGroup([]).addTo(self.map);

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
        var radius = evt.accuracy / 2,
            msg;

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

        self.trigger('locationfound', evt);
      };

      // Add the geolocation control link
      this.$('.leaflet-top.leaflet-right').append(
        '<div class="leaflet-control-zoom leaflet-control-locate leaflet-bar leaflet-control"><a class="locate-me leaflet-bar-part" href="#" title="Zoom out"><div>➤</div></a></div>'
      );

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
