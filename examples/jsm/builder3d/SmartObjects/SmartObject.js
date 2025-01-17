import { Vector3, Quaternion, BoxGeometry, MeshBasicMaterial, Mesh } from 'three';

class SmartObject {
    constructor(gltf, customData, builder, onLoad) {

        const scope = this;


        if (!customData) customData = {};

        this.CONTROLLER;

        this.builder = builder;
        this.gltf = gltf;
        this.rules = builder.rules;
        this.mainScene = builder.scene;
        this.debug = builder.debug;
        this.hiddenScene = builder.hiddenScene; // used to remove objects from scene temporarily
        this.components = []; // all registered components
        this.model = gltf.scene;

        this.loadGLTFColliders(builder.rules.physicsEngine);

        this.setupVars(gltf, customData, builder, onLoad);

        this.animationControllers = gltf.animationControllers == null ? [] : gltf.animationControllers;
        this.testing(gltf, customData, builder, onLoad);

        onLoad(this);
        this.onLoad();


        // ALL OF THIS IS PART OF THE SETUP!!, LET THE USER ALSO DECIDE IF THEY WANT TO INITIALIZE IT ON LOADED.
        this.isActive = false;
        setSmartBaseData();


        const collisions = customData.collisions || true;
        if (collisions === true) {
            // try not using traverse, instead use gltf.nodes.foreach. reason: When turning off objects, to avoid raycast colision, objects are being removed from main scene into a "hidden scene", since their parent gets removed, they wont be affected by traverse
            this.gltf.nodes.forEach(o => {
                o.layers.enable(30); //30 used for raycast, objects that need to be ignored by raycast will be removed from this layer
            });
        }
        this.beforeExtras(gltf, customData, builder, onLoad);
        this.extras = builder.rules.extrasLoader.loadData(this, customData);
        this.afterExtras(gltf, customData, builder, onLoad);
        if (gltf.cameras !== undefined) { //user must defines if remove or not
            for (let i = 0; i < gltf.cameras.length; i++) {
                builder.scene.remove(gltf.cameras[i]);
            }
        }
        // SET VISIBILITY

        this.gltf.nodes.forEach(o => {
            if (o.userData.visible !== undefined) {
                if (o.userData.visible === false) {
                    scope.toggleObject(o, false); //used instead of .visible to avoid interaction with the object (raycasts)
                }
            }
        });
        if (builder._userInteracted === true) this._onUserFirstInteract();

        if (customData.moveToStartPosition !== undefined) moveUserToPosition();

        this.setData(customData);
        this.addToScene(builder.scene)


        this.onFinishSetup();

        function moveUserToPosition() {
            if (gltf.userData.smartObject !== undefined) {
                if (gltf.userData.smartObject.startPosition !== undefined) {
                    let obj = null;

                    if (gltf.userData.smartObject.startPosition.length === undefined) {
                        obj = scope.getObjectByID(gltf.userData.smartObject.startPosition);
                    } else {
                        let startPos = customData.moveToStartPosition;
                        if (startPos === true)
                            startPos = 0;
                        obj = scope.getObjectByID(gltf.userData.smartObject.startPosition[startPos]);
                    }

                    if (obj != null) {
                        builder.rules.setPositionWitObject(obj);
                    }
                }
            }
        }

        function setSmartBaseData() {
            if (gltf.userData.smartObject !== undefined) {
                if (gltf.userData.smartObject.smartType !== undefined) {
                    if (gltf.userData.smartObject.smartType === "space") {
                        customData.affectSceneEnvironment = customData.affectSceneEnvironment === undefined ? true : customData.affectSceneEnvironment;
                        customData.addMeshBackground = customData.addMeshBackground === undefined ? true : customData.addMeshBackground;
                    }
                    if (gltf.userData.smartObject.smartType === "object") {}
                    if (gltf.userData.smartObject.smartType === "character") {}
                }
            }
        }

    }
    moveUserToObject(object) {
        this.builder.rules.setPositionWitObject(object);
    }

    loadGLTFColliders(engine) {
        if (this.gltf.nodes != null && engine != null) {
            this.gltf.nodes.forEach(o => {
                if (o.userData.gltfExtensions != null) {
                    if (o.userData.gltfExtensions.OMI_collider != null) {
                        //console.log(o);
                        this.addComponent(new Collider(o, o.userData.gltfExtensions.OMI_collider, engine, this.debug, this.mainScene))
                    }
                }
            });
        }
    }

