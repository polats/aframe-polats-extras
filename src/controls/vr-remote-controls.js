require('../lib/Object.polyfill.js');
require('whatwg-fetch');

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
  },

  connect: function () {
    var data = this.data;
    var self = this;
    var debugTextArea = null;

    this.controller = new DaydreamController();
    if (this.data.debugTextArea)
      debugTextArea = document.querySelector(this.data.debugTextArea);

    this.controller.onStateChange( function ( state ) {
      self.daydreamRemote = true;

      debugTextArea.textContent = JSON.stringify( state, null, '\t' );

      if ( self.showRemoteModel ) {

        var angle = Math.sqrt( state.xOri * state.xOri + state.yOri * state.yOri + state.zOri * state.zOri );

        if ( angle > 0 ) {

          self.axis.set( state.xOri, state.yOri, state.zOri )
          self.axis.multiplyScalar( 1 / angle );

          self.quaternion.setFromAxisAngle( self.axis, angle );

          if ( self.initialised === false ) {

            self.quaternionHome.copy( self.quaternion );
            self.quaternionHome.inverse();

            self.initialised = true;

          }

        } else {

          self.quaternion.set( 0, 0, 0, 1 );

        }

        if ( state.isHomeDown ) {

          if ( self.timeout === null ) {

            self.timeout = setTimeout( function () {

              self.quaternionHome.copy( self.quaternion );
              self.quaternionHome.inverse();

            }, 1000 );

          }

        } else {

          if ( self.timeout !== null ) {

            clearTimeout( self.timeout );
            self.timeout = null;

          }

        }
      }


    } );
    this.controller.connect();

  },

  updateOrientation: function () {

    var phonestate = this.getPhoneState();

    if (phonestate === undefined)
      return;

    var data = this.data;
    var orientation = data.orientation;

    if (orientation.initial_value == null)
    {

      if (phonestate.orientation.alpha != undefined)
      {
          // set initial start rotation
          orientation.initial_value =
          {
            alpha: phonestate.orientation.alpha,
            beta: phonestate.orientation.beta,
            gamma: phonestate.orientation.gamma
          };

          data.raycast_initialized = true;
        }
    }

    if (data.raycast_initialized)
    {

      // store event orientation values
      orientation.alpha =  phonestate.orientation.alpha;
      orientation.beta = phonestate.orientation.beta;
      orientation.gamma = phonestate.orientation.gamma;

    }
  },

  getPhoneState: function () {
    if (this.isConnected()) {
      return this.getRemotePhoneState();
    }
    return this.data.localphonestate;
  },

  /**
   * Called on each scene tick.
   */
  tick: function (t) {
      var data = this.data;
      var el = this.el;

      this.updateOrientation();

      if (data.raycast_initialized) {

        // rotate raycaster depending on orientation
        var rotation = el.getAttribute('rotation');

        rotation.y = data.orientation.alpha - data.orientation.initial_value.alpha;
        rotation.x = data.orientation.beta - data.orientation.initial_value.beta;

        el.setAttribute('rotation', rotation);

        rotation = el.getAttribute('rotation');
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
   * orientation data (alpha, beta, gamma) and touch / gesture states.
   *
   * @return {Object}
   */
  getRemotePhoneState: function () {
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
  }
};
