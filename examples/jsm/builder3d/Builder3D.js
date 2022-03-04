import { GLTFLoader } from '../loaders/GLTFLoader.js';
import { KTX2Loader } from '../loaders/KTX2Loader.js';
import * as THREE from 'three';
import { BuilderButton } from './BuilderButton.js';
import StatsVR from '../stats/statsvr.js';
import Stats from '../libs/stats.module.js'
import { WorldRules } from './WorldRules/WorldRules.js';
import { SmartObject } from './SmartObjects/SmartObject.js';



class Builder3D {
    //constructor(containerID, quality, debug, baseObjects = {}) {
    constructor(containerID, parameters, loadIndex = false, builderButton = null) {
        const scope = this;
        const defaultQuality = 1; // change to calculate depending on device
        const clock = new THREE.Clock();
        this.xrSession = null;

        const ktx2TranscoderPath = 'https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/libs/basis/';

        this.builderButton = builderButton;
        if (builderButton == null) {
            this.builderButton = new BuilderButton();
            this.builderButton.builder = this;
        }

        if (parameters == null) parameters = {};
        if (parameters.debug == null) parameters.debug = false
            //button
            //const switchButton = new BuilderButton(buttonID, this)

        this.baseObjects = getBasicObjects();

        this.scene = null; //THE MAIN SCENE, BY DEFAULT IS EMPTY, BUT WILL HOLD EVERY SCENE
        this.hiddenScene = new THREE.Object3D();
        this.clockDelta;

        this.quality = parameters.quality == null ? defaultQuality : parameters.quality;
        this.container = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.gltfLoader = new GLTFLoader();




        this.currentPage = "";
        this.pageSession = [];

        this.rules = null;

        this.room = -1;
        this.smartObjects = [];

        this.worldRules = null; //the rules to apply to each world

        //let mouse, touchHammer;
        let statsVR, stats;
        let iOSDevice = false;

        SetupViewer(containerID);

        this.gltfLoader.manager.setURLModifier((url) => {
            if (url.startsWith('https:') || url.startsWith('http:'))
                return url;
            return `${ scope.currentPage + url}`;
        })



        //stats
        if (parameters.debug == true) {
            stats = Stats()
            document.body.appendChild(stats.dom)
            statsVR = new StatsVR(scope.scene, scope.camera);
        }

        iOSDevice = iOS();
        animate();

        function getBasicObjects() {
            let baseObjects = {}
            baseObjects.smartVRKeyboard = parameters.smartVRKeyboard === undefined ? "location://asjdn" : parameters.smartVRKeyboard;
            baseObjects.smartVRLoading = parameters.smartVRLoading === undefined ? "location://asjdn" : parameters.smartVRKeyboard;
            baseObjects.smartVRHands = parameters.smartVRHands === undefined ? "location://asjdn" : parameters.smartVRKeyboard;
            baseObjects.smartVRControls = parameters.smartVRControls === undefined ? "location://asjdn" : parameters.smartVRKeyboard;
            baseObjects.smartVRSkybox = parameters.smartVRSkybox === undefined ? "location://asjdn" : parameters.smartVRKeyboard;
            return baseObjects;
        }

        function SetupViewer(containerID) {
            scope.container = document.getElementById(containerID);
            if (scope.container == null) {
                scope.container = document.createElement("div");
                // not necessary to append to dom for xr
                console.log("created div for xr");
            }
            if (scope.container != null) {
                scope.camera = new THREE.PerspectiveCamera(90, scope.container.clientWidth / scope.container.clientHeight, .1, 20000)
                scope.camera.position.set(-20, 20, 20);
                scope.camera.layers.enableAll();
                scope.scene = new THREE.Scene();
                scope.scene.add(scope.camera);

                let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
                renderer.setClearColor(0xFFFFFF, 1);
                renderer.setPixelRatio(window.devicePixelRatio);
                renderer.setSize(scope.container.clientWidth, scope.container.clientHeight);
                //renderer.outputEncoding = THREE.LinearEncoding;
                renderer.toneMapping = THREE.ACESFilmicToneMapping;
                renderer.toneMappingExposure = 1;
                scope.container.appendChild(renderer.domElement);
                renderer.rect = renderer.domElement.getBoundingClientRect();
                renderer.localClippingEnabled = true;
                renderer.xr.enabled = true;
                let ktx2loader = new KTX2Loader(scope.gltfLoader.manager)
                    .setTranscoderPath(ktx2TranscoderPath)
                    .detectSupport(renderer);

                scope.gltfLoader.setKTX2Loader(ktx2loader);

                scope.renderer = renderer;
                scope.rules = new WorldRules(scope);
                //testingCode();




                if (loadIndex === true) {
                    scope.loadSession(`${window.location.protocol}//${window.location.hostname}/xr-index.json`);
                }
                //scope.currentPage = `${window.location.protocol}//${window.location.hostname}/`;
            }
        }

        function testingCode() {
            console.log("TESTING MODE");
            //console.log(scope.renderer.physicallyCorrectLights);
            scope.renderer.physicallyCorrectLights = true;
            //let hemiLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.02);
            //scope.scene.add(hemiLight);
            //hemiLight.position.set(0, 10, 0);


            const bulbGeometry = new THREE.SphereGeometry(0.02, 16, 8);
            let bulbLight = new THREE.PointLight(0xffee88, 20, 10, 2);
            bulbLight.castShadow = true;

            let bulbMat = new THREE.MeshStandardMaterial({
                emissive: 0xffffee,
                emissiveIntensity: 1,
                color: 0x000000
            });
            bulbLight.add(new THREE.Mesh(bulbGeometry, bulbMat));
            bulbLight.position.set(2, 2, 4);
            //scope.scene.add(bulbLight);

            //scope.renderer.toneMappingExposure = 7;
        }

        if (!iOSDevice) {
            //document.body.appendChild(VRButton.createButton(scope.renderer));
            setRenderDeviceRatio(1 / getDevicePixelRatio());
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

        function getDevicePixelRatio() {
            var mediaQuery;
            var is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
            if (window.devicePixelRatio !== undefined && !is_firefox) {
                if (window.devicePixelRatio > 2)
                    return 2;
                if (window.devicePixelRatio < 1)
                    return 1;
                return window.devicePixelRatio;
            } else if (window.matchMedia) {
                mediaQuery = "(-webkit-min-device-pixel-ratio: 1.5),\
                  (min--moz-device-pixel-ratio: 1.5),\
                  (-o-min-device-pixel-ratio: 3/2),\
                  (min-resolution: 1.5dppx)";
                if (window.matchMedia(mediaQuery).matches) {
                    return 1.5;
                }
                mediaQuery = "(-webkit-min-device-pixel-ratio: 2),\
                  (min--moz-device-pixel-ratio: 2),\
                  (-o-min-device-pixel-ratio: 2/1),\
                  (min-resolution: 2dppx)";
                if (window.matchMedia(mediaQuery).matches) {
                    return 2;
                }
                mediaQuery = "(-webkit-min-device-pixel-ratio: 0.75),\
                  (min--moz-device-pixel-ratio: 0.75),\
                  (-o-min-device-pixel-ratio: 3/4),\
                  (min-resolution: 0.75dppx)";
                if (window.matchMedia(mediaQuery).matches) {
                    return 1;
                    //return 0.7;
                }
            } else {
                return 1;
            }
        }

        function animate() {

            scope.renderer.setAnimationLoop(update);

        }


        function update() {
            scope.rules.update();
            scope.clockDelta = clock.getDelta();
            tick(scope.clockDelta);
            scope.renderer.render(scope.scene, scope.camera);
            //scope.controls.update();
            if (parameters.debug == true) {
                stats.update();
                statsVR.update();
                console.log(scope.renderer.info.render.calls);
            }
        }

        function tick(clockDelta) {
            //call tick from all smartObjects
            for (let i = 0; i < scope.smartObjects.length; i++) {
                if (scope.smartObjects[i] != null) {
                    scope.smartObjects[i].tick(clockDelta);
                }
            }
        }
        window.addEventListener('resize', onScreenResize, false);

        function onScreenResize() {
            // call onscreen resize of smart object
            scope.camera.aspect = scope.container.clientWidth / scope.container.clientHeight;
            scope.camera.updateProjectionMatrix();
            scope.renderer.setSize(scope.container.clientWidth, scope.container.clientHeight);
            scope.renderer.rect = scope.renderer.domElement.getBoundingClientRect();
        }

        function setRenderDeviceRatio(value) {
            scope.renderer.setPixelRatio(window.devicePixelRatio * value);
            scope.renderer.setSize(scope.container.clientWidth, scope.container.clientHeight);
        }

        function toggleFullscreen(toggle) {
            if (toggle) {
                if (!document.fullscreenElement) {
                    closeFullScreen.style.display = 'block';
                    fullScreen.style.display = 'none';
                    appContainer.requestFullscreen().catch(err => {
                        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                    });
                }
            } else {
                closeFullScreen.style.display = "none";
                fullScreen.style.display = "block";
                document.exitFullscreen();
            }
        }
        //this.loadJsonSmart('https://pio.lu/xr-index.json'); // /xr-public/ cors '*'

    }

    clearSession() {
        this.pageSession.forEach(smart => {

            smart.dispose();

        });
        this.pageSession = [];
    }

    async loadPage(page, onLoad) {
        const scope = this;
        this.loadSession(`https://${page}/xr-index.json`,
            function() {
                scope.currentPage = `https://${page}/`;
            },
            onLoad);
    }

    async loadSession(jsonLocation, onJsonLoad, onLoad, clearLastSession = true) {
        const scope = this;
        this.loadJsonSmart(jsonLocation,
            function() { // must have allow cors
                if (clearLastSession === true)
                    scope.clearSession();
                if (onJsonLoad != null) onJsonLoad();
            },
            onLoad);
    }

    async loadJsonSmart(location, onJsonLoad, onLoad) {
        const scope = this;
        fetch(location)
            .then(response => response.json())
            .then(data => {
                if (onJsonLoad != null) onJsonLoad();
                if (data.smartObjects !== undefined) {
                    let loadedModels = 0;
                    data.smartObjects.forEach(smart => {
                        if (smart.location !== undefined) {
                            scope.loadSmart(smart.location, smart.userData, function() { loadedModels++ });
                        }
                    });
                    console.log(loadedModels);
                    //if (loadedModels...)
                    //if (onLoad != null) onLoad();
                } else {
                    console.warn('no smartObjects defined in xr-index.json');
                }
            })
            .catch(error => console.error(error));
        console.log("after");
    }

    async loadSpace(location, customData, onLoad) {
        const scope = this;
        customData = customData === undefined ? {} : customData;

        customData.affectSceneEnvironment = customData.affectSceneEnvironment === undefined ? true : customData.affectSceneEnvironment;
        customData.addMeshBackground = customData.addMeshBackground === undefined ? true : customData.addMeshBackground;
        scope.loadSmart(location, customData, function loaded(smart) {
            if (scope.room !== -1) {
                scope.smartObjects[scope.room].dispose();
                scope.smartObjects[scope.room] = null;
            }
            scope.room = scope.smartObjects.indexOf(smart);

            if (onLoad !== undefined)
                onLoad(smart);
        });
    }
    async loadSmart(location, customData, onLoad, addToSession = true) {
        const scope = this;
        //console.log(`${location}-----new---`);
        customData = customData === undefined ? {} : customData;
        scope.loadGLTF(location, function loaded(gltf) {
            SmartObject.CreateSmartObject(gltf, customData, scope, function(smart) {
                if (addToSession) {
                    scope.pageSession.push(smart);
                }
                scope.smartObjects.push(smart);
                scope.scene.add(gltf.scene);
                if (gltf.userData.smartObject !== undefined)
                    if (gltf.userData.smartObject.smartType !== undefined)
                        if (gltf.userData.smartObject.smartType === "space")
                            scope.setRoom(smart);
                if (onLoad !== undefined)
                    onLoad(smart);
            });
        }, false);
    }


    async loadGLTF(location, onLoad, addToScene = true) {
        const scope = this;
        await scope.gltfLoader.loadAsync(location, onprogress = function(xhr) {
            //console.log((xhr.loaded / xhr.total) * 100);
        }).then(async function(gltf) {
            if (addToScene)
                scope.scene.add(gltf.scene);
            if (onLoad !== undefined)
                onLoad(gltf);
        }).catch(function(error) { console.error(error) });
    }

    // endXRSession(){
    //     this.builderButton
    // }
    ////

    // async onXRSessionStarted(xrSession) {
    //     const scope = this;
    //     console.log(scope);
    //     console.log(scope.onXRSessionEnded);
    //     xrSession.addEventListener('end', scope.onXRSessionEnded);
    //     await scope.renderer.xr.setSession(xrSession);
    //     scope.xrSession = xrSession;

    // }

    // onXRSessionEnded( /*event*/ ) {

    //     this.xrSession.removeEventListener('end', this.onXRSessionEnded);
    //     this.xrSession = null;

    // }

    // enterVR() {
    //     const scope = this;
    //     if (this.xrSession === null) {
    //         const sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'high-fixed-foveation-level'] };
    //         navigator.xr.requestSession('immersive-vr', sessionInit).then(scope.onXRSessionStarted);
    //     }
    // } 

    async onXRSessionStarted(xrSession) {



    }

    onXRSessionEnded( /*event*/ ) {



    }

    enterVR() {
        const scope = this;
        if (this.xrSession === null) {
            const sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'high-fixed-foveation-level'] };
            navigator.xr.requestSession('immersive-vr', sessionInit).then(async function(xrSession) {
                xrSession.addEventListener('end', function() {
                    scope.xrSession.removeEventListener('end', this);
                    scope.xrSession = null;
                });
                await scope.renderer.xr.setSession(xrSession);
                scope.xrSession = xrSession;
            });
        }
    }

    exitVR() {

        if (this.xrSession !== null) {
            this.clearSession();
            this.xrSession.end();
            // if (`${window.location.protocol}//${window.location.hostname}/` !== this.currentPage) {
            //     window.open(this.currentPage, "_self")
            // }
            if (this.currentPage != '') {
                window.open(this.currentPage, "_self")
            }
        }
    }

    ////

    setRoom(smart) {
        // const scope = this;
        // if (scope.room !== -1) {
        //     scope.smartObjects[scope.room].dispose();
        //     scope.smartObjects[scope.room] = null;
        // }
        // scope.room = scope.smartObjects.indexOf(smart);
    }

}




export { Builder3D };