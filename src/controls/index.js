module.exports = {
  'vr-remote-controls': require('./vr-remote-controls'),
  'rts-controls': require('./rts-controls'),

  registerAll: function (AFRAME) {
    if (this._registered) return;

    AFRAME = AFRAME || window.AFRAME;

    if (!AFRAME.components['vr-remote-controls'])  AFRAME.registerComponent('vr-remote-controls', this['vr-remote-controls']);
    if (!AFRAME.components['rts-controls'])  AFRAME.registerComponent('rts-controls', this['rts-controls']);

    this._registered = true;
  }
};
