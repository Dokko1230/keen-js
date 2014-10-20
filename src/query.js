  /*!
  * -----------------
  * Keen IO Query JS
  * -----------------
  */


  // -------------------------------
  // Inject <client>.query Method
  // -------------------------------

  Keen.prototype.run = function(query, success, error) {
    var queries = [],
        successCallback = success,
        errorCallback = error;

    success = null;
    error = null;

    if (query instanceof Array) {
      queries = query;
    } else {
      queries.push(query);
    }
    var req = new Keen.Request(this, queries, successCallback, errorCallback);
    successCallback = errorCallback = null;
    return req;
  };


  // -------------------------------
  // Keen.Request
  // -------------------------------

  Keen.Request = function(instance, queries, success, error){
    var successCallback = success,
        errorCallback = error;

    success = null;
    error = null;

    this.configure(instance, queries, successCallback, errorCallback);
    successCallback = errorCallback = null;
  };
  _extend(Keen.Request.prototype, Events);

  Keen.Request.prototype.configure = function(instance, queries, success, error){
    this.instance = instance;
    this.queries = queries;
    this.data;

    this.success = success;
    success = null;

    this.error = error;
    error = null;

    this.refresh();
    return this;
  };

  Keen.Request.prototype.refresh = function(){

    var self = this,
        completions = 0,
        response = [];

    var handleSuccess = function(res, index){
      response[index] = res;
      self.queries[index].data = res;
      self.queries[index].trigger("complete", self.queries[index].data);

      // Increment completion count
      completions++;
      if (completions == self.queries.length) {

        // Attach response/meta data to query
        if (self.queries.length == 1) {
          self.data = response[0];
        } else {
          self.data = response;
        }

        // Trigger completion event on query
        self.trigger("complete", self.data);

        // Fire callback
        if (self.success) {
          self.success(self.data);
        }
      }

    };

    var handleFailure = function(res, req){
      var response, status;
      if (res) {
        response = JSON.parse(res.responseText);
        status = res.status + " " + res.statusText;
      } else {
        response = {
          message: "Your query could not be completed, and the exact error message could not be captured (limitation of JSONP requests)",
          error_code: "JS SDK"
        };
        status = "Error";
      }

      self.trigger("error", response);
      if (self.error) {
        self.error(response);
      }
      Keen.log(status + " (" + response.error_code + "): " + response.message);
    };

    _each(self.queries, function(query, index){
      var url;
      var successSequencer = function(res){
        handleSuccess(res, index);
      };
      var failureSequencer = function(res){
        handleFailure(res, index);
      };

      if (query instanceof Keen.Query) {
        url = self.instance.url("/projects/" + self.instance.projectId() + query.path);
        _sendQuery.call(self.instance, url, query.params, successSequencer, failureSequencer);
      }
      else if ( Object.prototype.toString.call(query) === '[object String]' ) {
        url = self.instance.url("/projects/" + self.instance.projectId() + "/saved_queries/" + encodeURIComponent(query) + "/result");
        _sendQuery.call(self.instance, url, null, successSequencer, failureSequencer);
      }
      else {
        var res = {
          statusText: 'Bad Request',
          responseText: { message: 'Error: Query ' + (+index+1) + ' of ' + self.queries.length + ' for project ' + self.instance.projectId() + ' is not a valid request' }
        };
        Keen.log(res.responseText.message);
        Keen.log('Check out our JavaScript SDK Usage Guide for Data Analysis:');
        Keen.log('https://keen.io/docs/clients/javascript/usage-guide/#analyze-and-visualize');
        if (self.error) {
          self.error(res.responseText.message);
        }
      }
    });
    return this;
  };


  // -------------------------------
  // Keen.Query
  // -------------------------------

  Keen.Query = function(){
    this.configure.apply(this, arguments);
  };
  _extend(Keen.Query.prototype, Events);

  Keen.Query.prototype.configure = function(analysisType, params) {
    this.analysis = analysisType;
    this.path = '/queries/' + analysisType;

    // Apply params w/ #set method
    this.params = this.params || {};
    this.set(params);

    // Localize timezone if none is set
    if (this.params.timezone === void 0) {
      this.params.timezone = _getTimezoneOffset();
    }
    return this;
  };

  Keen.Query.prototype.get = function(attribute) {
    var key = attribute;
    if (key.match(new RegExp("[A-Z]"))) {
      key = key.replace(/([A-Z])/g, function($1) { return "_"+$1.toLowerCase(); });
    }
    if (this.params) {
      return this.params[key] || null;
    }
  };

  Keen.Query.prototype.set = function(attributes) {
    var self = this;
    _each(attributes, function(v, k){
      var key = k, value = v;
      if (k.match(new RegExp("[A-Z]"))) {
        key = k.replace(/([A-Z])/g, function($1) { return "_"+$1.toLowerCase(); });
      }
      self.params[key] = value;
      if (value instanceof Array) {
        _each(value, function(dv, index){
          if (dv instanceof Array == false && typeof dv === "object") { //  _type(dv)==="Object"
            _each(dv, function(deepValue, deepKey){
              if (deepKey.match(new RegExp("[A-Z]"))) {
                var _deepKey = deepKey.replace(/([A-Z])/g, function($1) { return "_"+$1.toLowerCase(); });
                delete self.params[key][index][deepKey];
                self.params[key][index][_deepKey] = deepValue;
              }
            });
          }
        });
      }
    });
    return self;
  };

  Keen.Query.prototype.addFilter = function(property, operator, value) {
    this.params.filters = this.params.filters || [];
    this.params.filters.push({
      "property_name": property,
      "operator": operator,
      "property_value": value
    });
    return this;
  };


  // Private
  // --------------------------------

  function _getTimezoneOffset(){
    return new Date().getTimezoneOffset() * -60;
  };

  function _getQueryString(params){
    var query = [];
    for (var key in params) {
      if (params[key]) {
        var value = params[key];
        if (Object.prototype.toString.call(value) !== '[object String]') {
          value = JSON.stringify(value);
        }
        value = encodeURIComponent(value);
        query.push(key + '=' + value);
      }
    }
    return "&" + query.join('&');
  };


  function _sendQuery(url, params, success, error){
    var urlBase = url,
        urlQueryString = "",
        reqType = this.config.requestType,
        successCallback = success,
        errorCallback = error;

    success = null;
    error = null;

    if (urlBase.indexOf("extraction") > -1) {
      // Extractions do not currently support JSONP
      reqType = "xhr";
    }
    urlQueryString += "?api_key=" + this.readKey();
    urlQueryString += _getQueryString.call(this, params);

    if (reqType !== "xhr") {
      if ( String(urlBase + urlQueryString).length < Keen.urlMaxLength ) {
        _sendJsonp(urlBase + urlQueryString, null, successCallback, errorCallback);
        return;
      }
    }

    if (Keen.canXHR) {
      _sendXhr("GET", urlBase + urlQueryString, null, null, successCallback, errorCallback);
    } else {
      Keen.log("Event not sent: URL length exceeds current browser limit, and XHR (POST) is not supported.");
    }
    successCallback = errorCallback = null;
    return;
  }
