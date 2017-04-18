module.exports = {
  'comet-trail': require('./comet-trail'),

  registerAll: function (AFRAME) {
    if (this._registered) return;

    AFRAME = AFRAME || window.AFRAME;

    if (!AFRAME.components['comet-trail'])  AFRAME.registerComponent('comet-trail', this['comet-trail']);

    this._registered = true;
  }
};
