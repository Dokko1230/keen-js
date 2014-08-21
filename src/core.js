  /*!
  * ----------------
  * Keen IO Core JS
  * ----------------
  */

  function Keen(config) {
    return _init.apply(this, arguments);
  }

  Keen.loaded = false;

  Keen.prototype.configure = function(config){

    config['host'] = (_isUndefined(config['host'])) ? 'api.keen.io/3.0' : config['host'].replace(/.*?:\/\//g, '');
    config['protocol'] = _set_protocol(config['protocol']);
    config['requestType'] = _set_request_type(config['requestType']);

    this.client = {
      projectId: config.projectId,
      writeKey: config.writeKey,
      readKey: config.readKey,
      globalProperties: null,

      endpoint: config['protocol'] + "://" + config['host'],
      requestType: config['requestType']
    };

    Keen.trigger('client', this, config);
    this.trigger('ready');

    return this;
  };

  // -------------------------------
  // Keen.Events
  // We <3 BackboneJS!
  // -------------------------------
  var Events = Keen.Events = {
    on: function(name, callback) {
      this.listeners || (this.listeners = {});
      var events = this.listeners[name] || (this.listeners[name] = []);
      events.push({callback: callback});
      return this;
    },
    once: function(name, callback, context) {
      var self = this;
      var once = _once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return self.on(name, once, context);
    },
    off: function(name, callback, context) {
      if (!this.listeners) return this;

      // Remove all callbacks for all events.
      if (!name && !callback && !context) {
        this.listeners = void 0;
        return this;
      }

      var names = [];
      if (name) {
        names.push(name);
      } else {
        _each(this.listeners, function(value, key){
          names.push(key);
        });
      }

      for (var i = 0, length = names.length; i < length; i++) {
        name = names[i];

        // Bail out if there are no events stored.
        var events = this.listeners[name];
        if (!events) continue;

        // Remove all callbacks for this event.
        if (!callback && !context) {
          delete this.listeners[name];
          continue;
        }

        // Find any remaining events.
        var remaining = [];
        for (var j = 0, k = events.length; j < k; j++) {
          var event = events[j];
          if (
            callback && callback !== event.callback &&
            callback !== event.callback._callback ||
            context && context !== event.context
          ) {
            remaining.push(event);
          }
        }

        // Replace events if there are any remaining.  Otherwise, clean up.
        if (remaining.length) {
          this.listeners[name] = remaining;
        } else {
          delete this.listeners[name];
        }
      }

      return this;
    },
    trigger: function(name) {
      if (!this.listeners) return this;
      var args = Array.prototype.slice.call(arguments, 1);
      var events = this.listeners[name] || [];
      for (var i = 0; i < events.length; i++) {
        events[i]['callback'].apply(this, args);
      }
      return this;
    }
  };

  _extend(Keen.prototype, Events);
  _extend(Keen, Events);

  // Expose utils
  Keen.utils = {
    each: _each,
    extend: _extend,
    parseParams: _parse_params,
    prettyNumber: _pretty_number,
    loadScript: _load_script,
    loadStyle: _load_style
  };

  Keen.ready = function(callback){
    if (Keen.loaded) {
      callback();
    } else {
      Keen.on('ready', callback);
    }
  };

  Keen.log = function(message) {
    if (typeof console == "object") {
      console.log('[Keen IO]', message);
    }
  };
