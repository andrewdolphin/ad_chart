import { LitElement, html, css } from "lit-element";
import Chart from "chart.js/auto";
import 'chartjs-adapter-moment';
import { Interaction } from 'chart.js';
import { getRelativePosition } from 'chart.js/helpers';
import { Tooltip } from 'chart.js';


Interaction.modes.datasetnearest = function (chart, e, options, useFinalPosition) {
  const position = getRelativePosition(e, chart);
  const axis = options.axis || 'xy';
  const includeInvisible = options.includeInvisible || false;
  const intersect = options.intersect || false;
  let minDistance = 0;
  let tempitems = [];
  let items = [];
  let datasetminDistance = [];

  Interaction.evaluateInteractionItems(chart, 'x', position, (element, datasetIndex, index) => {
    const inRange = element.inRange(position.x, position.y, useFinalPosition);
    if (intersect && !inRange) {
      return;
    }


    const center = element.getCenterPoint(useFinalPosition);
    const pointInArea = !!includeInvisible || chart.isPointInArea(center);
    if (!pointInArea && !inRange) {
      return;
    }

    const distance = Math.abs(position.x - center.x);

    if (datasetIndex in datasetminDistance) {
      minDistance = datasetminDistance[datasetIndex];
    } else {
      datasetminDistance[datasetIndex] = Number.POSITIVE_INFINITY;
      minDistance = datasetminDistance[datasetIndex];
    }

    if (distance < minDistance) {
      tempitems[datasetIndex] = [{ element, datasetIndex, index }];
      datasetminDistance[datasetIndex] = distance;
    }
  });

  items = Object.keys(tempitems).reduce(function (r, k) {
    return r.concat(tempitems[k]);
  }, []);
  return items;
};




Tooltip.positioners.lower = function (elements, eventPosition) {


  // Happens when nothing is found
  if (eventPosition === false || !elements.length) {
    return false;
  }

  const chart = this.chart;

  let i, len;
  let x = 0;
  let count = 0;

  for (i = 0, len = elements.length; i < len; ++i) {
    const el = elements[i].element;
    if (el && el.hasValue()) {
      const pos = el.tooltipPosition();
      x += pos.x;
      ++count;
    }
  }

  return {
    x: x / count,
    y: chart.chartArea.height * 70 / 100,
    xAlign: 'center',
    yAlign: 'bottom',
  };
};

