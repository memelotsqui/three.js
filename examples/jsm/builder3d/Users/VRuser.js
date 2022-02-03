import * as THREE from '../../../../build/three.module.js';
import { XRControllerModelFactory } from '../../webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from '../../webxr/XRHandModelFactory.js';
import { OculusHandModel } from '../../webxr/OculusHandModel.js';
import { OculusHandPointerModel } from '../../webxr/OculusHandPointerModel.js';
import { OculusController } from '../Controllers/OculusController.js'
import ThreeMeshUI from '../../three-mesh-ui/three-mesh-ui.js'

class VRuser {
    constructor(builder, rules) {

        const scope = this;
        const camera = builder.camera;
        this.rules = rules;

        this.user = new THREE.Group();
        this.user.position.set(0, 0, 0);
        this.user.add(builder.camera);

        this.vrKeyboard = null
            //https://ipfs.io/ipfs/QmYmL1Q2z1DTyVsRuHkiYA3b1apnLipooGigvcpphK1DuL
        builder.loadSmart("https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/models/keyboard_58/gltf.gltf", {
            onSubmit: builder.loadSmart,
            context: builder,
            height: 0.5 //,
                //targetLookAt: builder.camera
        }, function onLoad(smart) {
            //console.log("loaded kayboard");
            scope.vrKeyboard = smart;
            //smart.setActive(false);
        }, false);


        this.scene = builder.scene;

        let layers = new THREE.Layers();
        layers.disableAll();
        layers.enable(30);
        this.control0 = new OculusController(0, this.user, builder, layers.mask);
        this.control1 = new OculusController(1, this.user, builder, layers.mask);
        console.log(this.control0);

        this.control0.addEventListener("connected", function(evt) {
            console.log(evt);
            if (evt.side === "right")
                rightControlListener(scope.control0);
            if (evt.side === "left")
                leftControlListener(scope.control0);
        });
        this.control1.addEventListener("connected", function(evt) {
            console.log(evt);
            if (evt.side === "right")
                rightControlListener(scope.control1);
            if (evt.side === "left")
                leftControlListener(scope.control1);
        });


        function rightControlListener(ctrl) {
            console.log(ctrl);
            ctrl.addEventListener("onTriggerClick", rightControlOnTriggerClick);
            ctrl.addEventListener("onMove", rightControlOnMove);
            ctrl.addEventListener("onTopClick", rightControlOnTopClick);
        }

        function leftControlListener(ctrl) {
            console.log(ctrl)
        }

        function forwardDirection() {
            let fwdDirection = new THREE.Vector3;
            fwdDirection.z = -camera.matrixWorld.elements[0];
            fwdDirection.x = -camera.matrixWorld.elements[8];
            return fwdDirection;

        }


        //RIGHT CONTROL
        function rightControlOnTopClick(event) { //toggle virtual keyboard
            if (scope.vrKeyboard != null) {
                scope.vrKeyboard.setActive();
                if (scope.vrKeyboard.isActive) {
                    const pos = scope.user.position.clone().add(forwardDirection().multiplyScalar(1));
                    scope.vrKeyboard.setData({ position: pos, visible: true });
                    scope.vrKeyboard.model.lookAt(camera.getWorldPosition());
                }
            }
        }

        function rightControlOnTriggerClick(event) {
            const hits = this.checkIntersections(scope.scene.children);
            handleRaycastHit(hits)

        }

        function rightControlOnMove() {
            const hits = this.checkIntersections(scope.scene.children);
            handleRaycastHover(hits)

        }

        function handleRaycastHit(hits) {
            if (hits !== undefined) {
                if (hits.length !== undefined) {
                    if (hits.length > 0) {
                        const firstHit = hits[0].object.userData.gameObject;
                        if (firstHit !== undefined) {
                            if (firstHit.userData.teleport !== undefined) {
                                scope.moveToPosition(hits[0].point);
                            }
                            if (firstHit.userData.components !== undefined) {
                                firstHit.userData.components.forEach((c) => {
                                    c.onRaycastHit({ vruser: scope, hits: hits });
                                });
                            }
                        }
                    }
                }
            }
        }

        let lastHoverObject = null;

        function handleRaycastHover(hits) {
            let hitsObject = false;
            if (hits !== undefined) {
                if (hits.length !== undefined) {
                    if (hits.length > 0) {
                        hitsObject = true;
                        onRaycastHoverEnter(hits[0].object.userData.gameObject, hits);
                    }
                }
            }
            if (hitsObject === false) {
                onRaycastHoverExit();
            }
        }

        function onRaycastHoverEnter(object, intersectObjects) { //ON HOVER ENTER / ON HOVER EXIT
            let newObject = false;

            if (object !== undefined) {
                if (object !== lastHoverObject) {
                    newObject = true;
                    if (object.userData.components !== undefined) {
                        object.userData.components.forEach((c) => {
                            c.onHoverEnter({ intersectObjects: intersectObjects });
                        });
                    }
                }
            }
            if (newObject) { //call on hover exit on all components of the object if it has any component
                if (lastHoverObject != null) {
                    if (lastHoverObject.userData.components !== undefined) {
                        lastHoverObject.userData.components.forEach((c) => {
                            c.onHoverExit({ intersectObjects: intersectObjects });
                        });
                    }
                }
                lastHoverObject = object;
            }
        }

        function onRaycastHoverExit() {
            if (lastHoverObject !== null) {
                if (lastHoverObject.userData.components !== undefined) {
                    lastHoverObject.userData.components.forEach((c) => {
                        c.onHoverExit();
                    });
                }
                lastHoverObject = null;
            }
        }



        builder.scene.add(this.user);
    }
    tick(clockDelta) {
        ThreeMeshUI.update();
        this.control0.tick(clockDelta);
        this.control1.tick(clockDelta);
    }
    setPositionWitObject(obj) {
        let v3 = new THREE.Vector3();
        obj.getWorldPosition(v3)
        this.moveToPosition(v3);
        //this.user.position.set(v3.x, v3.y, v3.z)
    }
    moveToPosition(position) {
        this.user.position.set(position.x, position.y, position.z);
    }

}

