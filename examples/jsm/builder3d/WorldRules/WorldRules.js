import * as THREE from '../../../../build/three.module.js';
import { VRuser } from '../Users/VRuser.js';
import { PCuser } from '../Users/PCuser.js';
import { ExtrasLoader } from '../ExtrasLoaders/ExtrasLoader.js'


// WORLD RULES DEFINES WHEN ARE ACTIONS GOING TO BE TRIGGERED
class WorldRules {
    constructor(builder) {
        const scope = this;
        this.cubeSkybox = null;
        //this.loadGLTF = builder.loadGLTF;

        this.mainFontFamilyLocation = "https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/fonts/Roboto-msdf.json";
        this.mainFontTextureLocation = "https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/fonts/Roboto-msdf.png";

        this.builder = builder;

        this.extrasLoader = new ExtrasLoader(builder, this);
        this.vruser = new VRuser(builder, this);
        this.pcuser = new PCuser(builder, this);

        this.onxr = false;

        this.update = function() {
            //if xr this.VRuser.tick();
            //else  this.PCuser.tick();
            this.pcuser.tick(builder.clockDelta);
            this.vruser.tick(builder.clockDelta);
            if (this.cubeSkybox !== null)
                this.cubeSkybox.tick(builder.clockDelta);
        }

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
    setSkybox(cubeTexture, scale = 1) {
        const scope = this;
        if (scope.cubeSkybox == null) {
            scope.builder.loadGLTF('https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/models/cubeSkybox.glb', function onLoad(gltf) { //cube
                scope.cubeSkybox = new CubeSkybox(gltf.scene, cubeTexture, scale);
                console.log("loads skybox");
            })
        } else {
            scope.cubeSkybox.changeSkybox(cubeTexture, scale);
        }
    }

    setPositionWitObject(obj) {
        if (this.onxr === true) {
            this.vruser.setPositionWitObject(obj);
        } else {
            this.pcuser.setPositionWitObject(obj);
        }
    }
}

class CubeSkybox {
    constructor(object, cubeTexture, scale) {
        this.customUniformsCubemap = [];
        this.scale = scale === undefined ? 1 : scale;
        this.skyboxObject = object;
        object.scale.set(-scale, scale, scale);

        // CREATE NECESSARY SHADERS
        let vs_000 = `varying vec2 vUv;
            void main(){
            vUv = uv;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_Position = projectionMatrix * mvPosition;}`;
        let fs_000 = `varying vec2 vUv;
            uniform float colorInterpolation;
            uniform sampler2D mainTexture;
            uniform sampler2D backTexture;
            void main(void) {
            vec3 color1 = texture2D(mainTexture, vUv).rgb;
            vec3 color2 = texture2D(backTexture, vUv).rgb;
            color1.rgb*=1.0-colorInterpolation;
            color2.rgb*=colorInterpolation;
            gl_FragColor = vec4(color1.rgb + color2.rgb, 1.0);}`;

        // CREATE CUBEMAP TEXTURES SEPARATED
        let textures = [];
        for (let i = 0; i < cubeTexture.images.length; i++) {
            const newText = new THREE.Texture(cubeTexture.images[i]);
            newText.encoding = THREE.sRGBEncoding;;
            newText.needsUpdate = true;

            textures.push(newText);
        }

        // SET CUSTOM UNIFORMS WITH NEW TEXTURES
        let cubemapMaterials = [];
        for (var i = 0; i < 6; i++) {
            this.customUniformsCubemap.push({
                colorInterpolation: { value: 1.0 },
                mainTexture: { value: textures[i] },
                backTexture: { value: textures[i] }
            });
        }

        // CREATE MATERIALS WITH CUSTOM UNIFORMS
        for (var i = 0; i < 6; i++) {
            cubemapMaterials.push(new THREE.ShaderMaterial({
                uniforms: this.customUniformsCubemap[i],
                vertexShader: vs_000,
                fragmentShader: fs_000
            }));
        }

        // SAVE THE MESH THAT COMES ON THE FILE
        let meshes = [];
        object.traverse(function(child) {
            if (child.isMesh) {
                meshes.push(child);
            };
        });

        // ASSIGN EACH OF THE MESH FAHCES THE MATERIALS
        meshes[0].material = cubemapMaterials[1];
        meshes[1].material = cubemapMaterials[0];
        meshes[2].material = cubemapMaterials[3];
        meshes[3].material = cubemapMaterials[2];
        meshes[4].material = cubemapMaterials[5];
        meshes[5].material = cubemapMaterials[4];
    }
    tick(clockDelta) {
        if (this.customUniformsCubemap[0].colorInterpolation.value < 1) {
            clockDelta = clockDelta > 0.01 ? 0.01 : clockDelta;
            for (var i = 0; i < 6; i++) {
                this.customUniformsCubemap[i].colorInterpolation.value += clockDelta;
            }
            if (this.customUniformsCubemap[0].colorInterpolation.value >= 1) {
                for (var i = 0; i < 6; i++) {
                    this.customUniformsCubemap[i].mainTexture.value = this.customUniformsCubemap[i].backTexture.value;
                    this.customUniformsCubemap[i].colorInterpolation.value = 1;
                }
            }
        }
    }
    changeSkybox(cubeTexture, scale) {
        const scope = this;
        if (this.scale < scale) {
            this.scale = scale;
            this.skyboxObject.scale.set(-scale, scale, scale);
        }

        const textures = [];
        for (let i = 0; i < cubeTexture.images.length; i++) {
            const newText = new THREE.Texture(cubeTexture.images[i]);
            newText.encoding = THREE.sRGBEncoding;;
            newText.needsUpdate = true;

            textures.push(newText);
        }

        Promise.all(textures).then(function(cubeTextures) {
            for (var i = 0; i < 6; i++) {
                scope.customUniformsCubemap[i].colorInterpolation.value = 0;
                scope.customUniformsCubemap[i].backTexture.value = cubeTextures[i];
            }
        })

    }
}


export { WorldRules, CubeSkybox }