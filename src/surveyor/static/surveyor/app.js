var Surveyor = Surveyor || {};

(function($, S) {

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
      var data = this.collection.toJSON();
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
      var data = this.model.toJSON();
      html = this.template(data);
      this.$el.html(html);
      return this;
    }
  });

}(jQuery, Surveyor));
