# Controls

Components giving additional control options from default A-Frame.

- **vr-remote-controls**: Uses either [daydream-controller.js](https://github.com/mrdoob/daydream-controller.js/) for movement via a Daydream Controller, or [ProxyControls.js](http://proxy-controls.donmccurdy.com/) to use a mobile phone as an emulator controller
- **rts-controls**: Use a mouse or touch to move an entity in 3rd person view, similar to an RTS. Requires a reference raycast camera if the player can change cameras

## Usage

Using Daydream Controller (take note this only works on trusted sites (localhost / https:// )):

```html
<a-entity camera vr-remote-controls></a-entity>
```

Using ProxyControls (requires the included proxy server code to be run):

```html
<a-entity camera vr-remote-controls="proxy: true"></a-entity>
```

Using Mouse RTS Controller:
```html
<a-entity mouse-rts-controls="raycastCamera: #playerCamera"></a-entity>
```