    testing() {
        if (this.gltf.animationControllers != null) {
            //console.log(this.gltf.animationControllers);
        }

    }

    testingSetWeight(action, weight) {

        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);

    }
    receiveData(data) { /*override*/ }

    _onUserFirstInteract() {
        // play audio
        this.gltf.scene.traverse((o) => {
            if (o.constructor.name === "PositionalAudio" || o.constructor.name === "Audio") {
                if (o.autoplay === true) {
                    o.play();
                }
            }
        });
    }

    addToScene(scene) {
        scene.add(this.model);
        this.isActive = true;
    }
    onLoad() { /*override*/ }
    onFinishSetup() { /*override*/ }
    setupVars(gltf, customData, builder, onLoad) { /*override*/ } // called  after setting smartObjects initial vars
    beforeExtras() { /*override*/ }
    afterExtras() { /*override*/ }

    getObjectByID(id) {
        return this.gltf.nodes[id];
    }
    getObjectsByIDs(ids) {
        let nodes = [];
        for (let i = 0; i < ids.length; i++) {
            nodes.push(this.gltf.nodes[ids[i]]);
        }
        return nodes;
    }


    setData(customData) {
        if (customData.parent != null) customData.parent.add(this.model);
        this.model.userData.currentParent = this.model.parent;
        if (customData.position !== undefined) this.model.position.set(customData.position.x, customData.position.y, customData.position.z);
        if (customData.quaternion !== undefined) this.model.setRotationFromQuaternion(customData.quaternion);
        if (customData.scale !== undefined) this.model.scale.set(customData.scale.x, customData.scale.y, customData.scale.z);
        if (customData.visible !== undefined) this.model.visible = customData.visible; //turning off visibility, dont stop raycast from hitting objects, use setActive instead
        if (customData.setActive !== undefined) this.setActive(customData.setActive);
        this.setSmartObjectData(customData);
    }
    getCurrentData() {
        const DATA = {};

        DATA.parent = this.model.parent;
        DATA.position = this.model.position;
        DATA.scale = this.model.scale;
        DATA.visible = this.model.visible;
        DATA.setActive = this.isActive;

        return DATA;
    }


    toggleObject(target, active) {
        if (target != null) {
            if (active === true) {
                if (target.userData.currentParent != null) {
                    target.userData.currentParent.add(target);
                    // call on enable
                } else {
                    //no parent found, add it to the main scene
                    this.mainScene.add(target);
                }
            } else if (active === false) {
                const parent = target.parent == null ? this.mainScene : target.parent;
                target.userData.currentParent = parent;
                this.hiddenScene.add(target);
                // cal on disable
            } else {
                if (target.parent === this.hiddenScene) {
                    this.toggleObject(true, target);
                } else {
                    this.toggleObject(false, target);
                }
            }
        }

    }

    setActive(active) {
        if (active === true) {
            if (this.isActive === false) {
                this.isActive = true;
                this.toggleObject(this.model, true);
                this.onSmartEnable();
                //this.model.userData.currentParent.add(this.model);
            }
        } else if (active === false) {
            if (this.isActive === true) {
                this.isActive = false;
                this.toggleObject(this.model, false);
                this.onSmartDisable();
                //this.model.userData.currentParent = this.model.parent;
                //this.hiddenScene.add(this.model);
            }
        } else {
            if (this.isActive) {
                this.setActive(false);
            } else {
                this.setActive(true);
            }
        }
    }

    onScreenResize(container) {
        if (this.gltf.cameras !== undefined) {
            for (let i = 0; i < this.gltf.cameras.length; i++) {
                this.gltf.cameras[i].aspect = container.clientWidth / container.clientHeight;
                this.gltf.cameras[i].updateProjectionMatrix();
                console.log(this.extras);
                this.builder.rules.extrasLoader.callWindowResize(this.extras);
            }
        }
    }
    tick(clockDelta) {
        if (this.isActive) {
            //this.animMixer
            this.components.forEach(function(comp) {
                comp.tick(clockDelta);
            });
            this.animationControllers.forEach(function(anim) {
                anim.update(clockDelta);
            });
            this.smartTick(clockDelta);
            //this.testMixer.update(clockDelta);
        }
    }

    setSmartObjectData(customData) { /*override*/ }
    smartTick(clockDelta) { /*override*/ }
    onSmartEnable() { /*override*/ }
    onSmartDisable() { /*override*/ }
        //onUserSwitch(newUser) { /*override*/ }

    addComponent(component) {
        if (component !== undefined) //check component type?
            this.components.push(component);
    }
    getComponent(componentType, object) {
        let result = null;
        object.userData.components.some((comp) => {
            if (comp instanceof componentType) {
                console.log("found!");
                result = comp;
            }
        });
        return result;
    }
    getComponents(componentType, object) {
        let result = [];
        object.userData.components.forEach(function(comp) {
            if (comp instanceof componentType) {
                result.push(comp);
            }
        });
        return result;
    }


    moveToUserPosition() {
        const pos = this.rules.getUserPosition();
        this.model.position.set(pos.x, pos.y, pos.z);
    }
    setSkybox(cubeTexture, changeTime, customData) {
        this.rules.setSkybox(cubeTexture, changeTime, customData);
    }
    setFog(color, demsity, time, customData) {
        this.rules.setFog(color, demsity, time, customData);
    }

    dispose() {

        this.extras.dispose();
        this.extras = null;
        //delete this.extras;
        //console.log(this.extras);
        this.gltf.textures.forEach(t => {
            t.dispose();
        });
        this.gltf.textures = null;
        this.gltf.cubeTextures.forEach(t => {
            t.dispose();
        });
        this.gltf.cubeTextures = null;

        this.model.traverse((o) => {
            if (o.constructor.name === "PositionalAudio" || o.constructor.name === "Audio") {
                if (o.source != null)
                    o.stop();
                o.source = null;
                o = null;
                //console.log(o.context);
                //o.context.close();
            }
        });
        this.model.traverse((o) => {
            if (o.geometry !== undefined) {
                o.geometry.dispose();
                delete o.geometry;


                if (o.material.length !== undefined) {
                    o.material.forEach(m => {
                        m.dispose();
                    });
                } else {
                    o.material.dispose();
                }

            }
            this.mainScene.remove(o);
        });

        this.mainScene.remove(this.gltf.scene);
        // this.model = null;
        this.gltf = null;
        // this.components = null;
        //this = null;
    }

    static CreateSmartObject(gltf, customData, builder, onLoad) {

        if (gltf.userData.smartObject !== undefined) {
            (async() => {

                if (gltf.userData.smartObject.bufferView !== undefined) {
                    gltf.parser.loadBufferView(gltf.userData.smartObject.bufferView).then(function(bufferView) {

                        const blob = new Blob([bufferView], { type: gltf.userData.smartObject.mimeType });

                        let sourceURI = URL.createObjectURL(blob);
                        import (sourceURI).then(async(module) => {
                                const Smart = module.default;
                                return new Smart(gltf, customData, builder, onLoad);
                            })
                            .catch(err => {
                                console.error(err);
                                console.log("Class not loaded, Using SmartObject instead");
                                return new SmartObject(gltf, customData, builder, onLoad);
                            });
                    });
                } else {
                    let stloc = "";
                    if (gltf.userData.smartObject.uri !== undefined) {
                        stloc = gltf.parser.options.path + gltf.userData.smartObject.uri;
                        if (!stloc.startsWith("http")) {
                            const tempUrl = new URL(stloc, window.location.protocol + window.location.hostname + window.location.pathname);
                            stloc = tempUrl.href;
                        }
                    } else {
                        stloc = gltf.userData.smartObject.class !== undefined ? './' + gltf.userData.smartObject.class + ".js" : "";
                    }
                    if (stloc === "") {
                        console.log("No uri,bufferView, or class name provided. Loading Basic Smart Model");
                        return new SmartObject(gltf, customData, builder, onLoad);
                    }
                    const { default: Smart } = await
                    import (
                        stloc
                    )
                    .catch(err => {
                        console.error(err);
                        console.warn("Problems loading" + stloc + ", Using Basic SmartObject instead");
                        return new SmartObject(gltf, customData, builder, onLoad);
                    });
                    if (Smart !== undefined) {
                        return new Smart(gltf, customData, builder, onLoad);
                    }
                }
            })();
        } else {
            return new SmartObject(gltf, customData, builder, onLoad);
        }
    }
}



