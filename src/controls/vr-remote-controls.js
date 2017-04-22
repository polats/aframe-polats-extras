require('../lib/Object.polyfill.js');
require('whatwg-fetch');
require('../lib/fulltilt');

var SocketPeer = require('socketpeer'),
    Overlay = require('../lib/overlay');

var DaydreamController = require('../lib/DaydreamController');

var PROXY_URL = 'http://localhost:3000';
if (typeof process !== 'undefined') {
  PROXY_URL = process.env.npm_package_config_proxy_url || PROXY_URL;
}

/**
 * VR-remote-controls - combines proxy-controls, daydream-controller.js and
 * remote-phone-controls for a one component implementation
 *
 * @namespace vr-remote-controls
 * @param {string} proxyUrl - URL of remote WebRTC connection broker.
 * @param {string} proxyPath - Proxy path on connection broken service.
 * @param {string} pairCode - ID for local client. If not specified, a random
 *                          code is fetched from the server.
 * @param {bool} [enabled=true] - To completely enable or disable the remote updates.
 * @param {debug} [debug=false] - Whether to show debugging information in the log.
 */
module.exports = {
  dependencies: ['raycaster'],

  /*******************************************************************
  * Schema
  */

  schema: {
    enabled: { default: true },
    debug: { default: false },

    // WebRTC/WebSocket configuration.
    proxyUrl: { default: PROXY_URL },
    pairCode: { default: '' },

    // Overlay styles
    enableOverlay: {default: true },
    enableOverlayStyles: { default: true },

    // remote cursor
    target: {
        type: "selector"
    },

    debugTextArea: {default: null}

  },

  /**
   * Set if component needs multiple instancing.
   */
  multiple: false,

  /*******************************************************************
  * Initialization
  */

  /**
   * Called once when component is attached. Generally for initial setup.
   */
  init: function () {
    // daydream code
    var self = this;
    this.axis = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.quaternionHome = new THREE.Quaternion();
    this.showRemoteModel = true;
    this.initialized = false;
    this.timeout = null;
    this.touchTimeout = null;

    this.mesh = null;
    this.button1 = null;
    this.button2 = null;
    this.button3 = null;
    this.touch = null;

    this.connect = this.connect.bind(this);

    window.addEventListener('connectDaydream', function (evt) {
      self.connect();
    });

    // proxy code
    /** @type {SocketPeer} WebRTC/WebSocket connection. */
    this.peer = null;

    /** @type {Overlay} Overlay to display pair code. */
    this.overlay = null;

    /** @type {Object} State tracking, keyed by event type. */
    this.state = {};

    if (this.data.pairCode) {
      this.setupConnection(this.data.pairCode);
    } else {
      fetch(this.data.proxyUrl + '/ajax/pair-code')
        .then(function (response) { return response.json(); })
        .then(function (data) { return data.pairCode; })
        .then(this.setupConnection.bind(this))
        .catch(console.error.bind(console));
    }

/*
    // phone-remote code

    // changes raycast direction
    this.data.raycast_rotation =
    {
      x: 0.0,
      y: 0.0,
      z: 0.0
    }

    this.data.localphonestate =
    {
      orientation: {},
      touching: false
    };

    // stores current and initial phone orientation
    this.data.orientation =
    {
      alpha: 0.0,
      beta: 0.0,
      gamma: 0.0,
      initial_value: null
    }

    this.data.raycast_initialized = false;

    // link target cursor
    var el = this.el;
    var data = this.data;

    if (data.target === null) {
        var cursor = document.querySelector("a-cursor");

        if (cursor === null) {
            console.warn("Please put a-cursor in a document");
            return;
        }

        data.target = cursor;
    }

    var orientation = data.orientation;
    var localphonestate = data.localphonestate;

    // orientation listener
    window.addEventListener('deviceorientation', function (evt) {

      localphonestate.orientation.alpha = evt.alpha;
      localphonestate.orientation.beta = evt.beta;
      localphonestate.orientation.gamma = evt.gamma;

		}, true);

    // touch to recenter cursor
    window.addEventListener('touchstart', function (evt) {

      if (orientation.initial_value != null)
      {
        orientation.initial_value =
        {
            alpha: orientation.alpha,
            beta: orientation.beta,
            gamma: orientation.gamma
        };
      }

		}, true);


    // cursor raycaster listener
    el.addEventListener("raycaster-intersection", function(e) {

        var intersection = getNearestIntersection(e.detail.intersections);
        if (!intersection) {return;}

        // a matrix which represents item's movement, rotation and scale on global world
        var mat = intersection.object.matrixWorld;
        // remove parallel movement from the matrix
        mat.setPosition(new THREE.Vector3(0, 0, 0));

        // change local normal into global normal
        var global_normal = intersection.face.normal.clone().applyMatrix4(mat).normalize();

        // look at target coordinate = intersection coordinate + global normal vector
        var lookAtTarget = new THREE.Vector3().addVectors(intersection.point, global_normal);
        data.target.object3D.lookAt(lookAtTarget);

        // cursor coordinate = intersection coordinate + normal vector * 0.05(hover 5cm above intersection point)
        var cursorPosition = new THREE.Vector3().addVectors(intersection.point, global_normal.multiplyScalar(0.05));
        data.target.setAttribute("position", cursorPosition);

        function getNearestIntersection(intersections) {
            for (var i = 0, l = intersections.length; i < l; i++) {

                // ignore cursor itself to avoid flicker && ignore "ignore-ray" class
                if (data.target === intersections[i].object.el || intersections[i].object.el.classList.contains("ignore-ray")) {continue;}
                return intersections[i];
            }
            return null;
        }
      });
*/

  // initialize full tilt
  this.localRemoteState =
  {
    isClickDown: false,
    isAppDown: false,
    isHomeDown: false,
    isVolPlusDown: false,
    isVolMinusDown: false,
    xTouch: 0,
    yTouch: 0,
    isTouchingScreen: false
  };

  this.activeState = null;
  const PRESS_THRESHOLD = 300;
  var self = this;

	// Start FULLTILT DeviceOrientation listeners and register our callback
	var deviceOrientation = FULLTILT.getDeviceOrientation({'type': 'game'});
	deviceOrientation.then(function(orientationData) {

		orientationData.listen(function() {

      self.localRemoteState.orientationData = orientationData;

		});
	});

  // initialize touch options
  window.addEventListener('touchstart', function (evt) {
      var touches = evt.touches;
      if ( self.touchTimeout !== null ) {
        clearTimeout( self.touchTimeout );
        self.touchTimeout = null;
      }


      self.touchTimeout = setTimeout( function () {
        switch (touches.length)
        {
          case 1:
            self.localRemoteState.isClickDown = true;
            break;
          case 2:
          self.localRemoteState.isAppDown = true;
            break;
          case 3:
          self.localRemoteState.isHomeDown = true;
            break;
        };
      }, PRESS_THRESHOLD );
  });

  window.addEventListener('touchmove', function (evt) {
    if (self.touchTimeout !== null)
    {
      clearTimeout( self.touchTimeout );
      self.touchTimeout = null;
      self.touchTimeout = setTimeout( function () {
        switch (touches.length)
        {
          case 1:
            self.localRemoteState.isClickDown = true;
            break;
          case 2:
          self.localRemoteState.isAppDown = true;
            break;
          case 3:
          self.localRemoteState.isHomeDown = true;
            break;
        };
      }, PRESS_THRESHOLD );
    }
  });

  window.addEventListener('touchend', function (evt) {
    var touches = evt.touches;
    if (touches.length == 0)
    {
      if ( self.touchTimeout !== null ) {
        clearTimeout( self.touchTimeout );
        self.touchTimeout = null;
      }
    }
      if (touches.length < 3)
        self.localRemoteState.isHomeDown = false;
      if (touches.length < 2)
        self.localRemoteState.isAppDown = false;
      if (touches.length < 1)
        self.localRemoteState.isClickDown = false;
  });

  },

  update: function() {
      // initialize 3d model
      var ddjson = 'https://cdn.rawgit.com/polats/aframe-polats-extras/af4b6e66/assets/daydream.json';
      var self = this;

      var loader = new THREE.BufferGeometryLoader()
      loader.load( ddjson, function ( geometry ) {

        var material = new THREE.MeshPhongMaterial( { color: 0x888899, shininess: 15, side: THREE.DoubleSide } );
        self.mesh = new THREE.Mesh( geometry, material );
        self.mesh.rotation.x = Math.PI / 2;

        var geometry = new THREE.CircleBufferGeometry( 0.00166, 24 );
        self.button1 = new THREE.Mesh( geometry, material.clone() );
        self.button1.position.y = 0.0002;
        self.button1.position.z = - 0.0035;
        self.button1.rotation.x = - Math.PI / 2;
        self.mesh.add( self.button1 );

        var geometry = new THREE.CircleBufferGeometry( 0.00025, 24 );
        self.touch = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { blending: THREE.AdditiveBlending, opacity: 0.2, transparent: true } ) );
        self.touch.position.z = 0.0001;
        self.touch.visible = false;
        self.button1.add( self.touch );

        var geometry = new THREE.CircleBufferGeometry( 0.0005, 24 );
        self.button2 = new THREE.Mesh( geometry, material.clone() );
        self.button2.position.y = 0.0002;
        self.button2.position.z = - 0.0008;
        self.button2.rotation.x = - Math.PI / 2;
        self.mesh.add( self.button2 );

        self.button3 = new THREE.Mesh( geometry, material.clone() );
        self.button3.position.y = 0.0002;
        self.button3.position.z = 0.0008;
        self.button3.rotation.x = - Math.PI / 2;
        self.mesh.add( self.button3 );

        self.mesh.scale.set(20, 20, 20);

        self.el.setObject3D('mesh', self.mesh);

      } );
    },

  connect: function () {
    var data = this.data;
    var self = this;

    this.controller = new DaydreamController();

    this.controller.onStateChange( function ( state ) {

      self.daydreamRemote = true;
      self.localRemoteState = state;

    } );
    this.controller.connect();

  },

  updateRemoteModel: function () {

    var state = this.activeState;

      this.button1.material.emissive.g = state.isClickDown ? 0.5 : 0;
      this.button2.material.emissive.g = state.isAppDown ? 0.5 : 0;
      this.button3.material.emissive.g = state.isHomeDown ? 0.5 : 0;

      this.touch.position.x = ( state.xTouch * 2 - 1 ) / 1000;
      this.touch.position.y = - ( state.yTouch * 2 - 1 ) / 1000;

      this.touch.visible = state.xTouch > 0 && state.yTouch > 0;

  },

  updateOrientation: function () {

      var state = this.activeState;

      if (this.daydreamRemote)
      {
        var axis = this.axis;

        var angle = Math.sqrt( state.xOri * state.xOri + state.yOri * state.yOri + state.zOri * state.zOri );

        if ( angle > 0 ) {

          axis.set( state.xOri, state.yOri, state.zOri )
          axis.multiplyScalar( 1 / angle );

          this.quaternion.setFromAxisAngle( axis, angle );

        } else {

          this.quaternion.set( 0, 0, 0, 1 );

        }
      }

      else
      {
        var quat = null;

        if (this.isConnected())
        {
          quat = state.orientation;
        }
        else
        {
          if (state.orientationData)
            quat = state.orientationData.getScreenAdjustedQuaternion();
        }

        if (quat)
          this.quaternion.set(quat.x, quat.z, -quat.y, quat.w);
      }

      if ( this.initialised === false ) {

        this.quaternionHome.copy( this.quaternion );
        this.quaternionHome.inverse();

        this.initialised = true;

      }

      this.mesh.quaternion.copy( this.quaternionHome );
      this.mesh.quaternion.multiply( this.quaternion );

  },

  getRemoteState: function () {
    if (this.isConnected()) {
      return this.getProxyRemoteState();
    }
    return this.localRemoteState;
  },

  printDebug: function()
  {
    var debugTextArea = null;

    if (this.data.debugTextArea != null)
      debugTextArea = document.querySelector(this.data.debugTextArea);

      if (debugTextArea != null)
        debugTextArea.textContent = JSON.stringify( this.localRemoteState, null, '\t' );

  },

  processInput: function()
  {
    var state = this.activeState;
    var self = this;

    if ( state.isHomeDown ) {

      if ( this.timeout === null ) {

        this.timeout = setTimeout( function () {

          self.quaternionHome.copy( self.quaternion );
          self.quaternionHome.inverse();

        }, 1000 );

      }

    } else {

      if ( this.timeout !== null ) {

        clearTimeout( this.timeout );
        this.timeout = null;

      }

    }

  },

  /**
   * Called on each scene tick.
   */
  tick: function (t) {
      var data = this.data;
      var el = this.el;
      var self = this;

      // get latest state
      self.activeState = this.getRemoteState();

      if (self.activeState != null)
      {
          this.updateOrientation();

          if (self.showRemoteModel)
            this.updateRemoteModel();

          this.processInput();
          this.printDebug();
      }

      if (data.raycast_initialized) {

        // rotate raycaster depending on orientation
        var rotation = el.getAttribute('rotation');

        rotation.y = data.orientation.alpha - data.orientation.initial_value.alpha;
        rotation.x = data.orientation.beta - data.orientation.initial_value.beta;
        rotation.z = data.orientation.gamma - data.orientation.initial_value.gamma;

        el.setAttribute('rotation', rotation);
     }
  },

  /*******************************************************************
  * WebRTC Connection
  */

  setupConnection: function (pairCode) {
    var data = this.data;

    if (!data.proxyUrl) {
      console.error('proxy-controls "proxyUrl" property not found.');
      return;
    }

    var peer = this.peer = new SocketPeer({
      pairCode: pairCode,
      url: data.proxyUrl + '/socketpeer/'
    });

    this.el.emit('proxycontrols.paircode', {pairCode: pairCode});
    this.createOverlay(pairCode);

    peer.on('connect', this.onConnection.bind(this));
    peer.on('disconnect', this.createOverlay.bind(this, pairCode));
    peer.on('error', function (error) {
      if (data.debug) console.error('peer:error(%s)', error.message);
    });

    // Debugging
    if (data.debug) {
      peer.on('connect', console.info.bind(console, 'peer:connect("%s")'));
      peer.on('upgrade', console.info.bind(console, 'peer:upgrade("%s")'));
    }

    // Add Daydream Button code

    var self = this;
    var daydreamLink = document.querySelector("#daydreamLink");
    daydreamLink.addEventListener( 'click' , function () {
      self.el.emit("connectDaydream");
    });
  },

  onConnection: function () {
    if (this.data.debug) console.info('peer:connection()');
    if (this.overlay) this.overlay.destroy();
    this.peer.on('data', this.onEvent.bind(this));
  },

  createOverlay: function (pairCode) {
    if (this.data.enableOverlay) {
      this.overlay = new Overlay(
        pairCode,
        this.data.proxyUrl, // + '/#/connect',
        this.data.enableOverlayStyles
      );
    }
  },

  /*******************************************************************
  * Remote event propagation
  */

  onEvent: function (event) {
    if (!this.data.enabled) {
      return;
    } else if (!event.type) {
      if (this.data.debug) console.warn('Missing event type.');
    } else if (event.type === 'ping') {
      this.peer.send(event);
    } else {
      this.state[event.type] = event.state;
    }
  },

  /*******************************************************************
  * Accessors
  */

  /**
   * Returns true if the ProxyControls instance is currently connected to a
   * remote peer and able to accept input events.
   *
   * @return {boolean}
   */
  isConnected: function () {
    var peer = this.peer || {};
    return peer.socketConnected || peer.rtcConnected;
  },

  /**
   * Returns the Gamepad instance at the given index, if any.
   *
   * @param  {number} index
   * @return {Gamepad}
   */
  getGamepad: function (index) {
    return (this.state.gamepad || {})[index];
  },

  /**
   * Returns an object representing keyboard state. Object will have keys
   * for every pressed key on the keyboard, while unpressed keys will not
   * be included. For example, while pressing Shift+A, this function would
   * return: `{SHIFT: true, A: true}`.
   *
   * @return {Object}
   */
  getKeyboard: function () {
    return this.state.keyboard || {};
  },

  /**
   * Returns an object representing remote phone state, containing
   * orientation data and touch / gesture states.
   *
   * @return {Object}
   */
  getProxyRemoteState: function () {
    return this.state.remotephone;
  },

  /**
   * Generic accessor for custom input types.
   *
   * @param {string} type
   * @return {Object}
   */
  get: function (type) {
    return this.state[type];
  },

  /*******************************************************************
  * Dealloc
  */

  /**
   * Called when a component is removed (e.g., via removeAttribute).
   * Generally undoes all modifications to the entity.
   */
  remove: function () {
    if (this.peer) this.peer.destroy();
    if (this.overlay) this.overlay.destroy();
    if (this.el) this.el.removeObject3D('mesh');
  }
};
