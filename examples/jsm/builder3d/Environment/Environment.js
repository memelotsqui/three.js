import * as THREE from 'three';

class Environment {
    constructor(builder) {

        const scope = this;

        this.builder = builder;
        this.cubeSkybox = null;

        this._fog = builder.scene.fog;
        this._diferentialFog = {
            color: new THREE.Color(0, 0, 0),
            density: 0
        }
        this._targetFog = {
            color: new THREE.Color(0, 0, 0),
            density: 0
        }
        this._fogTimer = 0;
        this._switchedFog = false;



    }

    tick(clockDelta) {
        this._changeFog(clockDelta)
        if (this.cubeSkybox !== null)
            this.cubeSkybox.tick(clockDelta);
    }

    setFog(color, density, time, customData) {
        if (time != null) {
            const timeFraction = 1 / time;
            this._diferentialFog = {
                color: new THREE.Color((color.r - this._fog.color.r) * timeFraction, (color.g - this._fog.color.g) * timeFraction, (color.b - this._fog.color.b) * timeFraction),
                density: (density - this._fog.density) * timeFraction
            }
            this._targetFog = {
                color: new THREE.Color(color.r, color.g, color.b),
                density: density
            }
            this._fogTimer = time;
            this._switchedFog = true;
        } else {
            this._fog.color = color;
            this._fog.density = density;
        }

    }

    setSkybox(cubeTexture, time, customData) {
        const scope = this;
        customData = customData || {};
        const scale = customData.scale || 1;
        if (scope.cubeSkybox == null) {
            scope.builder.loadGLTF('https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/models/cubeSkybox.glb', function onLoad(gltf) { //cube
                scope.cubeSkybox = new CubeSkybox(gltf.scene, cubeTexture, scale);
            })
        } else {
            scope.cubeSkybox.changeSkybox(cubeTexture, scale, time);
        }
    }

    _changeFog(clockDelta) {
        if (this._fogTimer > 0) {
            this._fogTimer -= clockDelta;
            this._fog.density += this._diferentialFog.density * clockDelta;

            //scope._fog.color.add(scope._diferentialFog.color.multiplyScalar(clockDelta));
            this._fog.color.r += this._diferentialFog.color.r * clockDelta;
            this._fog.color.g += this._diferentialFog.color.g * clockDelta;
            this._fog.color.b += this._diferentialFog.color.b * clockDelta;
        } else {
            if (this._switchedFog === true) {
                this._fog.density = this._targetFog.density;
                this._fog.color = {...this._targetFog.color }
                this._switchedFog = false;
            }
        }
    }
}

class CubeSkybox {
    constructor(object, cubeTexture, scale) {
        this.customUniformsCubemap = [];
        this.scale = scale === undefined ? 1 : scale;
        this.skyboxObject = object;
        this._timeToChange = 1;
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
            newText.encoding = THREE.sRGBEncoding;
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


        // FLIP CUBE FACES IN IOS AND FIREFOX
        if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1 || iOS()) {
            meshes[0].scale.set(1, -1, 1);
            meshes[1].scale.set(1, -1, 1);
            meshes[2].scale.set(1, 1, -1);
            meshes[3].scale.set(1, 1, -1);
            meshes[4].scale.set(1, -1, 1);
            meshes[5].scale.set(1, -1, 1);
        }

        function iOS() {
            return [
                    'iPad Simulator',
                    'iPhone Simulator',
                    'iPod Simulator',
                    'iPad',
                    'iPhone',
                    'iPod'
                ].includes(navigator.platform)
                // iPad on iOS 13 detection
                ||
                (navigator.userAgent.includes("Mac") && "ontouchend" in document)
        }
    }
    tick(clockDelta) {
        if (this.customUniformsCubemap[0].colorInterpolation.value < 1) {
            clockDelta = clockDelta > 0.01 ? 0.01 : clockDelta;
            for (var i = 0; i < 6; i++) {
                this.customUniformsCubemap[i].colorInterpolation.value += clockDelta * this._timeToChange;
            }
            if (this.customUniformsCubemap[0].colorInterpolation.value >= 1) {
                for (var i = 0; i < 6; i++) {
                    this.customUniformsCubemap[i].mainTexture.value = this.customUniformsCubemap[i].backTexture.value;
                    this.customUniformsCubemap[i].colorInterpolation.value = 1;
                }
            }
        }
    }
    changeSkybox(cubeTexture, scale, time = 1) {
        this._timeToChange = 1 / time;
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
                if (scope.customUniformsCubemap[i].colorInterpolation.value != 1) {
                    scope.customUniformsCubemap[i].mainTexture.value = scope.customUniformsCubemap[i].backTexture.value;
                }
                scope.customUniformsCubemap[i].colorInterpolation.value = 0;
                scope.customUniformsCubemap[i].backTexture.value = cubeTextures[i];
            }
        })

    }
}

export { Environment }