import * as THREE from 'three';
import { VRuser } from '../Users/VRuser.js';
import { PCuser } from '../Users/PCuser.js';
import { ExtrasLoader } from '../ExtrasLoaders/ExtrasLoader.js'
import { PhysicsEngine } from '../PhysicsEngine/PhysicsEngine.js'
import { Environment } from '../Environment/Environment.js'
import { Controller } from '../Controllers/Controller.js';


// WORLD RULES DEFINES WHEN ARE ACTIONS GOING TO BE TRIGGERED
class WorldRules {
    constructor(builder) {
        //testing

        const scope = this;

        this.mainFontFamilyLocation = "https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/fonts/Roboto-msdf.json";
        this.mainFontTextureLocation = "https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/fonts/Roboto-msdf.png";

        this.builder = builder;


        this.environment = new Environment(builder);
        this.physicsEngine = new PhysicsEngine();
        this.extrasLoader = new ExtrasLoader(builder, this);
        this.controller = new Controller(builder);
        //this.controller   //controller for inputs
        //this.currentUser  //current active user
        this.vruser = new VRuser(builder, this.controller, this);
        this.pcuser = new PCuser(builder, this.controller, this);

        // first person here
        //this.mbuser   //user for mobile sevices

        this.onxr = false;


        builder.renderer.xr.addEventListener('sessionstart', function(event) {

            //loadCubemapTextures(fpsSkyboxTextures, location + "/", changeCubeMapTextures);
            //scope.extras.setVRQuality(scope.quality, true);
            console.log("xr start");
            scope.onxr = true;

        });

        builder.renderer.xr.addEventListener('sessionend', function(event) {

            console.log("xr end");
            scope.onxr = false;
            this.vruser.moveToPosition(new THREE.Vector3(0, 0, 0));
            //loadCubemapTextures(tpsSkyboxTextures, "./img/", changeCubeMapTextures);

        });

        if (navigator.xr !== undefined) {
            navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {

            });
        }
    }
    update(clockDelta) {
        //if xr this.VRuser.tick();
        //else  this.PCuser.tick();
        this.controller.tick(clockDelta);
        this.pcuser.tick(clockDelta);
        this.vruser.tick(clockDelta);
        this.physicsEngine.step();

        this.environment.tick(clockDelta);
    }

    setSkybox(cubeTexture, time, customData) {
        //time = time == null ? 0 : time;
        time = time || 0;
        if (this.environment != null) {
            if (this.environment.setSkybox != null) {
                this.environment.setSkybox(cubeTexture, time, customData);
            }
        }
    }
    setFog(color, density, time, customData) {
        if (this.environment != null) {
            if (this.environment.setFog != null) {
                this.environment.setFog(color, density, time);
            }
        }
    }

    setPositionWitObject(obj) {
        if (this.onxr === true) {
            this.vruser.setPositionWitObject(obj);
        } else {
            this.pcuser.setPositionWitObject(obj);
        }
    }

    // WORLD LIMITS USER MAY MOVE AROUND
    setLimits(xmin, xmax, ymin, ymax, zmin, zmax) {
        if (this.pcuser != null)
            if (this.pcuser.setLimits != null)
                this.pcuser.setLimits(xmin, xmax, ymin, ymax, zmin, zmax);
    }

    getUserPosition() {
        if (this.onxr === true) {
            return this.vruser.getPosition();
        } else {
            return this.pcuser.getPosition()
        }
    }

    //loads custom environment definition
    loadEnvironment(url) {
        //pending
    }

    //loads custom physicsEngine definition
    loadPhysicsEngine(url) {
        //pending
    }

}




export { WorldRules }