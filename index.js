module.exports = {
  controls:   require('./src/controls'),
  graphics:   require('./src/graphics'),

  registerAll: function () {
    this.controls.registerAll();
    this.graphics.registerAll();
  }
};
