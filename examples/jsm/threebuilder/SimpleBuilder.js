//import { OrbitControls } from '../controls/OrbitControls.js';
import { OrbitControls } from '../controls/OrbitControlsClickMove.js';
import { GLTFLoader } from '../loaders/GLTFLoaderExtras.js';
import { BuilderExtras } from './BuilderExtras.js';
import '../libs/hammer.min.js';
import * as THREE from 'three';
import { VRButton } from '../webxr/VRButton.js';
import StatsVR from '../stats/statsvr.js';
//stats
import Stats from '../libs/stats.module.js'


class SimpleBuilder {
    constructor(location) {

        const scope = this;
        window.simpleBuilder = this;

        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.clockDelta;
        this.extras;
        this.vrRaycastInteract = [];

        this.renderer = null;
        this.raycaster = null;

        let container, percentage, controls, mouse, touchHammer;
        let statsVR;

        this.viewStats = false;


        window.addEventListener('resize', onScreenResize, false);
        container = document.getElementById('container-3d');


        touchHammer = new Hammer(container);
        touchHammer.on('tap', hammerTap);

        mouse = new THREE.Vector2();

        StartLoading();
        SetupRenderer();
        SetupRaycaster();


        function StartLoading() {

            let gltfLoaded = 0;
            let texturesLoaded = 0;
            percentage = document.getElementById('load-percentage');
            let main_loading_manager = new THREE.LoadingManager();
            main_loading_manager.onLoad = function() {
                onLoad();

                document.getElementsByClassName('loading-screen')[0].style.display = 'none';
            };
            main_loading_manager.onProgress = function(url, itemsLoaded, itemsTotal) {
                if (itemsTotal > 2) {
                    texturesLoaded = Math.round((itemsLoaded) / itemsTotal * 100);
                    percentage.innerHTML = (gltfLoaded / 2) + (texturesLoaded / 2) + " %";
                }
            };
            main_loading_manager.onError = function(url) {
                console.log('There was an error loading ' + url);
            };

            let gltf_loader = new GLTFLoader(main_loading_manager);
            gltf_loader.load(location + '/gltf.gltf',
                function(gltf) {
                    scope.extras = new BuilderExtras(gltf, location, scope.scene, scope.renderer, false); // IMPROVE
                    scope.scene.add(gltf.scene);
                    if (scope.viewStats) {
                        statsVR = new StatsVR(scope.scene, scope.extras.mainCamera);
                    }

                    //test
                    // let mat = new THREE.MeshStandardMaterial({ color: 0xE91E63 })
                    // gltf.scene.traverse((o) => {
                    //     if (o.isMesh) {
                    //         o.material = mat;
                    //     }

                    // });

                    onScreenResize();
                },
                function(xhr) {
                    gltfLoaded = Math.round(xhr.loaded / xhr.total * 100);
                    console.log(gltfLoaded);
                    percentage.innerHTML = (gltfLoaded / 2) + (texturesLoaded / 2) + " %";
                },
                function(error) {
                    console.log('An error happened: ' + error)
                }
            );
        }

        function SetupRaycaster() {
            let raycaster = new THREE.Raycaster();
            raycaster.layers.enableAll();
            raycaster.layers.disable(2);
            scope.raycaster = raycaster;
        }

        function onVRButtonClick(active) {

        }

        function SetupRenderer() {
            let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setClearColor(0xffffff, 1);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(container.clientWidth, container.clientHeight);
            container.appendChild(renderer.domElement);
            renderer.rect = renderer.domElement.getBoundingClientRect();
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 2;
            renderer.xr.enabled = true;
            scope.renderer = renderer;
        }

        document.body.appendChild(VRButton.createButton(scope.renderer, onVRButtonClick));

        //stats
        let stats;
        if (this.viewStats === true) {
            stats = Stats()
            document.body.appendChild(stats.dom)
        }


        if (!iOS()) {
            setRenderDeviceRatio(1 / getDevicePixelRatio());
        }



        function createVRUser(extras) {
            var VRuser = new THREE.Group();
            VRuser.position.set(0, 0, 0);
            VRuser.add(extras.mainCamera);

            //right hand
            let oculusHand1 = new OculusController(VRuser, scope.renderer, 0);
            //left hand
            let oculusHand2 = new OculusController(VRuser, scope.renderer, 1);
            AddComponent(oculusHand1);
            AddComponent(oculusHand2);

            //oculusHand2.enabledHandMove = false;

            scope.scene.add(VRuser);
            extras.VRuser = VRuser;
        }

        function AddComponent(component) {
            if (component.object.userData.components == undefined) {
                component.object.userData.components = [];
            }
            component.object.userData.components.push(component);
            scope.extras.allComponents.push(component);
        }

        function GetComponent(object, componentType) {
            let result;
            if (object !== undefined) {
                if (object.userData.components !== undefined) {
                    object.userData.components.some(function(comp) {
                        if (comp instanceof componentType) {
                            result = comp;
                        }
                    });
                }
            }
            return result;
        }

        function GetComponents(object, componentType) {
            let result = [];
            if (object !== undefined) {
                if (object.userData.components !== undefined) {
                    object.userData.components.forEach(function(comp) {
                        if (comp instanceof componentType) {
                            result.push(comp);
                        }
                    });
                }
            }
            return result;
        }

        function hammerTap(e) {
            mouse.x = ((e.center.x - scope.renderer.rect.left) / scope.renderer.rect.width) * 2 - 1;
            mouse.y = -((e.center.y - scope.renderer.rect.top) / scope.renderer.rect.height) * 2 + 1;
            if (e.tapCount == 2) {
                multiClick();
            }
            if (e.tapCount == 1) {
                simpleClick();
            }
        }

        function simpleClick() {}

        function multiClick() {}

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

        function onLoad() {
            setupOrbitControls();
            animate();

        }
        this.onControlsChange = function(onfps) {}

        function setupOrbitControls() {
            controls = new OrbitControls(scope.extras.mainCamera, scope.renderer.domElement, scope.onControlsChange);
            if (scope.extras.gltf.userData.orbitControls !== undefined) {
                controls.target.set(scope.extras.gltf.userData.orbitControls.target[0], scope.extras.gltf.userData.orbitControls.target[1], scope.extras.gltf.userData.orbitControls.target[2]);
                controls.enableDamping = scope.extras.gltf.userData.orbitControls.dampling;
                //controls.dampingFactor = 0.1;
                controls.dampingFactor = scope.extras.gltf.userData.orbitControls.dampFactor;
                controls.smoothZoom = scope.extras.gltf.userData.orbitControls.smoothZoom;
                controls.minDistance = scope.extras.gltf.userData.orbitControls.minDist;
                controls.maxDistance = scope.extras.gltf.userData.orbitControls.maxDist;
                controls.minPolarAngle = scope.extras.gltf.userData.orbitControls.minPolar;
                controls.maxPolarAngle = scope.extras.gltf.userData.orbitControls.maxPolar;
            } else {
                controls.target.set(0, 0, 0);
                controls.enableDamping = true;
                controls.dampingFactor = 0.1;
                controls.smoothZoom = 0.1;
                controls.minDistance = 1;
                controls.maxDistance = 100;
                controls.minPolarAngle = 0;
                controls.maxPolarAngle = 1.57;
            }
            controls.update();
        }

        function animate() {
            scope.renderer.setAnimationLoop(update);
        }


        function update() {
            tick();
            scope.clockDelta = scope.clock.getDelta();
            scope.renderer.render(scope.scene, scope.extras.mainCamera);
            controls.update();
            if (scope.viewStats) {
                stats.update();
                statsVR.update();
            }
        }

        function tick() {
            scope.extras.allComponents.forEach((c) => {
                c.tick();
            });
        }

        function onRaycastHit(object) {
            if (object.userData.components !== undefined) {
                object.userData.components.forEach((c) => {
                    c.onRaycastHit();
                });
            }
        }

        function onScreenResize() {
            scope.extras.mainCamera.aspect = container.clientWidth / container.clientHeight;
            scope.extras.mainCamera.updateProjectionMatrix();
            scope.renderer.setSize(container.clientWidth, container.clientHeight);
            scope.renderer.rect = scope.renderer.domElement.getBoundingClientRect();
        }

        function setRenderDeviceRatio(value) {
            scope.renderer.setPixelRatio(window.devicePixelRatio * value);
            scope.renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
}
class ObjectComponent {
    constructor(object) {
        this.object = object;
    }
    tick() {

    }
    onRaycasteHit() {

    }
}





export { SimpleBuilder };