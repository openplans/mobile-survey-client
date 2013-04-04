/*globals jQuery Backbone moment Handlebars _ L */

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
      S.placeCollection.fetch({reset: true});
    },

    placeForm: function(placeId) {
      console.log('At the form for ' + placeId);
      S.placeFormViews[placeId].render();
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
      console.log('render called');
      var data = this.collection.toJSON(),
          html = this.template({'places': data});
      this.$el.html(html);
      this.prettifyTimes();
      return this;
    }
  });

  S.PlaceFormView = Backbone.View.extend({
    initialize: function() {
      var templateSource = $('#place-form-tpl').html();
      this.template = Handlebars.compile(templateSource);
    },

    render: function() {
      var data = this.model.toJSON(),
          html = this.template(data);
      this.$el.html(html);
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

      // Init geolocation
      if (mapConfig.geolocation_enabled) {
        self.initGeolocation();
      }
    },
    initGeolocation: function() {
      var self = this,
          currentLocationMarkers = L.layerGroup([]).addTo(self.map);

      var onLocationError = function(evt) {
        var message;
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
        var msg;

        console.log(evt);
        if(!self.map.options.maxBounds || self.map.options.maxBounds.contains(evt.latlng)) {
          self.map.fitBounds(evt.bounds);

          var radius = evt.accuracy / 2;

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
