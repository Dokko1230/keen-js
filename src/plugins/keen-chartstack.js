  /*!
  * ----------------------
  * Keen IO Plugin
  * Data Visualization
  * ----------------------
  */

  !function(name, context){
    var Keen = context[name] || {};
    var cs = context.chartstack;
    Keen.vis = cs; //.noConflict();
    Keen.Chart = function(obj){
      return new Keen.vis.Chart(obj);
    };
    Keen.Dataform = function(data, schema){
      return new Keen.vis.Dataform(data, schema);
    };

    // -------------------------------
    // Inject Request Draw Method
    // -------------------------------
    Keen.Request.prototype.draw = function(selector, config) {
      var self = this;
      if (!self.visual) {
        self.visual = new Keen.Visualization(self, selector, config);
      }
      return self;
    };

    // -------------------------------
    // Set Visual Defaults
    // -------------------------------
    Keen.vis.defaults = Keen.vis.defaults || {};
    Keen.vis.defaults.height = 400;
    Keen.vis.defaults.width = 600;
    Keen.vis.defaults.colors = [
      '#00afd7', // blue
      '#49c5b1', // green
      '#e6b449', // gold
      '#f35757'  // red
    ];

    // -------------------------------
    // Keen IO Data Adapter
    // -------------------------------
    Keen.vis.addAdapter('default', function(response){
      var self = this, data;
      var schema = self.schema || false;

      if (schema) {
        return new Keen.Dataform(response, schema);
      }

      // Metric
      // -------------------------------
      if (typeof response.result == "number"){
        //return new Keen.Dataform(response, {
        schema = {
          collection: "",
          select: [{
            path: "result",
            type: "number",
            label: "Metric",
            format: "1,000",
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
        if (response.result[0].timeframe && typeof response.result[0].value == "number") {
          //return new Keen.Dataform(response, {
          schema = {
            collection: "result",
            select: [
              {
                path: "timeframe -> end",
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
            select: []
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
          /*return new Keen.Dataform(response, {
            collection: "result",
            select: true
          });*/
        }

        // Grouped Interval
        // -------------------------------
        if (response.result[0].value instanceof Array){
          schema = {
            collection: "result",
            unpack: {
              index: {
                path: "timeframe -> end",
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
          //console.log("Grouped Interval", output);
          //console.log(new Keen.Dataform(response, output));
          //return new Keen.Dataform(response, output);
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

      if (!schema) {
        schema = {
          collection: "",
          select: true
        }
      }

      return new Keen.Dataform(response, schema);
    });


    // -------------------------------
    // Keen.Visualization
    // -------------------------------
    Keen.Visualization = function(req, selector, config){
      var self = this, options = (config || {});
      var library = Keen.vis.libraries[options.library] || Keen.vis.library, recommended;
      var isMetric = isFunnel = isInterval = isGroupBy = is2xGroupBy = isExtraction = false;
      var datasetConfig = {};
      var viewConfig = {
        el: selector,
        chartOptions: {}
      };
      viewConfig.chartOptions.colors = viewConfig.chartOptions.colors || Keen.vis.defaults.colors;

      if (req instanceof Keen.Request) {

        req.on("complete", function(){
          if (this.visual) {
            this.visual.dataset.responses[0] = (this.data instanceof Array) ? this.data[0] : this.data;
            this.visual.dataset.transform();
          }
        });

        isMetric = (typeof req.result == "number") ? true : false,
        isFunnel = (req.queries[0].get('steps')) ? true : false,
        isInterval = (req.queries[0].get('interval')) ? true : false,
        isGroupBy = (req.queries[0].get('group_by')) ? true : false,
        is2xGroupBy = (req.queries[0].get('group_by') instanceof Array) ? true : false;
        isExtraction = (req.queries[0].analysis == 'extraction') ? true : false;

        if (req.instance.client) {
          datasetConfig = {
            //adapter: "keen-io",
            //url: req.instance.client.endpoint + '/projects/' + req.instance.client.projectId + req.queries[0].path,
            //params: req.queries[0].params,
            dateformat: options.dateFormat || ""
          };
          //datasetConfig.params.api_key = req.instance.client.readKey;
        }

        if (req.data !== void 0) {
          datasetConfig.response = (req.data instanceof Array) ? req.data[0] : req.data;
        }

        viewConfig.title = (function(){
          var analysis = req.queries[0].analysis.replace("_", " "),
              collection = req.queries[0].get('event_collection'),
              output;

          output = analysis.replace( /\b./g, function(a){
            return a.toUpperCase();
          });

          if (collection) {
            output += ' - ' + collection;
          }
          return output;
        })();

      } else {
        datasetConfig = (req instanceof Array) ? req[0] : req;
      }


      // -------------------------------
      // Select a default chart type
      // -------------------------------

      // Metric
      if (isMetric) {
        options.capable = ['metric'];
        recommended = 'metric';
      }

      // GroupBy
      if (!isInterval && isGroupBy) {
        options.capable = ['piechart', 'barchart', 'columnchart', 'datatable'];
        recommended = 'barchart';
      }

      // Single Interval
      if (isInterval) { // Series
        options.capable = ['areachart', 'barchart', 'columnchart', 'linechart', 'datatable'];
        recommended = 'linechart';
        if (!isGroupBy && library == 'google') {
          viewConfig.chartOptions.legend = { position: 'none' };
        }
      }

      // GroupBy Interval
      if (isInterval && isGroupBy) {}

      // Custom Dataset schema for
      // complex query/response types
      // -------------------------------

      // ---------------------------------------------------------
      // Funnels
      // ---------------------------------------------------------
      if (isFunnel) {
        options.capable = ['areachart', 'barchart', 'columnchart', 'linechart', 'datatable'];
        recommended = 'columnchart';
        if (library == 'google') {
          viewConfig.chartOptions.legend = { position: 'none' };
        }
      }

      // ---------------------------------------------------------
      // 2x GroupBy
      // ---------------------------------------------------------
      if (is2xGroupBy) {
        options.capable = ['areachart', 'barchart', 'columnchart', 'linechart', 'datatable'];
        recommended = 'columnchart';
      }

      // Dataform schema
      if (is2xGroupBy) {
        datasetConfig.schema = {
          collection: 'result',
          sort: {
            index: 'asc',
            label: 'desc'
          }
        };
        if (isInterval) {
          datasetConfig.schema.unpack = {
            index: 'timeframe -> end',
            label: 'value -> ' + req.queries[0].params.group_by[0],
            value: 'value -> result'
          };
        } else {
          datasetConfig.schema.unpack = {
            index: req.queries[0].params.group_by[0],
            label: req.queries[0].params.group_by[1],
            value: 'result'
          };
        }
      }

      // ---------------------------------------------------------
      // Extractions
      // ---------------------------------------------------------
      if (isExtraction) {
        options.capable = ['datatable'];
        recommended = 'datatable';
      }

      // Dataform schema
      if (isExtraction) {
        datasetConfig.schema = {
          collection: "result",
          select: true
        };
        if (req.queries[0].get('property_names')) {
          datasetConfig.schema.select = [];
          for (var i = 0; i < req.queries[0].get('property_names').length; i++) {
            datasetConfig.schema.select.push({ path: req.queries[0].get('property_names')[i] });
          }
        }
      }


      // -------------------------------
      // Configure View
      // -------------------------------
      //viewConfig = Keen.vis.extend(viewConfig, options);
      Keen.vis.extend(viewConfig.chartOptions, options.chartOptions);
      viewConfig.height = options.height || Keen.vis.defaults.height;
      viewConfig.width = options.width || Keen.vis.defaults.width;
      viewConfig.title = options.title || viewConfig.title || null;
      options.chartType = options.chartType || recommended;
      if (options.chartType == 'metric') {
        library = 'keen-io';
      }

      // Put it all together
      // -------------------------------
      if (library) {
        if (Keen.vis.libraries[library][options.chartType]) {
          return new Keen.Chart({
            dataset: new Keen.vis.Dataset(datasetConfig),
            view: new Keen.vis.libraries[library][options.chartType](viewConfig)
          });
        } else {
          Keen.log('The visualization type you requested is not available for this library');
        }
      } else {
        Keen.log('The visualization library you requested is not present');
      }

      return this;
    };

    Keen.vis.ready(function(){
      Keen.trigger('ready');
    });

  }('Keen', this);
