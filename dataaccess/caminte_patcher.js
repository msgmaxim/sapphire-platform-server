const Schema = require('caminte').Schema

// fix NULL in dates
const utilTestString = function(example, value) {
  if (typeof value === 'string' && example && example.constructor.name === 'RegExp') {
    return value.match(example);
  }
  // not strict equality
  return (example !== null ? example.toString() : example) === (value !== null ? value.toString() : value);
}

const utilParseCond = function(val, conds) {
  var outs = false;
  Object.keys(conds).forEach(function(condType) {
    switch (condType) {
      case 'gt':
          outs = val > conds[condType] ? true : false;
          break;
      case 'gte':
          outs = val >= conds[condType] ? true : false;
          break;
      case 'lt':
          outs = val < conds[condType] ? true : false;
          break;
      case 'lte':
          outs = val <= conds[condType] ? true : false;
          break;
      case 'between':
          // need
          outs = val !== conds[condType] ? true : false;
          break;
      case 'inq':
      case 'in':
          // sometimes we just pass a value not an array
          // not sure why the mysql driver allows this...
          if (!conds[condType].forEach) {
            if (conds[condType] === val) {
              outs = true;
            }
          } else {
            conds[condType].forEach(function(cval) {
              if (val === cval) {
                outs = true;
              }
            });
          }
          break;
      case 'nin':
          if (!conds[condType].forEach) {
            if (conds[condType] === val) {
              outs = false;
            }
          } else {
            conds[condType].forEach(function(cval) {
                if (val === cval) {
                    outs = false;
                }
            });
          }
          break;
      case 'neq':
      case 'ne':
          outs = val !== conds[condType] ? true : false;
          break;
      case 'regex':
      case 'like':
          outs = new RegExp(conds[condType]).test(val);
          break;
      case 'nlike':
          outs = !new RegExp(conds[condType]).test(val);
          break;
      default:
          outs = val === conds[condType] ? true : false;
          break;
    }
  });
  return outs;
}

const utilApplyFilter = function(filter) {
  var self = this;
  if (typeof filter.where === 'function') {
    return filter.where;
  }
  var keys = Object.keys(filter.where);
  return function(obj) {
    var pass = true;
    keys.forEach(function(key) {
      //console.log('utils::applyFilter - key', key, 'val', filter.where[key])
      if (typeof filter.where[key] === 'object' && filter.where[key]!==null && !filter.where[key].getTime) {
        //console.log('utils::applyFilter - no getTime')
        pass = utilParseCond(obj[key], filter.where[key]);
      } else {
        //console.log('utils::applyFilter - testString')
        if (!utilTestString(filter.where[key], obj[key])) {
          pass = false;
        }
      }
    });
    return pass;
  };
}

const memoryAll = function (model, filter, callback) {
  if ('function' === typeof filter) {
    callback = filter;
    filter = {};
  }
  if (!filter) {
    filter = {};
  }
  var nodes = Object.keys(this.cache[model]).map(function(key) {
    return this.cache[model][key];
  }.bind(this));

  if (filter) {

    // do we need some filtration?
    if (filter.where) {
      nodes = nodes ? nodes.filter(utilApplyFilter(filter)) : nodes;
    }

    // do we need some sorting?
    if (filter.order) {
      var props = this._models[model].properties;
      var orders = filter.order;
      if (typeof filter.order === "string") {
        orders = [filter.order];
      }
      orders.forEach(function(key, i) {
        var reverse = 1;
        var m = key.match(/\s+(A|DE)SC$/i);
        if (m) {
          key = key.replace(/\s+(A|DE)SC/i, '');
          if (m[1] === 'DE')
            reverse = -1;
        }
        orders[i] = {"key": key, "reverse": reverse};
      });
      nodes = nodes.sort(sorting.bind(orders));
    }
  }

  process.nextTick(function() {
    callback(null, nodes);
  });

  function sorting(a, b) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (a[this[i].key] > b[this[i].key]) {
        return 1 * this[i].reverse;
      } else if (a[this[i].key] < b[this[i].key]) {
        return -1 * this[i].reverse;
      }
    }
    return 0;
  }
};

// fix memory.count so it works...
const memoryCount = function count(model, callback, cond) {
  var nodes = Object.keys(this.cache[model]).map(function(key) {
    return this.cache[model][key];
  }.bind(this));
  if (cond && cond.where) {
    nodes = nodes ? nodes.filter(utilApplyFilter(cond)) : nodes;
  }
  process.nextTick(function() {
    callback(null, nodes.length);
  });
};

