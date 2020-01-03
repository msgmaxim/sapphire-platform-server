module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    app.post(prefix+'/text/process', function(req, resp) {
      dispatcher.textProcess(req.body.text, null, null, callbacks.dataCallback(resp));
    });
  }
}
