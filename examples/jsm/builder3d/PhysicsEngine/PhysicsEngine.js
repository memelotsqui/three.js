import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

class PhysicsEngine {
    constructor(engine, callback) {
        const scope = this;
        this.enabled = true;
        this.world = null;
        this.gravity = { x: 0.0, y: -9.81, z: 0.0 };

        //this.testObject = null;

        RAPIER.init().then(() => {
            scope.world = new RAPIER.World(scope.gravity);
            console.log(scope.world);
            // Create the ground
            // let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.1, 10.0);
            // scope.world.createCollider(groundColliderDesc);

            // // Create a dynamic rigid-body.
            // let rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic()
            //     .setTranslation(0.0, 1.0, 0.0);
            // let rigidBody = scope.world.createRigidBody(rigidBodyDesc);

            // // Create a cuboid collider attached to the dynamic rigidBody.
            // let colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
            // let collider = scope.world.createCollider(colliderDesc, rigidBody.handle);

            // this.testObject = rigidBody;

            if (callback != null)
                callback();
        });


    }
    creatGLTFPhysics(gltf) {
        //aply phsyics based on gltf format specs...
    }
    step() {
        if (this.world != null && this.enabled === true) {
            this.world.step();
            //if (this.testObject != null) {
            //let position = this.testObject.translation();
            //console.log("Rigid-body position: ", position.x, position.y, position.z);
            //}
            //console.log("were in");
        }
    }
}

export { PhysicsEngine }