class OculusControl {

    constructor(VRuser, builder, id) {
        const scope = this;

        this.scene = builder.scene;

        this.valid = true;
        this.clicked = [false, false, false, false, false, false];
        this.timer = [0, 0, 0, 0, 0, 0];
        this.clickTime = 0.1;
        this.handClickTime = 0.5;
        this.enabledHandMove = true;

        this.controller = null;
        this.controllerGrip = null;
        this.controlInput = null;
        this.hand = null;
        this.pointer = null;

        this.whiteColor = new THREE.Color(0x0000ff);
        this.hitColor = new THREE.Color(0x22ff00);
        this.missColor = new THREE.Color(0xff0000);
        this.lineMaterial = new THREE.LineBasicMaterial({
            color: this.whiteColor
        });
        this.raycastLine = null;

        this.raycaster = null;
        this.hitObject = null;
        this.raycastPos = new THREE.Vector3();
        this.raycastDir = new THREE.Vector3();
        this.tempMatrix = new THREE.Matrix4();

        // this.lerpoPos = new THREE.Vector3();
        // this.lerpRot = new THREE.Vector3();

        this.camera = builder.camera;
        this.fwdDirection = new THREE.Vector3();

        this.gamePad = null;

        this.VRuser = VRuser;

        if (this.pointer != undefined && this.hand != undefined) {
            if (this.pointer.isPinched == undefined) {
                this.valid = false;
            }
        } else {
            this.valid = false;
        }

        createControllers(VRuser, builder.renderer, id);

        function createControllers(VRuser, renderer, id) {
            const controllerModelFactory = new XRControllerModelFactory();


            //controller
            scope.controller = renderer.xr.getController(id);
            VRuser.user.add(scope.controller);


            //raycastline
            const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);

            scope.raycastLine = new THREE.Line(geometry, scope.lineMaterial);
            scope.raycastLine.name = 'line';
            scope.raycastLine.scale.z = 5;
            //scope.raycastLine.layers.set(2);

            scope.controller.add(scope.raycastLine);
            console.log("test");

            //controller grip
            scope.controllerGrip = renderer.xr.getControllerGrip(id);
            scope.controlInput = controllerModelFactory.createControllerModel(scope.controllerGrip)
            scope.controllerGrip.add(scope.controlInput);
            VRuser.user.add(scope.controllerGrip);
            //console.log(scope.controllerGrip);

            //hand
            scope.hand = renderer.xr.getHand(id);
            scope.hand.add(new OculusHandModel(scope.hand));
            scope.pointer = new OculusHandPointerModel(scope.hand, scope.controller);
            scope.hand.add(scope.pointer);



            //raycaster
            let raycaster = new THREE.Raycaster();
            raycaster.layers.disableAll();
            raycaster.layers.enable(30); //only objects in layer 30
            raycaster.distance = 5;
            scope.raycaster = raycaster

            VRuser.user.add(scope.hand);
        }

    }

    tick(clockDelta) {
        this.handleInputControls(clockDelta);
    }

    handleInputControls(clockDelta) {
        if (this.controlInput.motionController !== null) {
            if (this.controlInput.motionController.xrInputSource.hand !== null) { //hand section
                this.setHandRaycastLayers();
                this.moveWithHandInput(clockDelta);
            } else {
                this.moveWithControllerInput(clockDelta);
            }
        }
    }



    // CONTROLLER INPUT
    moveWithControllerInput(clockDelta) {
        if (this.controlInput.motionController !== null) {

            //this.hoverRay(clockDelta);

            this.fwdDirection.z = -this.camera.matrixWorld.elements[0];
            this.fwdDirection.x = -this.camera.matrixWorld.elements[8];

            if (this.controlInput.motionController.xrInputSource.gamepad.axes[3] > 0.1 || this.controlInput.motionController.xrInputSource.gamepad.axes[3] < -0.1) {
                this.VRuser.user.position.add(this.fwdDirection.multiplyScalar(-this.controlInput.motionController.xrInputSource.gamepad.axes[3] * clockDelta));
            }
            if (this.controlInput.motionController.xrInputSource.gamepad.axes[2] > 0.1 || this.controlInput.motionController.xrInputSource.gamepad.axes[2] < -0.1) {
                this.VRuser.user.rotation.y -= this.controlInput.motionController.xrInputSource.gamepad.axes[2] * clockDelta * 0.3;
            }

            //buttons[1] - side trigger
            //buttons[3] - joystick trigger
            //buttons[4] - lower button
            //buttons[5] - top button

            this.handleJoyPress();
            this.handleJoyAxes();
            this.handleTopBtn();
            this.handleBotBtn();
            this.handleSideBtn();


            if (this.controlInput.motionController.xrInputSource.gamepad.buttons[5].pressed === true) {
                this.timer[5] += clockDelta;
                if (this.VRuser.vrKeyboard !== null) {
                    if (this.clicked[5] === false && this.timer[5] > this.clickTime) {
                        this.clicked[5] = true;
                    }
                }
            } else {
                if (this.clicked[5] === true) {
                    const pos = this.VRuser.user.position.clone().add(this.fwdDirection.multiplyScalar(1.5));
                    this.VRuser.vrKeyboard.setData({ position: pos });
                    this.VRuser.vrKeyboard.model.lookAt(this.camera.position);
                }
                this.timer[5] = 0;
                this.clicked[5] = false;
                this.raycastLine.visible = false;
            }
            //console.log(this.controlInput.motionController.xrInputSource.gamepad.buttons[2]);
            //console.log(this.controlInput.motionController.xrInputSource.gamepad.buttons[6]);

            if (this.controlInput.motionController.xrInputSource.gamepad.buttons[0].pressed === true) {
                this.timer[0] += clockDelta;

                // GET ALL INTERSECTION
                let intersections = this.checkIntersections();

                // SET COLORS: MISS OR HIT
                if (intersections.length > 0) {
                    this.raycastLine.scale.z = intersections[0].distance;
                    this.lineMaterial.color = this.hitColor;
                } else {
                    this.raycastLine.scale.z = 5;
                    this.lineMaterial.color = this.missColor;
                }

                if (this.clicked[0] === false && this.timer[0] > this.clickTime) {
                    this.clicked[0] = true;
                }
                this.raycastLine.visible = true;
            } else {
                if (this.clicked[0] === true) {
                    this.controlClick();
                }
                this.timer[0] = 0;
                this.clicked[0] = false;
                this.raycastLine.visible = false;
            }
        }
        //this.VRuser.position.add(camRotation);

    }

    // hoverRay(clockDelta) {

    // }



    controlClick() {

        this.handleRaycastHit(this.checkIntersections(this.scene.children));

    }

    // HAND INPUT
    setHandRaycastLayers() {
        if (this.pointer.raycaster.layers.mask === 1) {
            this.pointer.raycaster.layers.disableAll();
            this.pointer.raycaster.layers.enable(30); //only objects in layer 30
        }
    }
    moveWithHandInput(clockDelta) {
        this.raycastLine.visible = false;
        // pending, set raycast layers for pc and for vr
        this.pointer.checkIntersections(this.scene.children);
        if (this.pointer.isPinched()) {
            this.timer[0] += clockDelta;
            this.pinch();
            if (this.clicked[0] === false && this.timer[0] > this.handClickTime) {
                this.handClick();
                this.clicked[0] = true;
            }
        } else {
            this.timer[0] = 0;
            this.clicked[0] = false;
        }
    }
    handClick() {
        if (this.enabledHandMove) {
            //maybe vr raycast interact in layers diifferent in pc than in vr
            this.handleRaycastHit(this.pointer.intersectObjects(this.scene.children))
        }
    }
    pinch() {

    }



    checkIntersections(objects) {
        this.tempMatrix.identity().extractRotation(this.controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(this.controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
        return this.raycaster.intersectObjects(this.scene.children, true);
    }
    handleRaycastHit(hits) {
        if (hits !== undefined) {
            if (hits.length !== undefined) {
                if (hits.length > 0) {
                    const firstHit = hits[0].object.userData.gameObject;
                    if (firstHit !== undefined) {
                        if (firstHit.userData.teleport !== undefined) {
                            this.VRuser.moveToPosition(hits[0].point);
                        }
                        if (firstHit.userData.components !== undefined) {
                            firstHit.userData.components.forEach((c) => {
                                c.onRaycastHit({ vruser: this.VRuser, hits: hits });
                            });
                        }
                    }
                }
            }
        }
    }
}
export { VRuser }