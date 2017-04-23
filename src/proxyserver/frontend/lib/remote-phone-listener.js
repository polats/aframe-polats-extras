var Listener = require('./listener'),
    util = require('util');

require('../../../lib/fulltilt.js')

function RemotePhoneListener () {
  Listener.call(this);

  this.title = 'Remote Phone';
  this.type = 'remotephone';
  this.component = 'remote-phone-controls';
  this.github = 'https://github.com/polats/aframe-remote-phone-controls-component';

  // initialize full tilt
  this.localRemoteState =
  {
    isClickDown: false,
    isAppDown: false,
    isHomeDown: false,
    isVolPlusDown: false,
    isVolMinusDown: false,
    xTouch: 0,
    yTouch: 0
    };

  this.tapFingerCount = 0;
  this.pressedFingerCount = 0;
  this.activeState = null;
  this.ongoingTouch = null;
  const PRESS_THRESHOLD = 300;
  const TAP_THRESHOLD = 100;
  const TAP_DURATION = 20;
  const TRACKPAD_SPEED = 0.025;

  // timeouts for processing button presses
  this.timeout = null;
  this.touchTimeout = null;
  this.tapTimeout = null;
  this.tapPressTimeout = null;
}

util.inherits(RemotePhoneListener, Listener);

RemotePhoneListener.prototype.bind = function () {
  Listener.prototype.bind.call(this);

  this.__listeners.touchstart = this.onTouchStart.bind(this);
  this.__listeners.touchmove = this.onTouchMove.bind(this);
  this.__listeners.touchend = this.onTouchEnd.bind(this);
  this.__listeners.deviceorientation = this.onDeviceOrientation.bind(this);

  window.addEventListener('touchstart', this.__listeners.touchstart);
  window.addEventListener('touchmove', this.__listeners.touchmove);
  window.addEventListener('touchend', this.__listeners.touchend);
  window.addEventListener('deviceorientation', this.__listeners.deviceorientation);

  var self = this;
  var deviceOrientation = FULLTILT.getDeviceOrientation({'type': 'game'});
	deviceOrientation.then(function(orientationData) {

		orientationData.listen(function() {

      self.localRemoteState.orientation = orientationData.getScreenAdjustedQuaternion();

		});
  });
}

RemotePhoneListener.prototype.onTouchStart = function (evt) {

  var touches = evt.touches;

  // remove press timeouts
  if ( this.touchTimeout !== null ) {
    clearTimeout( this.touchTimeout );
    this.touchTimeout = null;
  }

  if (this.tapTimeout !== null)
  {
    clearTimeout( this.tapTimeout );
    this.tapTimeout = null;
  }

  if (touches.length == 1)
  {
    // start trackpad
    this.localRemoteState.xTouch = 0.5;
    this.localRemoteState.yTouch = 0.5;
    this.ongoingTouch =
    {
      pageX: touches[0].pageX,
      pageY: touches[0].pageY
    };
  }

  // only process trackpad on single touch
  else
  {
    this.localRemoteState.xTouch = 0;
    this.localRemoteState.yTouch = 0;
    this.ongoingTouch = null;
  }

  // start tap touchTimeout
  this.tapFingerCount += 1;

  this.tapTimeout = setTimeout( function () {
    this.tapFingerCount = 0;
  }, TAP_THRESHOLD);


  // set press function
  this.touchTimeout = setTimeout( function () {
    switch (touches.length)
    {
      case 1:
        this.localRemoteState.isClickDown = true;
        break;
      case 2:
      this.localRemoteState.isAppDown = true;
        break;
      case 3:
      this.localRemoteState.isHomeDown = true;
        break;
    };
  }, PRESS_THRESHOLD );

  this.emit(this.type, {type: this.type, state: this.localRemoteState});
}

RemotePhoneListener.prototype.onTouchMove = function (evt) {
  if (this.touchTimeout !== null)
  {
    clearTimeout( this.touchTimeout );
    this.touchTimeout = null;
  }

  var touches = evt.touches;
  var changedTouches = evt.changedTouches;

  // only process touch on single fingers
  if (changedTouches.length === 1)
  {
    var xMove = 0.5 + ((changedTouches[0].pageX - this.ongoingTouch.pageX) * TRACKPAD_SPEED);
    var yMove = 0.5 + ((changedTouches[0].pageY - this.ongoingTouch.pageY) * TRACKPAD_SPEED);

    if (xMove < 0) xMove = 0.0001;
    if (xMove > 1) xMove = 1;
    if (yMove < 0) yMove = 0.0001;
    if (yMove > 1) yMove = 1;

      this.localRemoteState.xTouch = xMove;
      this.localRemoteState.yTouch = yMove;
  }

  this.emit(this.type, {type: this.type, state: this.localRemoteState});

}

RemotePhoneListener.prototype.onTouchEnd = function (evt) {

  var touches = evt.touches;

  // clear press timeout
  if (touches.length == 0)
  {
    if ( this.touchTimeout !== null ) {
      clearTimeout( this.touchTimeout );
      this.touchTimeout = null;
    }

    // process tap
    if (this.tapFingerCount > 0)
    {
      if (this.tapTimeout !== null)
      {
        clearTimeout( this.tapTimeout );
        this.tapTimeout = null;
      }

      this.pressedFingerCount = this.tapFingerCount;

      switch (this.pressedFingerCount)
      {
        case 1:
          this.localRemoteState.isClickDown = true;
          break;
        case 2:
        this.localRemoteState.isAppDown = true;
          break;
        case 3:
        this.localRemoteState.isHomeDown = true;
          break;
      }

      // keep pressed for tap duration
      this.touchTimeout = setTimeout( function () {
        switch (this.pressedFingerCount)
        {
          case 1:
            this.localRemoteState.isClickDown = false;
            break;
          case 2:
          this.localRemoteState.isAppDown = false;
            break;
          case 3:
          this.localRemoteState.isHomeDown = false;
            break;
        };

        this.pressedFingerCount = 0;
      }, TAP_DURATION );

    }

    this.localRemoteState.xTouch = 0;
    this.localRemoteState.yTouch = 0;
    this.tapFingerCount = 0;
  }

    // disable presses
    if (this.pressedFingerCount == 0)
    {
      if (touches.length < 3)
        this.localRemoteState.isHomeDown = false;
      if (touches.length < 2)
        this.localRemoteState.isAppDown = false;
      if (touches.length < 1)
        this.localRemoteState.isClickDown = false;
    }

    this.ongoingTouch = null;

  this.emit(this.type, {type: this.type, state: this.localRemoteState});
}


RemotePhoneListener.prototype.onDeviceOrientation = function (evt) {

  this.emit(this.type, {type: this.type, state: this.localRemoteState});
};

module.exports = RemotePhoneListener;
