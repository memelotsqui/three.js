import { SmartObject, ObjectComponent } from './SmartObject.js'

class SmartTeleporter extends SmartObject {
    constructor(gltf, customData, builder, onLoad) { // must be called when loaded-
        super(gltf, customData, builder, onLoad);
    }
    setupVars() {
        this.timeInStart = 1; // the time it takes to make everything completely invisible
        this.timeInEnd = 1; // the time it takes to be invisible again
        this._counter = 0;
        this._inUse = false;
        this._teleporting = false;
        this._setEndPosition = false;

        this.onTeleportStarted = null;

    }
    beforeExtras() {

    }

    afterExtras() {
        this.gltf.materials.forEach(mat => {
            mat.fog = false;
        });
    }

    setSmartObjectData(customData) {

    }

    smartTick(clockDelta) {
        if (this._inUse === true) {
            if (this._teleporting === true) {
                if (this._counter < this.timeInStart) {
                    this._counter += clockDelta;
                } else {
                    if (this.onTeleportStarted != null) {
                        this.onTeleportStarted();
                        this.onTeleportStarted = null;
                    }
                }
            } else {
                if (this._counter > 0) {
                    this._counter -= clockDelta;
                    if (this._setEndPosition === true) {
                        this._setEndPosition = false;
                        this.moveToUserPosition();
                    }

                } else {
                    this._counter = 0;
                    this._inUse = false;
                    this.setActive(false);
                }
            }
        }
    }

    startTeleport(onTeleportStarted) {
        if (this.onTeleportStarted != null) {
            this.onTeleportStarted();
            this.onTeleportStarted = null;
        }
        this.onTeleportStarted = onTeleportStarted;
        this.setActive(true);
        this._teleporting = true;
        this._inUse = true;
        this._counter = 0;


        this.moveToUserPosition();
        this.setFog({ r: 1, g: 1, b: 1 }, 10, 5);
        const scale = this.model.userData.background.cubeTexture.scale || 1;
        this.setSkybox(this.gltf.cubeTextures[this.model.userData.environment], 0.2, { scale: scale });

    }
    endTeleport() {
        if (this.onTeleportStarted != null) {
            this.onTeleportStarted();
            this.onTeleportStarted = null;
        }
        this._counter = this.timeInEnd;
        this._teleporting = false;
        this._setEndPosition = true;

        this.setFog({ r: 1, g: 1, b: 1 }, 0, 1);

    }

    addToScene() {
        /* override to avoid doing it */
    }

}




export { SmartTeleporter as default };