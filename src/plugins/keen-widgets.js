  /*!
  * ----------------------
  * Keen IO Plugin
  * Data Visualization
  * ----------------------
  */

  (function(lib){
    var Keen = lib || {},
        Metric, Error, Spinner;

    Keen.Spinner.defaults = {
      lines: 10,                    // The number of lines to draw
      length: 8,                    // The length of each line
      width: 3,                     // The line thickness
      radius: 10,                   // The radius of the inner circle
      corners: 1,                   // Corner roundness (0..1)
      rotate: 0,                    // The rotation offset
      direction: 1,                 // 1: clockwise, -1: counterclockwise
      color: '#4d4d4d',             // #rgb or #rrggbb or array of colors
      speed: 1.67,                  // Rounds per second
      trail: 60,                    // Afterglow percentage
      shadow: false,                // Whether to render a shadow
      hwaccel: false,               // Whether to use hardware acceleration
      className: 'keen-spinner',    // The CSS class to assign to the spinner
      zIndex: 2e9,                  // The z-index (defaults to 2000000000)
      top: '50%',                   // Top position relative to parent
      left: '50%'                   // Left position relative to parent
    };


    var dataTypes = {
      'singular': ['metric']
    };

    Metric = {
      initialize: function(){
        var css = document.createElement("style"),
            bgDefault = "#49c5b1";

        css.id = "keen-widgets";
        css.type = "text/css";
        css.innerHTML = "\
    .keen-metric { \n  background: " + bgDefault + "; \n  border-radius: 4px; \n  color: #fff; \n  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; \n  padding: 10px 0; \n  text-align: center; \n} \
    .keen-metric-value { \n  display: block; \n  font-size: 84px; \n  font-weight: 700; \n  line-height: 84px; \n} \
    .keen-metric-title { \n  display: block; \n  font-size: 24px; \n  font-weight: 200; \n}";
        if (!document.getElementById(css.id)) {
          document.body.appendChild(css);
        }
      },

      render: function(){
        var bgColor = (this.colors().length == 1) ? this.colors()[0] : "#49c5b1",
            prefix = "",
            suffix = "",
            title = this.title() || "Result",
            value = this.data()[1],
            width = this.width();

        if (this.chartOptions['prefix']) {
          prefix = '<span class="keen-metric-prefix">' + this.chartOptions()['prefix'] + '</span>';
        }
        if (this.chartOptions['suffix']) {
          suffix = '<span class="keen-metric-suffix">' + this.chartOptions()['suffix'] + '</span>';
        }

        this.el().innerHTML = '' +
          '<div class="keen-widget keen-metric" style="background-color: ' + bgColor + '; width:' + width + 'px;">' +
            '<span class="keen-metric-value">' + prefix + value + suffix + '</span>' +
            '<span class="keen-metric-title">' + title + '</span>' +
          '</div>';
      }
    };

    Error = {
      initialize: function(){},
      render: function(){
        var err, msg;

        err = document.createElement("div");
        err.className = "keen-error";
        err.style.borderRadius = "8px";
        err.style.height = String(this.height() + "px");
        err.style.width = String(this.width() + "px");

        msg = document.createElement("span");
        msg.style.color = "#ccc";
        msg.style.display = "block";
        msg.style.paddingTop = (this.height() / 2 - 15) + "px";
        msg.style.fontFamily = "Helvetica Neue, Helvetica, Arial, sans-serif";
        msg.style.fontSize = "21px";
        msg.style.fontWeight = "light";
        msg.style.textAlign = "center";

        msg.innerHTML = this['error'].message;
        err.appendChild(msg);

        this.el().innerHTML = "";
        this.el().appendChild(errorPlaceholder);
      },
      destroy: function(){
        this.el().innerHTML = "";
      }
    };

    Spinner = {
      initialize: function(){},
      render: function(){
        var spinner = document.createElement("div");
        spinner.className = "keen-loading";
        spinner.style.height = String(this.height() + "px");
        spinner.style.position = "relative";
        spinner.style.width = String(this.width() + "px");

        this.el().innerHTML = "";
        this.el().appendChild(spinner);
        this.view._artifacts.spinner = new Keen.Spinner(Keen.Spinner.defaults).spin(spinner);
      },
      destroy: function(){
        this.view._artifacts.spinner.stop();
        this.view._artifacts.spinner = null;
      }
    };

    Keen.Dataviz.register('keen-io', {
      'metric': Metric,
      'error': Error,
      'spinner': Spinner
    }, {
      capabilities: dataTypes
    });

  })(Keen);
