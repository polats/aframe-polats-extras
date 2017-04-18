module.exports = {
  'vr-remote-controls': require('./vr-remote-controls'),
  'mouse-rts-controls': require('./mouse-rts-controls'),

  registerAll: function (AFRAME) {
    if (this._registered) return;

    AFRAME = AFRAME || window.AFRAME;

    if (!AFRAME.components['vr-remote-controls'])  AFRAME.registerComponent('vr-remote-controls', this['vr-remote-controls']);
    if (!AFRAME.components['mouse-rts-controls'])  AFRAME.registerComponent('mouse-rts-controls', this['mouse-rts-controls']);

    this._registered = true;
  }
};
