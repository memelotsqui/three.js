import { SmartObject, ObjectComponent } from './SmartObject.js'

class Threevox extends SmartObject {
    constructor(gltf, customData, builder, onLoad) { // must be called when loaded
        super(gltf, customData, builder, onLoad);
    }
    beforeExtras() {
        this.gltf.scene.traverse((o) => {
            if (o.userData.doorObject !== undefined) {
                o.userData.batching = false;
                o.traverse((ob) => {
                    ob.userData.batching = false;
                });
                this.addComponent(new DoorObject(o, this.gltf.nodes[o.userData.doorObject.pivot], -o.userData.doorObject.yRotateTo, 1))
                    //this.builder.rules.vrRaycastInteract.push(o);
            }
            if (o.userData.roofInvisibleTPS !== undefined) {
                o.traverse((ob) => {
                    ob.userData.batching = false;
                    //ob.layers.set(2); //ignore raycasts
                });
                //o.visible = false;
            }
            if (o.userData.teleportVRTo !== undefined) {
                //this.addComponent(new TeleportVRTo(o, this.gltf.nodes[o.userData.teleportVRTo.objectPosition]))
            }

            if (o.userData.lookAtCam !== undefined) {
                this.toggleObject(o, false);
                // o.parent = null;
                // o.traverse((ob) => {
                //     ob.userData.batching = false;
                //     ob.layers.set(2); //ignore raycasts
                // });
            }
            if (o.userData.moveTo !== undefined) {
                this.toggleObject(o, false);
                // o.parent = null;
                // o.traverse((ob) => {
                //     ob.userData.batching = false;
                //     ob.layers.set(2); //ignore raycasts
                // });
            }
        });
    }
    afterExtras() {
        this.gltf.scene.traverse((o) => {
            if (o.userData.roofInvisibleTPS !== undefined) {
                //o.userData.gameObject.visible = false;
            }
        });
    }

}


class TeleportVRTo extends ObjectComponent {
    constructor(object, objectPosition) {
        super(object)

        this.objectPosition = objectPosition;
    }
    onRaycastHit(userData) { // called when the main raycast hits any object in front
        if (userData.vruser !== undefined) {
            userData.vruser.moveToPosition(this.objectPosition.position);
        }
    }
}
class DoorObject extends ObjectComponent {
    constructor(object, pivot, yRotateTo, speed) {
        super(object);

        this.pivot = pivot;
        this.yRotateTo = yRotateTo;
        this.speed = speed;

        this.target = 0;
        this.isMoving = false;
        this.isOpen = true;

        this.rotateCounter = 0;

    }
    tick(clockDelta) {
        if (this.isMoving) {
            if (this.isOpen) {
                if (this.rotateCounter > 0) {
                    this.rotateCounter -= clockDelta / this.speed;
                    if (this.rotateCounter > 0) {
                        this.pivot.rotation.y = this.rotateCounter * this.yRotateTo;
                    } else {
                        this.pivot.rotation.y = 0;
                        this.isMoving = false;
                    }
                }
            } else {
                if (this.rotateCounter < 1) {
                    this.rotateCounter += clockDelta / this.speed;
                    if (this.rotateCounter < 1) {
                        this.pivot.rotation.y = this.rotateCounter * this.yRotateTo;
                    } else {
                        this.pivot.rotation.y = this.yRotateTo;
                        this.isMoving = false;
                    }
                }
            }
        }
    }

    onRaycastHit() {
        this.openDoor();
    }
    openDoor() {
        this.isOpen = !this.isOpen;
        this.isMoving = true;
    }
}


export { Threevox as default };