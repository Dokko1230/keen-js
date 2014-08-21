  /*!
  * ----------------------
  * Keen IO Visualization
  * ----------------------
  */

  Keen.Spinner.defaults = {
    lines: 10, // The number of lines to draw
    length: 8, // The length of each line
    width: 3, // The line thickness
    radius: 10, // The radius of the inner circle
    corners: 1, // Corner roundness (0..1)
    rotate: 0, // The rotation offset
    direction: 1, // 1: clockwise, -1: counterclockwise
    color: '#4d4d4d', // #rgb or #rrggbb or array of colors
    speed: 1, // Rounds per second
    trail: 60, // Afterglow percentage
    shadow: false, // Whether to render a shadow
    hwaccel: false, // Whether to use hardware acceleration
    className: 'keen-spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: '50%', // Top position relative to parent
    left: '50%' // Left position relative to parent
  };

  Keen.prototype.draw = function(query, el, config) {
    // Find DOM element, set height, build spinner
    var config = config || {};
    var el = el;
    var spinner = new Keen.Spinner(Keen.Spinner.defaults).spin(el);

    var request = new Keen.Request(this, [query]);

    request.on("complete", function(){
      if (spinner) {
        spinner.stop();
      }
      this.draw(el, config);
    });

    request.on("error", function(response){
      spinner.stop();

      var errorConfig = Keen.utils.extend({
        error: response,
        el: el
      }, Keen.Visualization.defaults);
      new Keen.Visualization.libraries['keen-io']['error'](errorConfig);
    });

    return request;
  };


  // -------------------------------
  // Inject Request Draw Method
  // -------------------------------
  Keen.Request.prototype.draw = function(selector, config) {
    _build_visual.call(this, selector, config);
    this.on('complete', function(){
      _build_visual.call(this, selector, config);
    });
    return this;
  };

  function _build_visual(selector, config){
    if (this.visual) {
      this.visual.trigger("remove");
    }
    this.visual = new Keen.Visualization(this, selector, config);
  }


  // -------------------------------
  // Keen.Visualization
  // -------------------------------
  Keen.Visualization = function(dataset, el, config){
    return new Keen.Dataviz(config.chartType).prepare(el).setData(dataset).setConfig(config).render(el);
  };

  // *******************
  // START NEW CLEAN API
  // *******************

  Keen.Dataviz = function(chartType) {
    this.chartType = chartType;
    this.capabilities = []; // No capabilities by default;
    this.config = {};
    this.dataformSchema = {
      collection: 'result',
      select: true
    };
  };

  Keen.Dataviz.prototype.setData = function(dataset) {
    if (!dataset) {
      throw new Error('You must pass data to the setData() function.');
    }
    this.dataset = dataset;

    if (this.dataset instanceof Keen.Request) {
      this.data = (this.dataset.data instanceof Array) ? this.dataset.data[0] : this.dataset.data;
    } else {
      // Handle raw data
      // _transform() and handle as usual
      this.data = (this.dataset instanceof Array) ? this.dataset[0] : this.dataset;
    }

    // Set the visualization types this reqest can do.
    this.setVizTypes();

    // Set the capable chart types and default type for this viz.
    this.setCapabilities();

    return this;
  };

  Keen.Dataviz.prototype.setConfig = function(config) {
    if (!this.dataset) {
      throw new Error('You must provide data to a Keen.Dataviz object using the setData() function before calling config() on it.');
    }

    // Backwoods cloning facility
    var defaults = JSON.parse(JSON.stringify(Keen.Visualization.defaults));
    this.config = _extend(defaults, config);

    // Build default title if necessary to do so.
    if (!this.config.title && this.dataset instanceof Keen.Request) {
      this.buildDefaultTitle();
    }

    this.setDataformSchema();

    this.setSpecificChartOptions();

    this.config['data'] = (this.data) ? _transform.call(this.config, this.data, this.dataformSchema) : [];

    this.applyColorMapping();

    return this;
  };

  Keen.Dataviz.prototype.prepare = function(el) {
    this.config.el = el;
    this.config.el.innerHTML = "";
    this.spinner = new Keen.Spinner(Keen.Spinner.defaults).spin(this.config.el);
    return this;
  };

  Keen.Dataviz.prototype.buildDefaultTitle = function() {
    var self = this;
    this.config.title = (function(){
      var analysis = self.dataset.queries[0].analysis.replace("_", " "),
          collection = self.dataset.queries[0].get('event_collection'),
          output;

      output = analysis.replace( /\b./g, function(a){
        return a.toUpperCase();
      });

      if (collection) {
        output += ' - ' + collection;
      }
      return output;
    })();
  };

  Keen.Dataviz.prototype.setVizTypes = function() {
    if (this.dataset instanceof Keen.Request) {
      // Handle known scenarios
      this.isMetric = (typeof this.dataset.data.result === "number" || this.dataset.data.result === null) ? true : false,
      this.isFunnel = (this.dataset.queries[0].get('steps')) ? true : false,
      this.isInterval = (this.dataset.queries[0].get('interval')) ? true : false,
      this.isGroupBy = (this.dataset.queries[0].get('group_by')) ? true : false,
      this.is2xGroupBy = (this.dataset.queries[0].get('group_by') instanceof Array) ? true : false;
      this.isExtraction = (this.dataset.queries[0].analysis == 'extraction') ? true : false;
    } else {
      this.isMetric = (typeof this.dataset.result === "number" || this.dataset.result === null) ? true : false
    }
  };

  Keen.Dataviz.prototype.setCapabilities = function() {
    // Metric
    if (this.isMetric) {
      this.capabilities = ['metric'];
    }

    // GroupBy
    if (!this.isInterval && this.isGroupBy) {
      this.capabilities = ['piechart', 'barchart', 'columnchart', 'table'];
      if (this.config.chartType == 'barchart') {
        this.config.chartOptions.legend = { position: 'none' };
      }
    }

    // Single Interval
    if (this.isInterval && !this.isGroupBy) { // Series
      this.capabilities = ['areachart', 'barchart', 'columnchart', 'linechart', 'table'];
      if (this.config.library == 'google') {
        if (this.config.chartOptions.legend == void 0) {
          this.config.chartOptions.legend = { position: 'none' };
        }
      }

    }

    // GroupBy Interval
    if (this.isInterval && this.isGroupBy) {
      this.capabilities = ['linechart', 'areachart', 'barchart', 'columnchart', 'table'];
    }

    // Custom Dataset schema for
    // complex query/response types
    // -------------------------------

    // Funnels
    if (this.isFunnel) {
      this.capabilities = ['columnchart', 'areachart', 'barchart', 'linechart', 'table'];
      if (this.config.library == 'google') {
        this.config.chartOptions.legend = { position: 'none' };
      }
    }

    // 2x GroupBy
    if (this.is2xGroupBy) {
      this.capabilities = ['columnchart', 'areachart', 'barchart', 'linechart', 'table'];
    }

    // Extractions
    if (this.isExtraction) {
      this.capabilities = ['table'];
    }

    // Set chart type to default if one hasn't seen set,
    // which is just the first index in the array of chart types this viz is capable of.
    if (!this.config.chartType) {
      this.config.chartType = this.capabilities[0];
    }
  };

  Keen.Dataviz.prototype.setDataformSchema = function() {
    if (this.is2xGroupBy) {
      this.dataformSchema = {
        collection: 'result',
        sort: {
          index: 'asc',
          label: 'desc'
        }
      };
      if (this.isInterval) {
        this.dataformSchema.unpack = {
          index: 'timeframe -> start',
          label: 'value -> ' + this.dataset.queries[0].params.group_by[0],
          value: 'value -> result'
        };
      } else {
        this.dataformSchema.unpack = {
          index: this.dataset.queries[0].params.group_by[0],
          label: this.dataset.queries[0].params.group_by[1],
          value: 'result'
        };
      }
    }

    if (this.isExtraction) {
      this.dataformSchema = {
        collection: "result",
        select: true
      };
      if (this.dataset.queries[0].get('property_names')) {
        this.dataformSchema.select = [];
        for (var i = 0; i < this.dataset.queries[0].get('property_names').length; i++) {
          this.dataformSchema.select.push({ path: this.dataset.queries[0].get('property_names')[i] });
        }
      }
    }
  };

  Keen.Dataviz.prototype.applyColorMapping = function() {
    // Apply color-mapping options (post-process)
    // -------------------------------
    var self = this;

    if (this.config.colorMapping) {

      // Map to selected index
      if (this.config['data'].schema.select && this.config['data'].table[0].length == 2) {
        _each(this.config['data'].table, function(row, i){
          if (i > 0 && self.config.colorMapping[row[0]]) {
            self.config.colors.splice(i-1, 0, self.config.colorMapping[row[0]]);
          }
        });
      }

      // Map to unpacked labels
      if (this.config['data'].schema.unpack) { //  && this.config['data'].table[0].length > 2
        _each(this.config['data'].table[0], function(cell, i){
          if (i > 0 && self.config.colorMapping[cell]) {
            self.config.colors.splice(i-1, 0, self.config.colorMapping[cell]);
          }
        });
      }

    }
  };

  Keen.Dataviz.prototype.setSpecificChartOptions = function() {
    // A few last details
    // -------------------------------

    if (this.config.chartType == 'metric') {
      this.config.library = 'keen-io';
    }

    if (this.config.chartOptions.lineWidth == void 0) {
      this.config.chartOptions.lineWidth = 2;
    }

    if (this.config.chartType == 'piechart') {
      if (this.config.chartOptions.sliceVisibilityThreshold == void 0) {
        this.config.chartOptions.sliceVisibilityThreshold = 0.01;
      }
    }

    if (this.config.chartType == 'columnchart' || this.config.chartType == 'areachart' || this.config.chartType == 'linechart') {

      if (this.config.chartOptions.hAxis == void 0) {
        this.config.chartOptions.hAxis = {
          baselineColor: 'transparent',
          gridlines: { color: 'transparent' }
        };
      }

      if (this.config.chartOptions.vAxis == void 0) {
        this.config.chartOptions.vAxis = {
          viewWindow: { min: 0 }
        };
      }
    }
  };

  Keen.Dataviz.prototype.render = function(el) {
    if (this.spinner) {
      this.spinner.stop();
    }
    this.config.el = el;

    if (this.config.library) {
      if (Keen.Visualization.libraries[this.config.library][this.config.chartType]) {
        this.chart = new Keen.Visualization.libraries[this.config.library][this.config.chartType](this.config);
      } else {
        throw new Error('The library you selected does not support this chartType');
      }
    } else {
      throw new Error('The library you selected is not present');
    }

    return this;
  };

  Keen.Dataviz.prototype.destroy = function() {
    if (this.config.el) {
      this.config.el.innerHTML = "";
    }
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
    if (this.viz) {
      this.viz = null; // TODO: Destroy the actual chart object?
    }
  };

  // Visual defaults
  Keen.Visualization.defaults = {
    library: 'google',
    height: 400,
    width: 600,
    colors: [
      "#00afd7",
      "#f35757",
      "#f0ad4e",
      "#8383c6",
      "#f9845b",
      "#49c5b1",
      "#2a99d1",
      "#aacc85",
      "#ba7fab"
    ],
    chartOptions: {}
  };

  // Collect and manage libraries
  Keen.Visualization.libraries = {};
  Keen.Visualization.dependencies = {
    loading: 0,
    loaded: 0
  };
  Keen.Visualization.register = function(name, methods, config){
    Keen.Visualization.libraries[name] = Keen.Visualization.libraries[name] || {};
    for (var method in methods) {
      Keen.Visualization.libraries[name][method] = methods[method];
    }

    // For all dependencies
    if(config && config.dependencies) {
      _each(config.dependencies, function (dependency, index, collection) {
        var status = Keen.Visualization.dependencies;
        status.loading++;
        // Load the script || style
        if(dependency.type === 'script') {
          _load_script(dependency.url, function() {
            dependency.cb && dependency.cb();
            status.loaded++;
            if(status.loaded === status.loading) {
              Keen.trigger('ready');
            }
          });
        } else if(dependency.type === 'style') {
          _load_style(dependency.url, function() {
            dependency.cb && dependency.cb();
            status.loaded++;
            if(status.loaded === status.loading) {
              Keen.trigger('ready');
            }
          });
        }
      }); // End each
    }
  };

  Keen.Visualization.visuals = [];
  var baseVisualization = function(config){
    var self = this;
    _extend(self, config);

    // Set default event handlers
    self.on("error", function(){
      var errorConfig, error;
      errorConfig = Keen.utils.extend({
        error: { message: arguments[0] }
      }, config);
      error = new Keen.Visualization.libraries['keen-io']['error'](errorConfig);
    });
    self.on("update", function(){
      self.update.apply(this, arguments);
    });
    self.on("remove", function(){
      self.remove.apply(this, arguments);
    });

    // Let's kick it off!
    self.initialize();
    Keen.Visualization.visuals.push(self);
  };

  baseVisualization.prototype = {
    initialize: function(){
      // Set listeners and prepare data
    },
    render: function(){
      // Build artifacts
    },
    update: function(){
      // Handle data updates
    },
    remove: function(){
      // Handle deletion
    }
  };
  _extend(baseVisualization.prototype, Events);

  Keen.Visualization.extend = function(protoProps, staticProps){
    var parent = baseVisualization, Visualization;
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
      Visualization = protoProps.constructor;
    } else {
      Visualization = function(){ return parent.apply(this, arguments); };
    }
    _extend(Visualization, parent, staticProps);
    var Surrogate = function(){ this.constructor = Visualization; };
    Surrogate.prototype = parent.prototype;
    Visualization.prototype = new Surrogate();
    if (protoProps) {
      _extend(Visualization.prototype, protoProps);
    }
    Visualization.__super__ = parent.prototype;
    return Visualization;
  };

  var ErrorMessage = Keen.Visualization.extend({
    initialize: function(){
      var errorPlaceholder, errorMessage;

      errorPlaceholder = document.createElement("div");
      errorPlaceholder.className = "keen-error";
      errorPlaceholder.style.borderRadius = "8px";
      errorPlaceholder.style.height = this.height + "px";
      errorPlaceholder.style.width = this.width + "px";

      errorMessage = document.createElement("span");
      errorMessage.style.color = "#ccc";
      errorMessage.style.display = "block";
      errorMessage.style.paddingTop = (this.height / 2 - 15) + "px";
      errorMessage.style.fontFamily = "Helvetica Neue, Helvetica, Arial, sans-serif";
      errorMessage.style.fontSize = "21px";
      errorMessage.style.fontWeight = "light";
      errorMessage.style.textAlign = "center";

      errorMessage.innerHTML = this['error'].message;
      errorPlaceholder.appendChild(errorMessage);

      this.el.innerHTML = "";
      this.el.appendChild(errorPlaceholder);
    }
  });

  Keen.Visualization.register('keen-io', {
    'error': ErrorMessage
  });


  // -------------------------------
  // Dataform Configuration
  // -------------------------------
  // Handles arbitrary raw data for
  // scenarios where originating
  // queries are not known
  // -------------------------------
  function _transform(response, config){
    var self = this, schema = config || {}, dataform;

    // Metric
    // -------------------------------
    if (typeof response.result == "number"){
      //return new Keen.Dataform(response, {
      schema = {
        collection: "",
        select: [{
          path: "result",
          type: "string",
          label: "Metric",
          format: false,
          method: "Keen.utils.prettyNumber",
          replace: {
            null: 0
          }
        }]
      }
    }

    // Everything else
    // -------------------------------
    if (response.result instanceof Array && response.result.length > 0){

      // Interval w/ single value
      // -------------------------------
      if (response.result[0].timeframe && (typeof response.result[0].value == "number" || response.result[0].value == null)) {
        schema = {
          collection: "result",
          select: [
            {
              path: "timeframe -> start",
              type: "date"
            },
            {
              path: "value",
              type: "number",
              format: "10",
              replace: {
                null: 0
              }
            }
          ],
          sort: {
            column: 0,
            order: 'asc'
          }
        }
      }

      // Static GroupBy
      // -------------------------------
      if (typeof response.result[0].result == "number"){
        schema = {
          collection: "result",
          select: [],
          sort: {
            column: 1,
            order: "desc"
          }
        };
        for (var key in response.result[0]){
          if (response.result[0].hasOwnProperty(key) && key !== "result"){
            schema.select.push({
              path: key,
              type: "string"
            });
            break;
          }
        }
        schema.select.push({
          path: "result",
          type: "number"
        });
      }

      // Grouped Interval
      // -------------------------------
      if (response.result[0].value instanceof Array){
        schema = {
          collection: "result",
          unpack: {
            index: {
              path: "timeframe -> start",
              type: "date"
            },
            value: {
              path: "value -> result",
              type: "number",
              replace: {
                null: 0
              }
            }
          },
          sort: {
            value: "desc"
          }
        }
        for (var key in response.result[0].value[0]){
          if (response.result[0].value[0].hasOwnProperty(key) && key !== "result"){
            schema.unpack.label = {
              path: "value -> " + key,
              type: "string"
            }
            break;
          }
        }
      }

      // Funnel
      // -------------------------------
      if (typeof response.result[0] == "number"){
        schema = {
          collection: "",
          unpack: {
            index: {
              path: "steps -> event_collection",
              type: "string"
            },
            value: {
              path: "result -> ",
              type: "number"
            }
          }
        }
      }

    }

    // Trim colorMapping values
    // -------------------------------
    if (self.colorMapping) {
      _each(self.colorMapping, function(v,k){
        self.colorMapping[k] = v.trim();
      });
    }

    // Apply formatting options
    // -------------------------------

    // If key:value replacement map
    if (self.labelMapping && _type(self.labelMapping) == 'Object') {

      if (schema.unpack) {
        if (schema.unpack['index']) {
          schema.unpack['index'].replace = schema.unpack['index'].replace || self.labelMapping;
        }
        if (schema.unpack['label']) {
          schema.unpack['label'].replace = schema.unpack['label'].replace || self.labelMapping;
        }
      }

      if (schema.select) {
        _each(schema.select, function(v, i){
          schema.select[i].replace = self.labelMapping;
        });
      }

    }

    dataform = new Keen.Dataform(response, schema);

    // If full replacement (post-process)
    if (self.labelMapping && _type(self.labelMapping) == 'Array') {
      if (schema.unpack && dataform.table[0].length == 2) {
        _each(dataform.table, function(row,i){
          if (i > 0 && self.labelMapping[i-1]) {
            dataform.table[i][0] = self.labelMapping[i-1];
          }
        });
      }
      if (schema.unpack && dataform.table[0].length > 2) {
        _each(dataform.table[0], function(cell,i){
          if (i > 0 && self.labelMapping[i-1]) {
            dataform.table[0][i] = self.labelMapping[i-1];
          }
        });
      }
    }

    return dataform;
  }

    function recurse(input, iteration) {
      var input = String(input);
      var split = input.split(".");
      // If there's a dot
      if(split.length > 1) {
        // Keep the left hand side only
        input = split[0];
        var rhs = split[1];
        // If the left-hand side is too short, pad until it has 3 digits
        if (input.length == 2 && rhs.length > 0) {
          // Pad with right-hand side if possible
          if (rhs.length > 0) {
            input = input + "." + rhs.charAt(0);
          }
          // Pad with zeroes if you must
          else {
            input += "0";
          }
        }
        else if (input.length == 1 && rhs.length > 0) {
          input = input + "." + rhs.charAt(0);
          // Pad with right-hand side if possible
          if(rhs.length > 1) {
            input += rhs.charAt(1);
          }
          // Pad with zeroes if you must
          else {
            input += "0";
          }
        }
      }
      var numNumerals = input.length;
      // if it has a period, then numNumerals is 1 smaller than the string length:
      if (input.split(".").length > 1) {
        numNumerals--;
      }
      if(numNumerals <= 3) {
        return String(input) + suffixes[iteration];
      }
      else {
        return recurse(Number(input) / 1000, iteration + 1);
      }
    }
  }
 
  Keen.Visualization.find = function(target){
    var el, match;
    if (target) {
      el = target.nodeName ? target : document.querySelector(target);
      _each(Keen.Visualization.visuals, function(visual){
        if (el == visual.el){
          match = visual;
          return false;
        }
      });
      if (match) {
        return match;
      }
      throw("Visualization not found");
    } else {
      return Keen.Visualization.visuals;
    }
  };