// fix memory.update so it works...
const memoryUpdate = function (model, filter, data, callback) {
  'use strict'
  if ('function' === typeof filter) {
    return filter(new Error('Get parametrs undefined'), null)
  }
  if ('function' === typeof data) {
    return data(new Error('Set parametrs undefined'), null)
  }
  filter = filter.where ? filter.where : filter
  var mem = this
  //console.log('memoryUpdate - model', model, 'filter', filter, 'data', data, 'callback', callback)

  // filter input to make sure it only contains valid fields
  var cleanData = this.toDatabase(model, data)

  if (filter.id) {
    // should find one and only one
    this.exists(model, filter.id, function (err, exists) {
      if (err) console.error('memoryUpdate exists err', err)
      if (exists) {
        mem.save(model, Object.assign(mem.cache[model][filter.id], cleanData), callback)
      } else {
        callback(err, cleanData)
      }
    })
  } else {
    //console.log('memoryUpdate - not implemented, search by?', filter, data)
    this.all(model, filter, function(err, nodes) {
      //console.log('memoryUpdate - records', nodes)
      if (err) console.error('memoryUpdate all err', err)
      var count = nodes.length
      if (!count) {
        return callback(false, cleanData)
      }
      nodes.forEach(function(node) {
        mem.cache[model][node.id] = Object.assign(node, cleanData)
        if (--count === 0) {
          callback(false, cleanData)
        }
      })
    })
  }
}

// fix MySQL.prototype.toDatabase so that IN is escaped properly
function dateToMysql(val) {
  'use strict';
  return val.getUTCFullYear() + '-' +
    fillZeros(val.getUTCMonth() + 1) + '-' +
    fillZeros(val.getUTCDate()) + ' ' +
    fillZeros(val.getUTCHours()) + ':' +
    fillZeros(val.getUTCMinutes()) + ':' +
    fillZeros(val.getUTCSeconds());

  function fillZeros(v) {
    'use strict';
    return v < 10 ? '0' + v : v;
  }
}

mysqlToDatabase = function (prop, val) {
  'use strict';
  if (val === null) {
    return 'NULL';
  }
  if (val.constructor.name === 'Object') {
    var operator = Object.keys(val)[0];
    val = val[operator];
    if (operator === 'between') {
      if (prop.type.name === 'Date') {
        return 'STR_TO_DATE(' + this.toDatabase(prop, val[0]) + ', "%Y-%m-%d %H:%i:%s")' +
            ' AND STR_TO_DATE(' +
            this.toDatabase(prop, val[1]) + ', "%Y-%m-%d %H:%i:%s")';
      } else {
        return this.toDatabase(prop, val[0]) +
            ' AND ' +
            this.toDatabase(prop, val[1]);
      }
    } else if (operator === 'in' || operator === 'inq' || operator === 'nin') {
      if (!(val.propertyIsEnumerable('length')) && typeof val === 'object' && typeof val.length === 'number') { //if value is array
        // if it's an array of strings, no need to quote
        //   but why? maybe it's already escaped...
        // if it's an array of ints, no need to quote
        // when do we need to escape an array?
        const escapedArr = [...val]
        for (var i = 0; i < val.length; i++) {
          // if it already has quotes don't add more...
          if (!(/^"(?:\\"|.)*?"$/gi.test(val[i]) || /^'(?:\\'|.)*?'$/gi.test(val[i]))) {
            //console.log('escaping [' + val[i] + ']')
            escapedArr[i] = this.client.escape(val[i]);
          }
        }
        const retVal = escapedArr.join(',')
        //console.log('returning', retVal)
        return retVal;
      } else {
        return val;
      }
    }
  }
  if (!prop) {
      return val;
  }
  if (prop.type.name === 'Number') {
      return val;
  }
  if (prop.type.name === 'Date') {
    if (!val) {
      return 'NULL';
    }
    if (typeof val === 'string') {
      val = val.split('.')[0].replace('T', ' ');
      val = Date.parse(val);
    }
    if (typeof val === 'number') {
      val = new Date(val);
    }
    if (val instanceof Date) {
      val = '"' + dateToMysql(val) + '"';
    }
    return val;
  }
  if (prop.type.name === "Boolean") {
    return val ? 1 : 0;
  }
  return this.client.escape(val.toString());
};

function cfgCaminteConn(schemaType, config) {
  const schema = new Schema(schemaType, config)
  const type = schemaType.toLowerCase()
  if (type === 'memory') {
    schema.adapter.update = memoryUpdate
    schema.adapter.all = memoryAll
    schema.adapter.count = memoryCount
  } else if (type === 'mysql') {
    schema.adapter.toDatabase = mysqlToDatabase
  }
  return schema
}

module.exports = {
  cfgCaminteConn
}