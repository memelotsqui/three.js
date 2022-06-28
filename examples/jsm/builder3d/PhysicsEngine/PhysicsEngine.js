import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { Vector3, Quaternion } from 'three';

class PhysicsEngine {
    constructor(engine, callback) {
        const scope = this;
        this.enabled = true;
        this.world = null;
        this.gravity = { x: 0.0, y: -9.81, z: 0.0 };

        this.testObject = null;

        RAPIER.init().then(() => {
            scope.world = new RAPIER.World(scope.gravity);

            if (callback != null)
                callback();
        });


    }

    //https://rapier.rs/docs/user_guides/javascript/rigid_bodies
    //dynamic - moves
    //fixed = not moves
    //KinematicPositionBased = not affected by the physics engine
    //KinematicVelocityBased
    createRigidBody(object, data) {
        if (data == null) return null;

        let rigidBodyDesc = null;

        const isKinematic = data.isKinematic || false;
        if (isKinematic) rigidBodyDesc = RAPIER.RigidBodyDesc(RAPIER.RigidBodyDesc.kinematicVelocityBased());
        else rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();

        const gravity = data.gravity || 1;
        if (gravity != 1) rigidBodyDesc.setGravityScale(gravity);

        const damp = data.damp || 0;
        if (damp != 0) rigidBodyDesc.setLinearDamping(damp);

        const angularDamp = data.angularDamp || 0;
        if (angularDamp != 0) rigidBodyDesc.setAngularDamping(angularDamp);

        // LOCK POSITION
        const positionLock = data.positionLock || { x: false, y: false, z: false }
        if (positionLock.x === true || positionLock.y === true || positionLock.z === true) {
            if (positionLock.x === true && positionLock.y === true && positionLock.z === true) {
                rigidBodyDesc.lockTranslations();
            } else {
                // for some reason lock being true means its unlocked actually, so from the gltf file, invert the values
                rigidBodyDesc.restrictTranslations(!positionLock.x || true, !positionLock.y || true, !positionLock.z || true);
            }
        }

        // LOCK ROTATION
        const rotationLock = data.rotationLock || { x: false, y: false, z: false }
        if (rotationLock.x === true || rotationLock.y === true || rotationLock.z === true) {
            if (rotationLock.x === true && rotationLock.y === true && rotationLock.z === true) {
                rigidBodyDesc.lockRotations();
            } else {
                // for some reason lock being true means its unlocked actually, so from the gltf file, invert the values
                rigidBodyDesc.restrictRotations(!rotationLock.x || true, !rotationLock.y || true, !rotationLock.z || true);
            }
        }

        const continousCollisionDetection = data.ccd || false;
        if (continousCollisionDetection === true) rigidBodyDesc.setCcdEnabled(true);

        return this.world.createRigidBody(rigidBodyDesc);
    }

    createCollider(object, rigidBody, data) {
        if (data == null) return null;

        let center = new Vector3(0, 0, 0);

        if (data.center != null)
            center = new Vector3(data.center[0], data.center[1], data.center[2]);

        // get global transforms
        let pos = new Vector3();
        let rot = new Quaternion();
        let sca = new Vector3();

        object.getWorldPosition(pos);
        object.getWorldQuaternion(rot);
        if (object.name == "floor")
            console.log(rot);
        object.getWorldScale(sca);


        center.multiply(sca)
        pos.add(center);

        let collider = null;

        data.pos = pos;
        data.sca = sca;
        data.rot = rot;

        switch (data.type) {
            case "sphere":
                collider = this.createSphereCollider(rigidBody, data)
                break;
            case "box":
                collider = this.createBoxCollider(rigidBody, data);
                break;
            case "capsule":
                collider = this.createCapsuleCollider(rigidBody, data);
                break;
                //missing mesh

        }

        return collider;
    }

    createSphereCollider(rigidBody, data) {

        let scale = data.sca.x;
        if (data.sca.y > data.sca.x) scale = data.sca.y;
        if (data.sca.z > data.sca.y) scale = data.sca.z;

        let colliderDesc = RAPIER.ColliderDesc.ball(data.radius * scale)
            .setTranslation(data.pos.x, data.pos.y, data.pos.z)
            .setRotation({ x: data.rot.x, y: data.rot.y, z: data.rot.z, w: data.rot.w });

        return this._finishColliderCreation(colliderDesc, rigidBody, data);
    }
    createBoxCollider(rigidBody, data) {

        // multiply it by object scale to have the final collider scale
        //console.log(data.rot);
        let colliderDesc = RAPIER.ColliderDesc.cuboid(data.sca.x * data.extents[0] / 2, data.sca.y * data.extents[1] / 2, data.sca.z * data.extents[2] / 2)
            .setTranslation(data.pos.x, data.pos.y, data.pos.z)
            .setRotation({ x: data.rot.x, y: data.rot.y, z: data.rot.z, w: data.rot.w });

        //console.log(colliderDesc);

        return this._finishColliderCreation(colliderDesc, rigidBody, data);
    }
    createCapsuleCollider(rigidBody, data) {

        // check to set scale here too
        let colliderDesc = RAPIER.ColliderDesc.capsule(data.radius, data.height / 2)
            .setTranslation(data.pos.x, data.pos.y, data.pos.z)
            .setRotation({ x: data.rot.x, y: data.rot.y, z: data.rot.z, w: data.rot.w });

        return this._finishColliderCreation(colliderDesc, rigidBody, data);

    }
    _finishColliderCreation(colliderDesc, rigidBody, data) {

        // SET MATERIAL DATA FROM COLLIDER IF IT HAS
        colliderDesc = this._setPhysicsMaterial(colliderDesc, data.material);

        const sensor = data.sensor || false;
        if (sensor === true) colliderDesc.setSensor(true);

        if (data.rigidBody != null) {
            const density = data.rigidBody.density || 1;
            if (density != 1) colliderDesc.setDensity(density);
        }


        if (rigidBody == null)
            return this.world.createCollider(colliderDesc);
        else
            return this.world.createCollider(colliderDesc, rigidBody);
    }

    _setPhysicsMaterial(colliderDesc, material) {
        if (material == null) return colliderDesc;
        return colliderDesc
            .setFriction(material.friction)
            .setFrictionCombineRule(this._getCombineRule(material.combineFriction))
            .setRestitution(material.restitution)
            .setFrictionCombineRule(this._getCombineRule(material.combineRestitution));
    }
    _getCombineRule(combineString) {
        switch (combineString) {
            case "average":
                return RAPIER.CoefficientCombineRule.Average;
            case "min":
                return RAPIER.CoefficientCombineRule.Min;
            case "max":
                return RAPIER.CoefficientCombineRule.Max;
            case "multiply":
                return RAPIER.CoefficientCombineRule.Multiply;
        }
    }




    step() {
        if (this.world != null && this.enabled === true) {
            this.world.step();
        }
    }
}

export { PhysicsEngine }