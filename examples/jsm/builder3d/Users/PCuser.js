import * as THREE from 'three';
import { OrbitControls } from '../../controls/OrbitControlsClickMove.js';
import { FirstPersonController } from './FirstPersonController.js'; //use dynamic load?
//import '../../libs/hammer.min.js';
class PCuser {
    constructor(builder, controller, rules) {
        const scope = this;

        this.rules = rules;
        this.controls = null;

        //let mouse, touchHammer;

        this.raycaster = new THREE.Raycaster();
        this.raycaster.layers.set(30);
        this.lastHoverObject = null; //current raycast active smart object
        this._mousePosition = { x: 0, y: 0 }

        console.log(controller);


        setupFirstPersonControls();
        //setupOrbitControls();


        controller.addEventListener('onFireClick', (e) => { simpleClickRay(true) });
        controller.addEventListener('onGrabClick', (e) => { simpleClickRay(false) });
        builder.container.addEventListener('mousemove', (e) => { onMouseMove(e) });
        builder.container.addEventListener('contextmenu', (e) => e.preventDefault());

        function onMouseMove(e) {
            scope._mousePosition = normalizeVector2({
                x: e.clientX,
                y: e.clientY
            })
            hoverRay();
        }


        function normalizeVector2(v2) {
            return {
                x: ((v2.x - builder.renderer.rect.left) / builder.renderer.rect.width) * 2 - 1,
                y: -((v2.y - builder.renderer.rect.top) / builder.renderer.rect.height) * 2 + 1
            }
        }










        function simpleClickRay(main) {
            // cast a single ray
            const rayHits = castRay(builder.scene.children);
            if (rayHits.length > 0) {
                onRaycastHit(rayHits[0].object.userData.gameObject, rayHits, main);
            }
        }

        function castRay(_interactable) {
            scope.raycaster.setFromCamera(scope._mousePosition, builder.camera);
            return scope.raycaster.intersectObjects(_interactable, true);
        }

        function onRaycastHit(object, intersectObjects, main) {
            if (object !== undefined) {
                if (object.userData.components !== undefined) {
                    object.userData.components.forEach((c) => {
                        if (main === true) {
                            c.onRaycastHit({ intersectObjects: intersectObjects });
                            c.onClick(intersectObjects);
                        } else {
                            c.onSecondaryClick(intersectObjects);
                        }
                    });
                }
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
                            c.onHoverExit([]);
                        });
                    }
                    scope.lastHoverObject = null;
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
                            c.onHoverIn(intersectObjects);
                        });
                    }
                }
            }
            if (newObject) { //call on hover exit on all components of the object if it has any component
                if (scope.lastHoverObject != null) {
                    if (scope.lastHoverObject.userData.components !== undefined) {
                        scope.lastHoverObject.userData.components.forEach((c) => {
                            c.onHoverExit({ intersectObjects: intersectObjects });
                            c.onHoverOut(intersectObjects);
                        });
                    }
                }
                scope.lastHoverObject = object;
            }
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
            //controls.update();
        }

        function setupFirstPersonControls() {
            let controls = new FirstPersonController(builder.camera, builder.container, builder.scene, 1.65);
            scope.controls = controls;
        }
    }
    tick(clockDelta) {
        if (this.controls !== null) {
            this.controls.update(clockDelta);
        }
    }
    setPositionWitObject(obj) {
        let v3 = new THREE.Vector3();
        obj.getWorldPosition(v3)
        this.moveToPosition(v3);
    }
    moveToPosition(position) {
        if (this.controls !== null) {
            if (this.controls.target != null)
                this.controls.target.set(position.x, position.y, position.z);
            if (this.controls.setPosition != null)
                this.controls.setPosition(position);
        }
    }
    getPosition() {
        if (this.controls !== null)
            if (this.controls.getPosition != null)
                return this.controls.getPosition();
        return new THREE.Vector3(0, 0, 0)
    }
    setLimits(xmin, xmax, ymin, ymax, zmin, zmax) {
        if (this.controls != null) {
            if (this.controls.setLimits != null)
                this.controls.setLimits(xmin, xmax, ymin, ymax, zmin, zmax);
        }
    }

}
export { PCuser }