class ObjectComponent {
    constructor(object) {
        if (object.userData.components === undefined)
            object.userData.components = [];
        object.userData.components.push(this);
        this.object = object;
    }
    tick(clockDelta) {

    }
    onRaycastHit(customData) { // called when the main raycast hits any object in front
        //userData:
        //vruser, pcuser
        //hits
        //left hand, right hand
    }
    onClick(intersectObjects) {
        console.log(intersectObjects);
    }
    onSecondaryClick(intersectObjects) {
        console.log("secondary " + intersectObjects);
    }

    // onRaycastHitDoubleClick(customData) {

    // }
    onHoverIn(intersectObjects) {

    }
    onHoverOut(intersectObjects) {

    }
    onHoverEnter(customData) {

    }
    onHoverExit(customData) {

    }
}

class Collider extends ObjectComponent {
    constructor(object, data, engine, debug = false, debugScene = null) {
        super(object);

        this.rigidBody = engine.createRigidBody(object, data.rigidBody);
        this.collider = engine.createCollider(object, this.rigidBody, data);

        const center = data.center == null ? new Vector3(0, 0, 0) : new Vector3(data.center[0], data.center[1], data.center[2])
            .multiply(object.scale);

        this._offsetScale = new Vector3(1, 1, 1);
        this._offsetPos = new Vector3(0, 0, 0);
        this._offsetRot = new Vector3(0, 0, 0);

        this._debugScene = debugScene;
        this._debugObject = debug ? this._createDebugCollider(data, object) : null;

        this._offsetDirection = new Vector3().subVectors(new Vector3(0, 0, 0), center).normalize();
        this._offsetDistance = new Vector3().distanceTo(center);

        this._updateOffset();
        this._updatePosition();

    }
    _updateOffset() {
        const globalPos = new Vector3();
        const globalScale = new Vector3();

        this.object.parent.getWorldPosition(globalPos); // Get it from parent, thats the actual data we want to offset
        this.object.parent.getWorldScale(globalScale);

        this._offsetScale = new Vector3(1 / globalScale.x, 1 / globalScale.y, 1 / globalScale.z);
        this._offsetPos =
            globalPos.multiply(this._offsetScale)
            //.add(this._colliderCenter);
    }
    _updatePosition() {
        if (this.collider != null) {
            const pos = this.collider.translation();
            const rot = this.collider.rotation();

            this.object.position.set(
                (pos.x * this._offsetScale.x) - this._offsetPos.x,
                (pos.y * this._offsetScale.y) - this._offsetPos.y,
                (pos.z * this._offsetScale.z) - this._offsetPos.z);
            this.object.quaternion.set(rot.x, rot.y, rot.z, rot.w);

            //not sure if it hits impact
            this.object.translateOnAxis(this._offsetDirection, this._offsetDistance);

            if (this._debugObject != null) {

                this._debugObject.position.set(pos.x, pos.y, pos.z);
                this._debugObject.quaternion.set(rot.x, rot.y, rot.z, rot.w);

            }
        }

    }
    tick(clockDelta) { //clock delta not to be used with position
        if (this.rigidBody != null) {
            if (!this.rigidBody.isSleeping())
                this._updatePosition();
        }
    }
    onRaycastHit(customData) {
        if (this.rigidBody != null) {
            const hitPoint = customData.intersectObjects[0].point;
            this.rigidBody.applyImpulseAtPoint(new Vector3(-1, 1, 0), hitPoint, true);
        }
    }

    _createDebugCollider(data, object) {
        if (data.type === "box") {
            const worldPos = new Vector3(0, 0, 0);
            const worldScale = new Vector3(1, 1, 1);

            object.getWorldPosition(worldPos);
            object.getWorldScale(worldScale);

            const center = new Vector3(data.center[0], data.center[1], data.center[2]);
            center.multiply(worldScale)
            worldPos.add(center)

            const finalSize = new Vector3(worldScale.x * data.extents[0], worldScale.x * data.extents[1], worldScale.x * data.extents[2]);

            return this._debugBox(finalSize, worldPos);
        }
        return null;
    }

    _debugBox(size, position) {
        const geometry = new BoxGeometry(size.x, size.y, size.z);
        const material = new MeshBasicMaterial({ color: 0xffde00, opacity: 0.5, transparent: true });
        const cube = new Mesh(geometry, material);
        this._debugScene.add(cube);
        cube.position.set(position.x, position.y, position.z);
        return cube;
    }

}

export { SmartObject, ObjectComponent }