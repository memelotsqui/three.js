import { GLTFLoader } from '../loaders/GLTFLoader.js';
import { DRACOLoader } from '../loaders/DRACOLoader.js';
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

        const ktx2TranscoderPath = 'https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/libs/basis/';
        const dracoDecoderPath = 'https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/libs/draco/';

        this.builderButton = builderButton;
        if (builderButton == null) {
            this.builderButton = new BuilderButton();
            this.builderButton.builder = this;
        }

        if (parameters == null) parameters = {};
        if (parameters.debug == null) parameters.debug = false

        this.xrSession = null;
        this.baseObjects = getBasicObjects();
        this.smartTeleporter = null;

        this.scene = null; //THE MAIN SCENE, BY DEFAULT IS EMPTY, BUT WILL HOLD EVERY SCENE
        this.hiddenScene = new THREE.Object3D();

        const clock = new THREE.Clock();
        this.clockDelta;

        this.quality = parameters.quality == null ? defaultQuality : parameters.quality;
        this.container = null;
        this.renderer = null;
        this.camera = null;
        this.audioListener = null;
        this.gltfLoader = new GLTFLoader();
        this.rules = null; //the rules to apply to each world

        this._userInteracted = false;

        this.currentPage = "";
        this.pageSession = [];

        this.room = -1;
        this.smartObjects = [];
        this.currentStoredData = [];

        let statsVR, stats;

        SetupViewer(containerID);





        this.gltfLoader.manager.setURLModifier((url) => {
            if (url.startsWith('https:') || url.startsWith('http:'))
                return url;
            return `${ scope.currentPage + url}`;
        })

        this.container.addEventListener("click", onUserFirstInteract, false);
        window.addEventListener('resize', onScreenResize, false);

        //stats
        if (parameters.debug == true) {
            stats = Stats()
            document.body.appendChild(stats.dom)
            statsVR = new StatsVR(scope.scene, scope.camera);
        }

        if (!iOS()) {
            setRenderDeviceRatio(1 / getDevicePixelRatio());
        }

        function onUserFirstInteract() {
            scope.container.removeEventListener("click", onUserFirstInteract, false);
            scope._onUserFirstInteract();
        }

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

                scope.camera = new THREE.PerspectiveCamera(90, scope.container.clientWidth / scope.container.clientHeight, .05, 20000)
                scope.camera.position.set(-20, 20, 20);
                scope.camera.layers.enableAll();
                scope.scene = new THREE.Scene();
                scope.scene.add(scope.camera);

                //test fog
                scope.scene.fog = new THREE.FogExp2(0xffffff, 0);

                scope.audioListener = new THREE.AudioListener();
                scope.camera.add(scope.audioListener);

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
                scope.gltfLoader.setAudioListener(scope.audioListener);
                scope.gltfLoader.setDRACOLoader(createDracoLoader());

                scope.renderer = renderer;
                scope.rules = new WorldRules(scope);
                //testingCode();
                loadBasics();


                if (loadIndex === true) {
                    scope.loadSession(`${window.location.protocol}//${window.location.hostname}/xr-index.json`);
                }
                //scope.currentPage = `${window.location.protocol}//${window.location.hostname}/`;
            }
        }



        //console.log(this.loadJsonSmart);
        //console.log(this.gltfLoader.loadAsync);

        function loadBasics() {
            scope.loadSmart("https://3dbuilds.nyc3.cdn.digitaloceanspaces.com/smart/assets/models/teleporter_3/gltf.gltf", {}, (sm) => {
                scope.smartTeleporter = sm;
            }, false);
        }

        function createDracoLoader() {
            const loader = new DRACOLoader();
            loader.setDecoderPath(dracoDecoderPath);
            loader.preload();
            return loader;
        }

        function testingCode() {
            console.log("TESTING MODE");
            document.addEventListener("click", () => {

            });
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

            const light = new THREE.AmbientLight(0x111111); // white light
            light.intensity = 1;
            //scope.scene.add( light );

            //scope.renderer.toneMappingExposure = 7;
        }


        // RETURNS WETHER DEVICE IS IOS OR NOT
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
            scope.clockDelta = clock.getDelta();
            scope.rules.update(scope.clockDelta);
            tick(scope.clockDelta);
            scope.renderer.render(scope.scene, scope.camera);
            if (parameters.debug == true) {
                stats.update();
                statsVR.update();
                console.log(scope.renderer.info.render.calls);
            }
        }

        //decide wither tick or update
        function tick(clockDelta) {
            //call tick from all smartObjects
            for (let i = 0; i < scope.smartObjects.length; i++) {
                if (scope.smartObjects[i] != null) {
                    scope.smartObjects[i].tick(clockDelta);
                }
            }
        }

        function onScreenResize() {
            scope.camera.aspect = scope.container.clientWidth / scope.container.clientHeight;
            scope.camera.updateProjectionMatrix();
            scope.renderer.setSize(scope.container.clientWidth, scope.container.clientHeight);
            scope.renderer.rect = scope.renderer.domElement.getBoundingClientRect();
            for (let i = 0; i < scope.smartObjects.length; i++) {
                if (scope.smartObjects[i] != null) {
                    scope.smartObjects[i].onScreenResize(scope.container)
                }
            }
        }

        function setRenderDeviceRatio(value) {
            scope.renderer.setPixelRatio(window.devicePixelRatio * value);
            scope.renderer.setSize(scope.container.clientWidth, scope.container.clientHeight);
        }



    }

    toggleFullscreen(toggle) {
        if (toggle) {
            if (!document.fullscreenElement) {
                this.container.requestFullscreen().catch(err => {
                    alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
            }
        } else {
            document.exitFullscreen();
        }
    }
    sendData(data, store = false) {
        const scope = this;
        if (store === true) {
            scope.currentStoredData = data;
        }
        scope.smartObjects.forEach(smart => {
            smart.receiveData(scope.currentStoredData);
        });

    }
    clearSession(session) {
        session.forEach(smart => {
            //console.log(smart);
            if (smart != null) {
                smart.dispose();
            }
        });
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
        fetch(jsonLocation)
            .then(response => response.json())
            .then(data => {
                if (onJsonLoad != null)
                    onJsonLoad();
                scope.loadJsonSmart(data, onLoad, clearLastSession);
            })
            .catch(error => console.error(error));

    }

    async loadJsonSmart(data, onLoad, clearLastSession = true) {
        const scope = this;

        let sessionCleared = false;
        if (scope.smartTeleporter != null) {
            const lastSession = scope.pageSession;
            scope.smartTeleporter.startTeleport(function() {
                if (clearLastSession === true) {
                    scope.clearSession(lastSession);
                    sessionCleared = true;
                }
            });
        }

        if (clearLastSession === true) {
            scope.pageSession = [];
            if (sessionCleared === false) scope.clearSession(scope.pageSession);
        }

        if (data.smartObjects !== undefined) {
            let loadedModels = 0;
            const size = data.smartObjects.length;
            console.log(data.smartObjects);
            data.smartObjects.forEach(smart => {
                if (smart.location !== undefined) {
                    scope.loadSmart(smart.location, smart.userData, function() {
                        loadedModels++
                        if (loadedModels == size) {
                            if (onLoad != null) onLoad();

                            //end teleport animation
                            if (scope.smartTeleporter != null) scope.smartTeleporter.endTeleport();
                            console.log("finishes, check");
                        }
                    });
                }
            });
            //console.log(loadedModels);
            //if (loadedModels...)
            //if (onLoad != null) onLoad();
        } else {
            console.warn('no smartObjects defined in xr-index.json');
        }
    }

    async loadSpace(location, customData, onLoad) {
        const scope = this;
        customData = customData === undefined ? {} : customData;
        //console.log("space: " + location);
        console.log("loadsspace");
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

    // ADDING TO SESSION WILL REMOVE ELEMENTS WJHEN A NEW SESSION IS LOADED
    async loadSmart(location, customData, onLoad, addToSession = true) {
        const scope = this;
        //console.log(`${location}-----new---`);
        customData = customData === undefined ? {} : customData;
        scope.loadGLTF(location, function loaded(gltf) {
            SmartObject.CreateSmartObject(gltf, customData, scope, function(smart) {
                if (addToSession) scope.pageSession.push(smart);

                scope.smartObjects.push(smart);
                //scope.scene.add(gltf.scene);

                // if (gltf.userData.smartObject !== undefined)
                //     if (gltf.userData.smartObject.smartType !== undefined)
                //         if (gltf.userData.smartObject.smartType === "space")
                //             scope.setRoom(smart);
                smart.receiveData(scope.currentStoredData);
                if (onLoad !== undefined)
                    onLoad(smart);
            });
        }, false);
    }

    addSmartObject(gltf, customData, addToSession = true) {
        const scope = this;
        console.log(gltf);
        SmartObject.CreateSmartObject(gltf, customData, scope, function(smart) {
            if (addToSession) scope.pageSession.push(smart);

            scope.smartObjects.push(smart);
        });
    }

    // loadGLTFAsync(url, onProgress) {

    //     const scope = this;

    //     return new Promise(function(resolve, reject) {

    //         scope.load(url, resolve, onProgress, reject);

    //     });

    // }


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

    async onXRSessionStarted(xrSession) {

    }

    onXRSessionEnded( /*event*/ ) {

    }

    _onUserFirstInteract() {
        const scope = this;
        if (scope._userInteracted === false) {
            scope._userInteracted = true;
            scope.smartObjects.forEach(element => {
                element._onUserFirstInteract()
            });
        }
    }

    enterVR() {
        this._onUserFirstInteract();
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
            this.clearSession(this.pageSession);
            this.pageSession = [];
            this.xrSession.end();
            // if (`${window.location.protocol}//${window.location.hostname}/` !== this.currentPage) {
            //     window.open(this.currentPage, "_self")
            // }
            this.xrSession = null;
            if (this.currentPage != '') {
                window.open(this.currentPage, "_self")
            }

            console.log(this.xrSession);
        }
    }

    //setRoom(smart) {
    // const scope = this;
    // if (scope.room !== -1) {
    //     scope.smartObjects[scope.room].dispose();
    //     scope.smartObjects[scope.room] = null;
    // }
    // scope.room = scope.smartObjects.indexOf(smart);
    //}

}




export { Builder3D };