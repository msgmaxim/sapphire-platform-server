var streamMarkersModel

function start(options) {
  const schemaData = options.schemaData
  streamMarkersModel = schemaData.define('stream_markers', {
    user_id: { type: Number, index: true },
    top_id: { type: Number },
    last_read_id: { type: Number },
    name: { type: String, length: 32 },
    percentage: { type: Number },
    last_updated: { type: Date },
    version: { type: Number },
  })
}

module.exports = {
  next: null,
  start: start,
  /*
   * Stream Markers
   */
  getStreamMarker: function(userid, name, callback) {
    streamMarkersModel.find({ where: { user_id: userid, name: name } }, function(err, markers) {
      if (err) console.log('dataaccess.camintejs.js::getStreamMarker - err', err)
      var marker = markers[0]
      callback(marker, err);
    });
  },
  setStreamMarker: function(userid, name, id, percentage, params, callback) {
    var updObj = {
      top_id: id,
      last_updated: new Date()
    };
    if (percentage !== undefined) {
      updObj.percentage = percentage;
    }
    streamMarkersModel.updateOrCreate({
      user_id: userid,
      name: name,
    }, updObj, function(err, marker) {
      if (err || !marker) console.log('dataaccess.camintejs.js::setStreamMarker - err', err)
      if (marker.version === undefined) {
        marker.version = 0;
      }
      if (marker.last_read_id === undefined) {
        marker.last_read_id = 0;
      }
      if (marker.last_read_id < marker.top_id) {
        marker.last_read_id = marker.top_id;
      }
      marker.version++;
      marker.save(function() {
        //console.log('dataaccess.camintejs.js::setStreamMarker - marker', marker);
        callback(marker, err);
      })
    })
  },
}
