import * as THREE from '../../../../build/three.module.js';
import { XRControllerModelFactory } from '../../webxr/XRControllerModelFactory.js';
import { OculusHandModel } from '../../webxr/OculusHandModel.js';
import { OculusHandPointerModel } from '../../webxr/OculusHandPointerModel.js';

class OculusController extends THREE.EventDispatcher {
    constructor(id, parent, builder, raycastLayerMask) {
        super();
        const scope = this;

        this.eventIDs = ["Trigger", "Side", "", "Joystick", "Bottom", "Top", "Pinch"];

        this.clickTime = 0.1;
        this.handClickTime = 0.5;
        this.enabledHandMove = true;

        this.controller = null;
        this.controllerGrip = null;
        this.controlInput = null;
        this.hand = null;
        this.pointer = null;
        this.rayTube = null;
        this.tempMatrix = new THREE.Matrix4();

        this.side = undefined; // will change once its connected: "right" or "left"

        this.curControl = -1;

        this.firstTimeConnect = false;

        this.raycaster = new THREE.Raycaster();
        if (raycastLayerMask) this.raycaster.layers.mask = raycastLayerMask;

        this.clicked = [];
        this.startsClick = [];
        this.timer = [];
        for (let i = 0; i < 7; i++) {
            this.clicked[i] = false;
            this.startsClick[i] = false;
            this.timer[i] = 0;
        }


        createControllers(parent, builder.renderer, id);

        function createControllers(parent, renderer, id) {

            const controllerModelFactory = new XRControllerModelFactory();
            //modify search controllerModelFactory.path of model

            //controller
            scope.controller = renderer.xr.getController(id);
            scope.controllerGrip = renderer.xr.getControllerGrip(id);
            scope.controlInput = controllerModelFactory.createControllerModel(scope.controllerGrip)
            scope.controllerGrip.add(scope.controlInput);
            scope.hand = renderer.xr.getHand(id);
            // default hand, should be hidden in case another hand comes into play
            scope.hand.add(new OculusHandModel(scope.hand));
            scope.pointer = new OculusHandPointerModel(scope.hand, scope.controller);
            scope.hand.add(scope.pointer);

            builder.loadSmart("https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/models/rayTube/gltf.gltf", {}, function(smart) {
                scope.controller.add(smart.model);
                scope.rayTube = smart.model;
            }, false);

            parent.add(scope.controller);
            parent.add(scope.controllerGrip);
            parent.add(scope.hand);
        }

    }


    tick(clockDelta) {
        this.curControl = this.currentController();
        if (this.curControl = 0) this.getHandInput(clockDelta);
        if (this.curControl = 1) this.getControllerInput(clockDelta);
        if (this.curControl !== -1) this.dispatchEvent({ type: 'onMove' });
    }

    currentController() {
        if (this.controlInput.motionController === null) return -1;
        if (this.controlInput.motionController.xrInputSource.hand !== null) return 0;
        return 1;
    }

    // CONTROLLER INPUT
    getControllerInput(clockDelta) {
        if (this.controlInput.motionController !== null) {
            if (this.side === undefined) {
                this.side = this.controlInput.motionController.xrInputSource.handedness;
                this.dispatchEvent({ type: 'connected', side: this.side });
            }
            //console.log(this.controlInput.motionController.xrInputSource.handedness);
            this.dispatchEvent({ type: 'onControlMove' });
            //axes
            let value = { x: 0, y: 0 };
            if (this.controlInput.motionController.xrInputSource.gamepad.axes[3] > 0.1 || this.controlInput.motionController.xrInputSource.gamepad.axes[3] < -0.1) {
                value.y = this.controlInput.motionController.xrInputSource.gamepad.axes[3];
            }
            if (this.controlInput.motionController.xrInputSource.gamepad.axes[2] > 0.1 || this.controlInput.motionController.xrInputSource.gamepad.axes[2] < -0.1) {
                value.x = this.controlInput.motionController.xrInputSource.gamepad.axes[2];
            }
            if (value.x !== 0 || value.y !== 0)
                this.dispatchEvent({ type: 'onJoystickMove', value: value });


            for (let i = 0; i < 6; i++) {
                if (this.eventIDs[i] != "") {
                    if (this.controlInput.motionController.xrInputSource.gamepad.buttons[i] !== undefined) {
                        if (this.controlInput.motionController.xrInputSource.gamepad.buttons[i].pressed === true) {
                            if (this.startsClick[i] === false) {
                                this.startsClick[i] = true;
                                this.dispatchEvent({ type: 'on' + this.eventIDs[i] + 'Start' });
                            }
                            this.dispatchEvent({ type: 'on' + this.eventIDs[i] + 'Press' })
                            this.timer[i] += clockDelta;
                            if (this.clicked[i] === false && this.timer[i] > this.clickTime) {
                                this.clicked[i] = true;
                            }
                        } else {
                            if (this.clicked[i] === true) {
                                this.dispatchEvent({ type: 'on' + this.eventIDs[i] + 'Click' });
                            }
                            if (this.startsClick[i] === true) {
                                this.dispatchEvent({ type: 'on' + this.eventIDs[i] + 'Release' })
                            }
                            this.timer[i] = 0;
                            this.clicked[i] = false;
                            this.startsClick[i] === false;
                        }
                    }
                }
            }
        }
    }

    getHandInput(clockDelta) {
        this.dispatchEvent({ type: 'onHandMove' });
        if (this.pointer.isPinched()) {
            if (this.startsClick[6] === false) {
                this.startsClick[6] = true;
                this.dispatchEvent({ type: 'on' + this.eventIDs[6] + 'Start' });
            }
            this.dispatchEvent({ type: 'on' + this.eventIDs[6] + 'Press' })
            this.timer[6] += clockDelta;
            if (this.clicked[6] === false && this.timer[6] > this.handClickTime) {
                this.clicked[6] = true;
            }
        } else {
            if (this.clicked[6] === true) {
                this.dispatchEvent({ type: 'on' + this.eventIDs[6] + 'Click' })
            }
            if (this.startsClick[6] === true) {
                this.dispatchEvent({ type: 'on' + this.eventIDs[6] + 'Release' })
            }
            this.timer[6] = 0;
            this.clicked[6] = false;
            this.startsClick[6] === false;
        }
    }
    checkIntersection(object) {
        if (this.raycaster) {
            if (this.curControl === 0) { //hand
                return this.pointer.intersectObject(object);
            }
            if (this.curControl == 1) { //control
                return this.intersectObject(objects, true);
            }
        }

    }

    checkIntersections(objects) {
        if (this.raycaster) {
            if (this.curControl === 0) { //hand
                return this.pointer.intersectObjects(object);
            }
            if (this.curControl == 1) { //control
                return this.intersectObjects(objects, true);
            }
        }

    }

    intersectObject(objects) {
        if (this.raycaster) {
            this.getRaycastDirection();
            return this.raycaster.intersectObject(objects, true);
        }
    }

    intersectObjects(objects) {
        if (this.raycaster) {
            this.getRaycastDirection();
            return this.raycaster.intersectObjects(objects, true);
        }
    }

    getRaycastDirection() {
        this.tempMatrix.identity().extractRotation(this.controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(this.controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
    }
}

export { OculusController }