class MyElement extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {}
    };
  }

  static get styles() {
    return css`
      #chartjs-tooltip.left{
    margin-left:10px;
}

:root {
    --tooltip-background: rgba(0,0,0,0.5);
}

#chartjs-tooltip{
    transition: all 50ms;
}

#chartjs-tooltip.left:after{
    content: '';
    position: absolute;
    border: 8px solid #000;
    top:50%;
    border-color: transparent var(--tooltip-background) transparent transparent;
    transform: translate(-100%,-50%);
}

#chartjs-tooltip.right{
    margin-right:10px;
}

#chartjs-tooltip.right:after{
    content: '';
    position: absolute;
    border: 8px solid #000;
    top:50%;
    left:100%;
    border-color: transparent transparent transparent var(--tooltip-background) ;
    transform: translate(0%,-50%);
}

td {
    padding: 0px 2px 0px 2px;
}
    `;
  }

  constructor() {
    super();
    this.mydate = new Date();
    //    setInterval(() => this.firstUpdated(), 10000);
  }

  render() {
    return html`
      <ha-card style="padding: 6px;">
        <div id="wrapper" style="height:${this.config.height}px; width:100%;">
           <canvas>Your browser does not support the canvas element.</canvas>
        </div>
      </ha-card>`;
  }

  aggregate_data(data, minutes, func) {

    var reduced = data.reduce(function (m, d) {
      var time = d.x;
      var aggregator = (parseInt(time / 1000 / 60 / minutes) * 1000 * 60 * minutes);
      if (!m[aggregator]) {
        m[aggregator] = {}
        m[aggregator].value = 0
        m[aggregator].count = 0
      }
      if (!(d[1] === null)) {
        if (['avg'].indexOf(func) >= 0) {
          m[aggregator].value += d.y
          m[aggregator].count += 1
        }
        if (['sum'].indexOf(func) >= 0) {
          m[aggregator].value += d.y
          m[aggregator].count = 1
        }
        if (['last'].indexOf(func) >= 0) {
          m[aggregator].value = d.y
          m[aggregator].count = 1
        }
        // Set initial value for min
        if (['first', 'min'].indexOf(func) >= 0 && m[aggregator].count == 0) {
          m[aggregator].value = d.y
          m[aggregator].count = 1
        }
        if (['max'].indexOf(func) >= 0 && m[aggregator].value < d.y) {
          m[aggregator].value = d.y
          m[aggregator].count = 1
        }
        if (['min'].indexOf(func) >= 0 && m[aggregator].value > d.y) {
          m[aggregator].value = d.y
          m[aggregator].count = 1
        }
      }
      return m;
    }, {});

    var reduced2 = Object.keys(reduced).map(function (k) {
      const item = reduced[k];
      return { x: parseInt(k), y: item.value / item.count }
    })

    return reduced2

  }

  applyTransform(named_data, transform_func) {
    return new Function('data', 'hass', `'use strict'; ${transform_func}`).call(
      this,
      named_data,
      this.hass
    );
  }

  getSeriesdata(named_data, series_config) {

    var return_data = []

    if (series_config['transform'] == undefined) {
      return_data = named_data[series_config.entity_id].map((val) => { return { x: new Date(val.last_updated).getTime(), y: ((series_config['attribute'] == undefined) ? val.state : val.attributes[series_config.attribute]) } })
    } else {
      return_data = this.applyTransform(named_data, series_config.transform)
    }

    if (!(series_config['group_by'] == undefined)) {

      return_data = this.aggregate_data(return_data, series_config.group_by, series_config.func)

    }

    return return_data

  }


  evaluate_config(config) {
    var hass = this.hass

    'use strict';

    if (typeof config === 'object') {
      for (var k in config) {
        if (typeof config[k] === 'object' && config[k] !== null) {
          this.evaluate_config(config[k])
        } else if (config.hasOwnProperty(k)) {
          if (typeof config[k] === 'string') {
            let regex = /^\${((.|\n|\r)*)}$/
            var match = config[k].trim().match(regex)
            if (!(match === null)) {
              config[k] = new Function('hass', `'use strict'; ${match[1]}`).call(this, hass)
            }
          }
          if (typeof config[k] === 'string') {// Evaluate CSS as well?
            let regex = /var[(](--.+)?[)]/
            var match = config[k].trim().match(regex)
            if (!(match === null)) {
              config[k] = getComputedStyle(document.documentElement).getPropertyValue(match[1])
            }
          }
        }
      }
    }
    return config
  }


  async firstUpdated(changedProperties) {
    let end = new Date;
    let start = new Date()
    start.setTime(end.getTime() - (this.config.hours * 60 * 60 * 1000));

    var evaluated_config = this.evaluate_config(JSON.parse(JSON.stringify(this.config)))

    var entities = evaluated_config.series.map(x => x.entity_id);
    if (evaluated_config.hasOwnProperty('extra_entities')) {
      entities = entities.concat(evaluated_config.extra_entities);
    }




    var entity_url = entities.join();

    var tempdata = await this.hass.callApi("GET", `history/period/${start.toISOString()}?filter_entity_id=${entity_url}&end_time=${end.toISOString()}`);
    var named_data = {}
    tempdata.forEach(value => named_data[value[0].entity_id] = value)

    var seriesdata = evaluated_config.series

    var data = Object.assign({}, evaluated_config.data);
    data.datasets = [];

    seriesdata.forEach((value, seriesindex) => {
      if (!(value.show == false)) {
        data.datasets.push(Object.assign({}, { data: this.getSeriesdata(named_data, value) }, evaluated_config.dataset, value.dataset))
      }
    })

    if (evaluated_config.hasOwnProperty('per_dataset_data')) {
      for (var k in evaluated_config.per_dataset_data) {
        for (var j in evaluated_config.per_dataset_data[k]) {
          if (!(typeof data.datasets[j] === 'undefined')) {
            data.datasets[j][k] = evaluated_config.per_dataset_data[k][j];
          }
        }
      }
    }

    var chartProp = {}

    chartProp.options = Object.assign({}, evaluated_config.library)
    chartProp.data = data
    chartProp.type = 'line'
    if (evaluated_config.hasOwnProperty('plugins')) {
      chartProp.plugins = evaluated_config.plugins
    } else {
      chartProp.plugins = []
    }
    //    chartProp.plugins.push(myplugin)

    const ctx = this.renderRoot.querySelector('#wrapper canvas').getContext('2d');
    var chart = new Chart(ctx, chartProp);

  }

  updated(changedProperties) {
  }

  setConfig(config) {
    this.config = config;
  }

  // The height of your card. Home Assistant uses this to automatically
  // distribute all cards over the available columns.
  getCardSize() {
    return 2;
  }

}
customElements.define('ad-chart-new', MyElement);
