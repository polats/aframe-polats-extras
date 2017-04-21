var Listener = require('./listener'),
    util = require('util');

require('../../../lib/fulltilt.js')

function RemotePhoneListener () {
  Listener.call(this);

  this.title = 'Remote Phone';
  this.type = 'remotephone';
  this.component = 'remote-phone-controls';
  this.github = 'https://github.com/polats/aframe-remote-phone-controls-component';

  this.remotephonestate = {
    orientation: {},
    touching: false
  };
}

util.inherits(RemotePhoneListener, Listener);

RemotePhoneListener.prototype.bind = function () {
  Listener.prototype.bind.call(this);

  this.__listeners.touchstart = this.onTouchStart.bind(this);
  this.__listeners.touchend = this.onTouchEnd.bind(this);
  this.__listeners.deviceorientation = this.onDeviceOrientation.bind(this);

  window.addEventListener('touchstart', this.__listeners.touchstart);
  window.addEventListener('touchend', this.__listeners.touchend);
  window.addEventListener('deviceorientation', this.__listeners.deviceorientation);

  var self = this;
  var deviceOrientation = FULLTILT.getDeviceOrientation({'type': 'game'});
	deviceOrientation.then(function(orientationData) {

		orientationData.listen(function() {

      self.remotephonestate.orientation = orientationData.getScreenAdjustedQuaternion();

		});
  });
}

RemotePhoneListener.prototype.onTouchStart = function (evt) {

  this.remotephonestate.touching = true;
  this.emit(this.type, {type: this.type, state: this.remotephonestate});
}

RemotePhoneListener.prototype.onTouchEnd = function (evt) {

  this.remotephonestate.touching = false;
  this.emit(this.type, {type: this.type, state: this.remotephonestate});
}


RemotePhoneListener.prototype.onDeviceOrientation = function (evt) {

  this.emit(this.type, {type: this.type, state: this.remotephonestate});
};

module.exports = RemotePhoneListener;
