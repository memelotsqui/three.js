import * as THREE from 'three';
import { OrbitControls } from '../../controls/OrbitControlsClickMove.js';
import '../../libs/hammer.min.js';
class PCuser {
    constructor(builder, rules) {
        const scope = this;

        this.rules = rules;
        this.controls = null;

        let mouse, touchHammer;

        this.raycaster = null;
        this.lastHoverObject = null; //current raycast active smart object

        SetupRaycaster();

        function SetupRaycaster() {
            let raycaster = new THREE.Raycaster();
            raycaster.layers.disableAll();
            raycaster.layers.enable(30); //only objects in layer 30
            scope.raycaster = raycaster;
        }

        setupOrbitControls();
        touchHammer = new Hammer(builder.container);
        touchHammer.on('tap', hammerTap);
        mouse = new THREE.Vector2();



        function hammerTap(e) {
            mouse = e.center;
            normalizeMouse(mouse);
            if (e.tapCount == 2) {
                //console.log("tap2");
                multiClickRay();
            }
            if (e.tapCount == 1) {
                //console.log("tap1");
                simpleClickRay();
            }
        }

        document.onmousemove = handleMouseMove;

        function handleMouseMove(event) {
            var eventDoc, doc, body;
            event = event || window.event; // IE-ism
            if (event.pageX == null && event.clientX != null) {
                eventDoc = (event.target && event.target.ownerDocument) || document;
                doc = eventDoc.documentElement;
                body = eventDoc.body;

                event.pageX = event.clientX +
                    (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
                    (doc && doc.clientLeft || body && body.clientLeft || 0);
                event.pageY = event.clientY +
                    (doc && doc.scrollTop || body && body.scrollTop || 0) -
                    (doc && doc.clientTop || body && body.clientTop || 0);
            }
            mouse.x = event.pageX;
            mouse.y = event.pageY;
            normalizeMouse(mouse);
            hoverRay();
            // Use event.pageX / event.pageY here
        }

        function normalizeMouse() {
            mouse.x = ((mouse.x - builder.renderer.rect.left) / builder.renderer.rect.width) * 2 - 1;
            mouse.y = -((mouse.y - builder.renderer.rect.top) / builder.renderer.rect.height) * 2 + 1;
            return mouse;
        }

        function simpleClickRay() {
            // cast a single ray
            const rayHits = castRay(builder.scene.children);
            if (rayHits.length > 0) {
                onRaycastHit(rayHits[0].object.userData.gameObject, rayHits);
            }
        }



        function hoverRay() {
            const rayHits = castRay(builder.scene.children);
            if (rayHits.length > 0) {
                onRaycastHover(rayHits[0].object.userData.gameObject, rayHits);
            } else {
                if (scope.lastHoverObject !== null) {
                    if (scope.lastHoverObject.userData.components !== undefined) {
                        scope.lastHoverObject.userData.components.forEach((c) => {
                            c.onHoverExit();
                        });
                    }
                    scope.lastHoverObject = null;
                }
            }
        }

        function castRay(_interactable) {
            scope.raycaster.setFromCamera(mouse, builder.camera);
            return scope.raycaster.intersectObjects(_interactable, true);
        }

        function onRaycastHit(object, intersectObjects) {
            if (object !== undefined) {
                if (object.userData.components !== undefined) {
                    object.userData.components.forEach((c) => {
                        c.onRaycastHit({ intersectObjects: intersectObjects });
                    });
                }
            }
        }

        function onRaycastHover(object, intersectObjects) { //ON HOVER ENTER / ON HOVER EXIT
            let newObject = false;

            if (object !== undefined) {
                if (object !== scope.lastHoverObject) {
                    newObject = true;
                    if (object.userData.components !== undefined) {
                        object.userData.components.forEach((c) => {
                            c.onHoverEnter({ intersectObjects: intersectObjects });
                        });
                    }
                }
            }
            if (newObject) { //call on hover exit on all components of the object if it has any component
                if (scope.lastHoverObject != null) {
                    if (scope.lastHoverObject.userData.components !== undefined) {
                        scope.lastHoverObject.userData.components.forEach((c) => {
                            c.onHoverExit({ intersectObjects: intersectObjects });
                        });
                    }
                }
                scope.lastHoverObject = object;
            }
        }

        function multiClickRay() {
            //console.log("click 2");
        }

        this.onControlsChange = function(onfps) {
            //console.log(onfps);
        }

        function setupOrbitControls() {
            let controls = new OrbitControls(builder.camera, builder.renderer.domElement, scope.onControlsChange);
            controls.target.set(0, 0, 0);
            controls.minDistance = .1;
            controls.maxDistance = 40;
            controls.inverseRotate = false;
            controls.enableDamping = true;
            controls.smoothZoom = true;
            controls.zoomDampingFactor = 0.05;
            controls.dampingFactor = 0.1;
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = 1.5708;

            scope.controls = controls;
            controls.update();
        }
    }
    tick(clockDelta) {

        if (this.controls !== null) {
            this.controls.update();
        }
    }
    setPositionWitObject(obj) {
        let v3 = new THREE.Vector3();
        obj.getWorldPosition(v3)
        this.moveToPosition(v3);
    }
    moveToPosition(position) {
        this.controls.target.set(position.x, position.y, position.z);
    }

}
export { PCuser }