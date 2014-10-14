  /*!
  * ----------------
  * Keen IO Core JS
  * ----------------
  */

  function Keen(config) {
    return _init.apply(this, arguments);
  }

  function _init(config) {
    if (_isUndefined(config)) {
      throw new Error("Check out our JavaScript SDK Usage Guide: https://keen.io/docs/clients/javascript/usage-guide/");
    }
    if (_isUndefined(config.projectId) || _type(config.projectId) !== 'String' || config.projectId.length < 1) {
      throw new Error("Please provide a projectId");
    }

    this.configure(config);
  }

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


  // Private
  // --------------------------------

  function _extend(target){
    for (var i = 1; i < arguments.length; i++) {
      for (var prop in arguments[i]){
        // if ((target[prop] && _type(target[prop]) == 'Object') && (arguments[i][prop] && _type(arguments[i][prop]) == 'Object')){
        target[prop] = arguments[i][prop];
      }
    }
    return target;
  }

  function _isUndefined(obj) {
    return obj === void 0;
  }

  function _type(obj){
    var text, parsed;
    text = (obj && obj.constructor) ? obj.constructor.toString() : void 0;
    if (text) {
      parsed = text.split("(")[0].split(/function\s*/);
      if (parsed.length > 0) {
        return parsed[1];
      }
    }
    return "Null";
	  //return (text) ? text.match(/function (.*)\(/)[1] : "Null";
  }

  function _each(o, cb, s){
    var n;
    if (!o){
      return 0;
    }
    s = !s ? o : s;
    if (_type(o)==='array'){ // is(o.length)
      // Indexed arrays, needed for Safari
      for (n=0; n<o.length; n++) {
        if (cb.call(s, o[n], n, o) === false){
          return 0;
        }
      }
    } else {
      // Hashtables
      for (n in o){
        if (o.hasOwnProperty(n)) {
          if (cb.call(s, o[n], n, o) === false){
            return 0;
          }
        }
      }
    }
    return 1;
  }

  function _once(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  }

  function _parse_params(str){
    // via http://stackoverflow.com/a/2880929/2511985
    var urlParams = {},
        match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = str.split("?")[1];

    while (!!(match=search.exec(query))) {
      urlParams[decode(match[1])] = decode(match[2]);
    }
    return urlParams;
  }

  function _set_protocol(value) {
    switch(value) {
      case 'http':
        return 'http';
        break;
      case 'auto':
        return location.protocol.replace(/:/g, '');
        break;
      case 'https':
      case undefined:
      default:
        return 'https';
        break;
    }
  }

  function _set_request_type(value) {
    var configured = value || 'jsonp';
    var capableXHR = false;
    if ((_type(XMLHttpRequest)==='Object'||_type(XMLHttpRequest)==='Function') && 'withCredentials' in new XMLHttpRequest()) {
      capableXHR = true;
      Keen.canXHR = true;
    }

    if (configured == null || configured == 'xhr') {
      if (capableXHR) {
        return 'xhr';
      } else {
        return 'jsonp';
      }
    } else {
      return configured;
    }
  }

  function _build_url(path) {
    return this.client.endpoint + '/projects/' + this.client.projectId + path;
  }


  // -------------------------------
  // XHR, JSONP, Beacon utilities
  // -------------------------------

  function _sendXhr(method, url, headers, body, success, error){
    var ids = ['MSXML2.XMLHTTP.3.0', 'MSXML2.XMLHTTP', 'Microsoft.XMLHTTP'],
        successCallback = success,
        errorCallback = error,
        payload,
        xhr;

    success = null;
    error = null;

    if (window.XMLHttpRequest) {
      xhr = new XMLHttpRequest();
    }
    else {
      // Legacy IE support: look up alts if XMLHttpRequest is not available
      for (var i = 0; i < ids.length; i++) {
        try {
          xhr = new ActiveXObject(ids[i]);
          break;
        } catch(e) {}
      }
    }

    xhr.onreadystatechange = function() {
      var response;
      if (xhr.readyState == 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            response = JSON.parse(xhr.responseText);
          } catch (e) {
            Keen.log("Could not parse HTTP response: " + xhr.responseText);
            if (errorCallback) {
              errorCallback(xhr, e);
              successCallback = errorCallback = null;
            }
          }
          if (successCallback && response) {
            successCallback(response);
            successCallback = errorCallback = null;
          }
        } else {
          Keen.log("HTTP request failed.");
          if (errorCallback) {
            errorCallback(xhr, null);
            successCallback = errorCallback = null;
          }
        }
      }
    };

    xhr.open(method, url, true);

    _each(headers, function(value, key){
      xhr.setRequestHeader(key, value);
    });

    if (body) {
      payload = JSON.stringify(body);
    }

    if (method && method.toUpperCase() === "GET") {
      xhr.send();
    } else if (method && method.toUpperCase() === "POST") {
      xhr.send(payload);
    }

  }

  function _sendJsonp(url, params, success, error){
    var timestamp = new Date().getTime(),
        successCallback = success,
        errorCallback = error,
        script = document.createElement("script"),
        parent = document.getElementsByTagName("head")[0],
        callbackName = "keenJSONPCallback",
        scriptId = "keen-jsonp",
        loaded = false;

    success = null;
    error = null;

    callbackName += timestamp;
    scriptId += timestamp;

    while (callbackName in window) {
      callbackName += "a";
    }
    window[callbackName] = function (response) {
      loaded = true;
      if (successCallback && response) {
        successCallback(response);
      };
      parent.removeChild(script);
      delete window[callbackName];
      successCallback = errorCallback = null;
    };

    script.id = scriptId;
    script.src = url + "&jsonp=" + callbackName;

    parent.appendChild(script);

    // for early IE w/ no onerror event
    script.onreadystatechange = function() {
      if (loaded === false && this.readyState === "loaded") {
        loaded = true;
        if (errorCallback) {
          errorCallback();
          successCallback = errorCallback = null;
        }
      }
    };

    // non-ie, etc
    script.onerror = function() {
      // on IE9 both onerror and onreadystatechange are called
      if (loaded === false) {
        loaded = true;
        if (errorCallback) {
          errorCallback();
          successCallback = errorCallback = null;
        }
      }
    };
  }

  function _sendBeacon(url, params, success, error){
    var successCallback = success,
        errorCallback = error,
        loaded = false,
        img = document.createElement("img");

    success = null;
    error = null;

    img.onload = function() {
      loaded = true;
      if ('naturalHeight' in this) {
        if (this.naturalHeight + this.naturalWidth === 0) {
          this.onerror();
          return;
        }
      } else if (this.width + this.height === 0) {
        this.onerror();
        return;
      }
      if (successCallback) {
        successCallback({created: true});
        successCallback = errorCallback = null;
      }
    };
    img.onerror = function() {
      loaded = true;
      if (errorCallback) {
        errorCallback();
        successCallback = errorCallback = null;
      }
    };
    img.src = url + "&c=clv1";
  }


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

  Keen.loaded = true;

  Keen.urlMaxLength = 16000;
  if (navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0) {
    Keen.urlMaxLength = 2000;
  }

  // Expose utils
  Keen.utils = {
    each: _each,
    extend: _extend,
    parseParams: _parse_params
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

  // -------------------------------
  // Keen.Plugins
  // -------------------------------

  var Plugins = Keen.Plugins = {};
