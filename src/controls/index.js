module.exports = {
  'remote-phone-controls': require('./remote-phone-controls'),
  'daydream-controls':  require('./daydream-controls'),

  registerAll: function (AFRAME) {
    if (this._registered) return;

    AFRAME = AFRAME || window.AFRAME;

    if (!AFRAME.components['remote-phone-controls'])  AFRAME.registerComponent('remote-phone-controls', this['remote-phone-controls']);
    if (!AFRAME.components['daydream-controls'])     AFRAME.registerComponent('daydream-controls',    this['daydream-controls']);

    this._registered = true;
  }
};
