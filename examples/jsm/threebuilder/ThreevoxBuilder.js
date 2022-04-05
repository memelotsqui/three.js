//import { OrbitControls } from '../controls/OrbitControls.js';
import { OrbitControls } from '../controls/OrbitControlsClickMove.js';
import { GLTFLoader } from '../loaders/GLTFLoader.js';
import { KTX2Loader } from '../loaders/KTX2Loader.js';
import { BuilderExtras } from './BuilderExtras.js';
import '../libs/hammer.min.js';
import * as THREE from 'three';
import { VRButton } from '../webxr/VRButton.js';
import { XRControllerModelFactory } from '../webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from '../webxr/XRHandModelFactory.js';
import { OculusHandModel } from '../webxr/OculusHandModel.js';
import { OculusHandPointerModel } from '../webxr/OculusHandPointerModel.js';
import StatsVR from '../stats/statsvr.js';
//stats
import Stats from '../libs/stats.module.js'


class ThreevoxBuilder {
    constructor(location, quality = -1, debug = 0) {

        const scope = this;
        const defaultQuality = 2;
        window.threevoxBuilder = this;
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.clockDelta;
        this.extras;
        this.vrRaycastInteract = [];
        this.raycaster = null;

        this.quality = quality < 0 ? defaultQuality : quality;

        let container, scene, percentage, controls, raycaster, mouse, touchHammer;
        let statsVR;
        let threev_interactables;
        let roofInvisibleTPS;
        let clipObjects = [];
        let loadImgFolder;
        let floorHeights;
        let lowWallsHeight;
        let floorQty;
        let currentFloor;
        let inLowWalls = false;
        let cubemapSkybox;
        let door_interactables;
        let fpsSkyboxTextures = [];
        let tpsSkyboxTextures = []
        let allFloors = [];
        let floor_1 = [],
            floor_2 = [],
            floor_3 = [],
            floor_4 = [],
            roofGroup = [];;

        let initPos;

        let iOSDevice = false;

        //this.viewStats = true;
        //this.consoleCalls = true;

        let clipPlaneY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);
        let clipPlanes = [
            clipPlaneY
        ];

        const floorsButton = document.getElementById('floors');

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
        let _customUniformsCubemap = [];
        let _cubemapMaterials = [];
        for (var i = 0; i < 6; i++) {
            tpsSkyboxTextures.push("_cubeTxr.jpg");
            _customUniformsCubemap.push({
                colorInterpolation: { value: 1.0 },
                mainTexture: { value: new THREE.TextureLoader().load('./img/_cubeTxr.jpg') },
                backTexture: { value: new THREE.TextureLoader().load('./img/_cubeTxr.jpg') }
            });
        }
        for (var i = 0; i < 6; i++) {
            _cubemapMaterials.push(new THREE.ShaderMaterial({
                uniforms: _customUniformsCubemap[i],
                vertexShader: vs_000,
                fragmentShader: fs_000
            }));
        }



        window.addEventListener('resize', onScreenResize, false);
        container = document.getElementById('container-3d');
        touchHammer = new Hammer(container);
        touchHammer.on('tap', hammerTap);


        SetupRenderer();
        StartLoading();
        SetupRaycaster();

        mouse = new THREE.Vector2();
        iOSDevice = iOS();

        function SetupRaycaster() {
            let raycaster = new THREE.Raycaster();
            raycaster.layers.enableAll();
            raycaster.layers.disable(2);
            scope.raycaster = raycaster;

        }

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

            const ktxLoader = new KTX2Loader()
                .setTranscoderPath('js/libs/basis/')
                .detectSupport(scope.renderer);

            gltf_loader.setKTX2Loader(ktxLoader);

            gltf_loader.load(location + '/gltf.gltf',
                function(gltf) {
                    if (debug)
                        console.log(gltf);
                    scope.extras = new BuilderExtras(gltf, location, scope.scene, scope.renderer, true, false, scope.quality); // IMPROVE
                    scope.scene.add(gltf.scene);
                    if (debug) {
                        statsVR = new StatsVR(scope.scene, scope.extras.mainCamera);
                    }
                    onScreenResize();
                },
                function(xhr) {
                    gltfLoaded = Math.round(xhr.loaded / xhr.total * 100);
                    percentage.innerHTML = (gltfLoaded / 2) + (texturesLoaded / 2) + " %";
                },
                function(error) {
                    console.log('An error happened: ' + error)
                }
            );
        }



        function SetupRenderer() {

            let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setClearColor(0xFFFFFF, 0);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(container.clientWidth, container.clientHeight);
            //renderer.outputEncoding = THREE.LinearEncoding;
            //renderer.outputEncoding = THREE.RGBADepthPacking;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1;
            container.appendChild(renderer.domElement);
            renderer.rect = renderer.domElement.getBoundingClientRect();
            renderer.localClippingEnabled = true;

            renderer.xr.enabled = true;

            scope.renderer = renderer;

        }

        if (!iOSDevice) {
            //document.body.appendChild(VRButton.createButton(scope.renderer, onVRClick));
        }

        //buttons

        //stats
        let stats;
        if (debug) {
            stats = Stats()
            document.body.appendChild(stats.dom)
        }


        if (!iOSDevice) {
            setRenderDeviceRatio(1 / getDevicePixelRatio());
        }




        function SetupExtras(extras) {
            createVRUser(extras);

            extras.gltf.scene.traverse((o) => {
                if (o.userData.doorObject !== undefined) {
                    AddComponent(new DoorObject(o, extras.gltf.nodes[o.userData.doorObject.pivot], -o.userData.doorObject.yRotateTo, 1))
                    scope.vrRaycastInteract.push(o);
                }
                if (o.userData.lookAtCam !== undefined) {
                    AddComponent(new LookAtCam(o, extras.mainCamera));
                }
                if (o.userData.teleport !== undefined) {
                    //AddComponent(new TeleportObject(o));
                    scope.vrRaycastInteract.push(o);
                }
                if (o.userData.moveTo !== undefined) {
                    AddComponent(new MovePosition(o, controls));
                }
                if (o.userData.clipObject !== undefined) {
                    clipObjects.push(o);
                }
                if (o.userData.door_interactables !== undefined) {
                    door_interactables = o;
                }
                if (o.userData.floor_1 !== undefined) {
                    floor_1.push(o);
                }
                if (o.userData.floor_2 !== undefined) {
                    floor_2.push(o);
                }
                if (o.userData.floor_3 !== undefined) {
                    floor_3.push(o);
                }
                if (o.userData.floor_4 !== undefined) {
                    floor_4.push(o);
                }
                if (o.userData.roofGroup !== undefined) {
                    roofGroup.push(o);
                }
                if (o.userData.interactables !== undefined) {
                    threev_interactables = o;
                }
                if (o.userData.skyCube !== undefined) {

                    setCubemapSkybox(o);
                }
                if (o.userData.roofInvisibleTPS !== undefined) {
                    o.visible = false;
                    roofInvisibleTPS = o;
                }
            });

            setThreevoxData(extras.gltf.userData.threevox);
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

        function setCubemapSkybox(object) {
            cubemapSkybox = object;
            let meshes = [];
            object.traverse(function(child) {
                if (child.isMesh) {
                    meshes.push(child);
                };
            });
            meshes[0].material = _cubemapMaterials[0];
            meshes[1].material = _cubemapMaterials[1];
            meshes[2].material = _cubemapMaterials[3];
            meshes[3].material = _cubemapMaterials[2];
            meshes[4].material = _cubemapMaterials[5];
            meshes[5].material = _cubemapMaterials[4];
        }


        function setThreevoxData(data) {

            initPos = new THREE.Vector3(data.initPos[0], data.initPos[1], data.initPos[2]);

            allFloors[0] = floor_1;
            allFloors[1] = floor_2;
            allFloors[2] = floor_3;
            allFloors[3] = floor_4;
            if (data.sky !== undefined) {
                fpsSkyboxTextures = data.sky;
            }
            floorQty = data.floors;
            loadImgFolder = "./img/" + (floorQty + 1) + "_";

            allFloors[floorQty + 1] = roofGroup;
            floorHeights = data.floorHeights;
            lowWallsHeight = data.lowWallsHeight;

            if (!data.hasRoof) {
                loadImgFolder += "0/";
                if (floorQty == 0)
                    floorsButton.parentElement.style.display = "none";
            } else {
                loadImgFolder += "1/";
                floorHeights[floorQty + 1] = 1000;
                floorQty += 1;
            }
            if (floorQty != 0)
                changeFloor(floorQty);
            else {
                currentFloor = 0;
            }
        }

        // FPS SKYBOX
        function loadCubemapTextures(cubeTextures, img_location, onLoaded) {
            var finalTextures = new Array(6);
            var manager = new THREE.LoadingManager(function() {
                if (onLoaded && typeof onLoaded === 'function') {
                    onLoaded(finalTextures);
                }
            });
            var loader = new THREE.TextureLoader(manager);
            loader.setPath(img_location);
            loader.load(cubeTextures[0], function(texture) {
                finalTextures[0] = texture;
                texture.flipY = false;
            });
            loader.load(cubeTextures[1], function(texture) {
                finalTextures[1] = texture;
                texture.flipY = false;
            });
            loader.load(cubeTextures[2], function(texture) {
                finalTextures[2] = texture;
                texture.flipY = false;
            });
            loader.load(cubeTextures[3], function(texture) {
                finalTextures[3] = texture;
                texture.flipY = false;
            });
            loader.load(cubeTextures[4], function(texture) {
                finalTextures[4] = texture;
                texture.flipY = false;
            });
            loader.load(cubeTextures[5], function(texture) {
                finalTextures[5] = texture;
                texture.flipY = false;
            });
        }

        function changeCubeMapTextures(textures) {
            //cubemapSkybox.visible = true;
            for (var i = 0; i < 6; i++) {
                _customUniformsCubemap[i].colorInterpolation.value = 0;
                _customUniformsCubemap[i].backTexture.value = textures[i];
            }
        }

        floorsButton.onclick = function() {
            setNextFloor();
        }

        function setNextFloor() {
            currentFloor += 1;
            changeFloor(currentFloor);
        }

        function changeFloor(tarFloor) {
            if (tarFloor > floorQty) {
                currentFloor = 0;
            } else {
                currentFloor = tarFloor;
            }
            setFloorVisibility(currentFloor);
            setWallsHeight();
            floorsButton.src = loadImgFolder + currentFloor + ".png";
        }

        function setFloorVisibility(tarFloor) {
            for (var i = 0; i <= floorQty; i++) {
                let group = allFloors[i]
                for (var j = 0; j <= group.length; j++) {
                    if (group[j] !== undefined) {
                        group[j].traverse((o) => {
                            o.userData.originalLayer = o.layers;
                            o.layers.set(2);
                        });
                        group[j].visible = false;
                    }
                }
            }
            for (var i = 0; i <= tarFloor; i++) {
                for (var j = 0; j <= allFloors[i].length; j++) {
                    let group = allFloors[i]
                    if (group[j] !== undefined) {
                        if (group[j] !== undefined) {
                            group[j].traverse((o) => {
                                if (o.userData.originalLayer !== undefined)
                                    o.layers.set(o.userData.originalLayer);
                                else {
                                    o.layers.set(0)
                                }
                            });
                        }
                        group[j].visible = true;
                    }
                }
            }
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
            //console.log("no component found");
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

        function castRay(_interactable) {

            //console.log(raycaster.layers);

            scope.raycaster.setFromCamera(mouse, scope.extras.mainCamera);
            const at_1 = scope.raycaster.intersectObjects(_interactable.children, true);
            if (at_1.length > 0) {
                onRaycastHit(at_1[0].object.userData.gameObject);
            }
        }

        function simpleClick() {
            updateStencil();
            if (controls.onFPSView) {
                castRay(threev_interactables)
            } else {
                castRay(door_interactables);
            }
        }



        function multiClick() {
            if (!controls.onFPSView) {
                castRay(threev_interactables)
            } //else {
            //controls.zoomOutTo();
            //}
        }

        function testHitSphere(point) {
            const _geometry = new THREE.SphereGeometry(15, 32, 16);
            const _material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const _sphere = new THREE.Mesh(_geometry, _material);
            scope.scene.add(_sphere);
            _sphere.scale.set(.05, .05, .05);
            _sphere.position.set(point.x, point.y, point.z);
            return _sphere;
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
        this.onControlsChange = function(onfps) {
            roofInvisibleTPS.visible = onfps;
            if (onfps) {
                // if (scope.extras.batchGeom != null) {
                //     scope.extras.batchGeom.displayBatchGeometry(true);
                // }
                scope.extras.showBatchGeometry(true);
                document.getElementById('first-person-view').style.display = "none";
                document.getElementById('default-3d-view').style.display = "block";
                loadCubemapTextures(fpsSkyboxTextures, location + "/", changeCubeMapTextures);
            } else {
                // if (scope.extras.batchGeom != null) {
                //     scope.extras.batchGeom.displayBatchGeometry(false);
                // }
                scope.extras.showBatchGeometry(false);
                document.getElementById('first-person-view').style.display = "block";
                document.getElementById('default-3d-view').style.display = "none";
                loadCubemapTextures(tpsSkyboxTextures, "./img/", changeCubeMapTextures);
            }
            //console.log(onfps);
        }

        function onLoad() {
            setupOrbitControls();
            SetupExtras(scope.extras);
            setStencilMaterials();
            updateStencil();
            animate();

        }

        function setupOrbitControls() {
            controls = new OrbitControls(scope.extras.mainCamera, scope.renderer.domElement, scope.onControlsChange);
            if (scope.extras.gltf.userData.orbitControls !== undefined) {
                controls.target.set(scope.extras.gltf.userData.orbitControls.target[0], scope.extras.gltf.userData.orbitControls.target[1], scope.extras.gltf.userData.orbitControls.target[2]);
                controls.enableDamping = scope.extras.gltf.userData.orbitControls.dampling;
                controls.dampingFactor = 0.1;
                //controls.dampingFactor = scope.extras.gltf.userData.orbitControls.dampFactor;
                controls.smoothZoom = scope.extras.gltf.userData.orbitControls.smoothZoom;
                controls.minDistance = scope.extras.gltf.userData.orbitControls.minDist;
                //controls.minDistance = 5;
                controls.maxDistance = scope.extras.gltf.userData.orbitControls.maxDist;
                //controls.maxDistance = 25;
                controls.minPolarAngle = scope.extras.gltf.userData.orbitControls.minPolar;
                controls.maxPolarAngle = scope.extras.gltf.userData.orbitControls.maxPolar;
            }
            controls.update();
        }

        document.getElementById('first-person-view').onclick = function() {
            controls.zoomTo(initPos.x, initPos.y, initPos.z, 0);
        }
        document.getElementById('default-3d-view').onclick = function() {
            controls.zoomOutTo();
        }

        //buttons
        const appContainer = document.querySelector(".app-container");
        const fullScreen = document.getElementById('full-screen');
        const closeFullScreen = document.getElementById('close-full-screen');
        const hightWalls = document.getElementById('high-walls');
        const lowWalls = document.getElementById("low-walls");
        const shareButton = document.getElementById("share-button")
        const vrButton = document.getElementById("vr-button");


        this.renderer.xr.addEventListener('sessionstart', function(event) {

            loadCubemapTextures(fpsSkyboxTextures, location + "/", changeCubeMapTextures);

        });

        this.renderer.xr.addEventListener('sessionend', function(event) {

            loadCubemapTextures(tpsSkyboxTextures, "./img/", changeCubeMapTextures);

        });

        function onVRClick(active) {
            roofInvisibleTPS.visible = active;
            changeFloor(floorQty);
            scope.extras.setVRQuality(scope.quality, true);
        }
        if (navigator.xr !== undefined) {
            navigator.xr.isSessionSupported('immersive-vr').then(function(supported) {

                if (vrButton !== null) {
                    if (supported == true) {
                        vrButton.parentNode.style.display = 'block';
                    } else {
                        vrButton.parentNode.style.display = 'none';
                    }
                }

            });
        }
        if (vrButton !== null) {
            vrButton.onclick = function() {
                onVRClick(true);
                console.log("enter vr");
            }
        }
        if (shareButton !== null) {
            shareButton.onclick = function() {
                navigator.clipboard.writeText(window.location.href)
            }
        }
        if (fullScreen !== null) {
            fullScreen.onclick = function() {
                toggleFullscreen(true);
            }
        }
        if (closeFullScreen !== null) {
            closeFullScreen.onclick = function() {
                toggleFullscreen(false);
            }
        }
        if (hightWalls !== null) {
            hightWalls.onclick = function() {
                hightWalls.style.display = 'none';
                lowWalls.style.display = 'block';
                setHighWalls(true);

            }
        }
        if (lowWalls !== null) {
            lowWalls.onclick = function() {
                hightWalls.style.display = 'block';
                lowWalls.style.display = 'none';
                setHighWalls(false);
            }
        }

        function setHighWalls(high) {
            if (high) {
                scope.inLowWalls = false;
            } else {
                scope.inLowWalls = true;
            }
            setWallsHeight();

        }

        let clipPlanesObjects = [];

        function setWallsHeight() {
            if (scope.inLowWalls) {
                console.log(currentFloor);
                clipPlaneY.constant = floorHeights[currentFloor] + lowWallsHeight;
                console.log(clipPlaneY.constant);
            } else {
                clipPlaneY.constant = 1000;
            }
            updateStencil();
        }


        function toggleFullscreen(toggle) {
            if (toggle) {
                if (!document.fullscreenElement) {
                    closeFullScreen.style.display = "block";
                    fullScreen.style.display = "none";
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

        function setStencilMaterials() {
            //test
            // scope.scene.traverse((o) => {
            //     if (o.isMesh) {
            //         console.log(o);
            //         if (o.material.length == undefined) {
            //             o.material = createStencilMaterial(o.material);
            //         } else {
            //             for (var i = 0; i < o.material.length; i++) {
            //                 o.material[i] = createStencilMaterial(o.material[i]);
            //             }
            //         }
            //         clipPlanesObjects.push(createStencil(o.geometry, clipPlanes, o));
            //     }
            // });
            for (var j = 0; j < clipObjects.length; j++) {
                let mesh = clipObjects[j].userData.mesh;
                if (mesh !== undefined) {
                    if (mesh.material !== undefined) {
                        if (mesh.material.length == undefined) {
                            mesh.material = createStencilMaterial(mesh.material);
                        } else {
                            for (var i = 0; i < mesh.material.length; i++) {
                                mesh.material[i] = createStencilMaterial(mesh.material[i]);
                            }
                        }
                        clipPlanesObjects.push(createStencil(mesh.geometry, clipPlanes, mesh));
                    }
                }
            }
        }

        function createStencilMaterial(mat) {
            var newmat = mat.clone();
            newmat.clipShadows = true;
            newmat.clippingPlanes = clipPlanes;
            newmat.shadowSide = THREE.DoubleSide;
            return newmat;
        }


        function createStencil(geometry, planes, parent = scene, offsetPosition = new THREE.Vector3(0, 0, 0)) {
            var planeObjResult = [];
            var planeGeom = new THREE.PlaneBufferGeometry(300, 300); //PROBAR CAMBIAR VALOR
            for (var i = 0; i < planes.length; i++) {
                var poGroup = new THREE.Group();
                var plane = planes[i];
                var stencilGroup = createPlaneStencilGroup(geometry, plane, i + 1);
                var planeMat = new THREE.MeshStandardMaterial({

                    color: 0xE91E63,
                    metalness: 0.1,
                    roughness: 0.75,
                    clippingPlanes: planes.filter(p => p !== plane),
                    stencilWrite: true,

                    stencilRef: 0,
                    stencilFunc: THREE.NotEqualStencilFunc,
                    stencilFail: THREE.ReplaceStencilOp,
                    stencilZFail: THREE.ReplaceStencilOp,
                    stencilZPass: THREE.ReplaceStencilOp,

                });
                var po = new THREE.Mesh(planeGeom, planeMat);
                po.renderOrder = i + 1.1;
                stencilGroup.position.add(offsetPosition);
                parent.add(stencilGroup);
                poGroup.add(po);
                planeObjResult.push(po);

                poGroup.position.add(offsetPosition);
                scope.scene.add(poGroup);
                //po.material = new THREE.MeshStandardMaterial();
            }
            return planeObjResult;
        }

        function createPlaneStencilGroup(geometry, plane, renderOrder) {

            const group = new THREE.Group();
            const baseMat = new THREE.MeshBasicMaterial();
            baseMat.depthWrite = false;
            baseMat.depthTest = false;
            baseMat.colorWrite = false;
            baseMat.stencilWrite = true;
            baseMat.stencilFunc = THREE.AlwaysStencilFunc;

            // back faces
            const mat0 = baseMat.clone();
            mat0.side = THREE.BackSide;
            mat0.clippingPlanes = [plane];
            mat0.stencilFail = THREE.IncrementWrapStencilOp;
            mat0.stencilZFail = THREE.IncrementWrapStencilOp;
            mat0.stencilZPass = THREE.IncrementWrapStencilOp;

            const mesh0 = new THREE.Mesh(geometry, mat0);
            mesh0.renderOrder = renderOrder;
            group.add(mesh0);

            // front faces
            const mat1 = baseMat.clone();
            mat1.side = THREE.FrontSide;
            mat1.clippingPlanes = [plane];
            mat1.stencilFail = THREE.DecrementWrapStencilOp;
            mat1.stencilZFail = THREE.DecrementWrapStencilOp;
            mat1.stencilZPass = THREE.DecrementWrapStencilOp;

            const mesh1 = new THREE.Mesh(geometry, mat1);
            mesh1.renderOrder = renderOrder;

            group.add(mesh1);

            return group;

        }

        //CALLED WHEN STENCIL HAS CHANGED
        function updateStencil() {
            for (var i = 0; i < clipPlanesObjects.length; i++) {
                for (var j = 0; j < clipPlanesObjects[i].length; j++) {
                    var plane = clipPlanes[j];
                    var po = clipPlanesObjects[i][j];
                    plane.coplanarPoint(po.position);
                    po.lookAt(
                        po.position.x - plane.normal.x,
                        po.position.y - plane.normal.y,
                        po.position.z - plane.normal.z,
                    );
                }
            }
        }
        //let sp;



        function animate() {

            scope.renderer.setAnimationLoop(update);

        }


        function update() {




            tick();
            scope.clockDelta = scope.clock.getDelta();
            scope.renderer.render(scope.scene, scope.extras.mainCamera);
            controls.update();
            if (debug) {
                stats.update();
                statsVR.update();
                console.log(scope.renderer.info.render.calls);
            }
        }

        function tick() {
            scope.extras.allComponents.forEach((c) => {
                c.tick();
            });
            //console.log(scope.extras.camera.position);
            skyboxUpdate();
        }

        function skyboxUpdate() {
            if (_customUniformsCubemap[0].colorInterpolation.value < 1) {
                for (var i = 0; i < 6; i++) {
                    _customUniformsCubemap[i].colorInterpolation.value += scope.clockDelta;
                }
                if (_customUniformsCubemap[0].colorInterpolation.value >= 1) {
                    for (var i = 0; i < 6; i++) {
                        _customUniformsCubemap[i].mainTexture.value = _customUniformsCubemap[i].backTexture.value;
                        _customUniformsCubemap[i].colorInterpolation.value = 1;
                    }
                }
            }
        }

        function onRaycastHit(object) {
            if (object.userData.components !== undefined) {
                object.userData.components.forEach((c) => {
                    c.onRaycastHit();
                });
            }
        }

        function onScreenResize() {
            if (scope.extras !== undefined) {
                scope.extras.mainCamera.aspect = container.clientWidth / container.clientHeight;
                scope.extras.mainCamera.updateProjectionMatrix();
                scope.extras.callWindowResize();
            }
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
    tick() {
        if (this.isMoving) {
            if (this.isOpen) {
                if (this.rotateCounter > 0) {
                    this.rotateCounter -= window.threevoxBuilder.clockDelta / this.speed;
                    if (this.rotateCounter > 0) {
                        this.pivot.rotation.y = this.rotateCounter * this.yRotateTo;
                    } else {
                        this.pivot.rotation.y = 0;
                        this.isMoving = false;
                    }
                }
            } else {
                if (this.rotateCounter < 1) {
                    this.rotateCounter += window.threevoxBuilder.clockDelta / this.speed;
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

class LookAtCam extends ObjectComponent {
    constructor(object, targetCam, invert = true) {
        super(object);
        this.camera = targetCam
        this.lookAt = true;
        if (invert)
            object.scale.set(-1, -1, -1);
    }
    tick() {
        if (this.lookAt === true) {
            this.object.lookAt(this.camera.position);
        }
    }
}

class MovePosition extends ObjectComponent {
    constructor(object, controls) {
        super(object);
        this.targetPosition;
        this.controls = controls;
        object.visible = false
    }
    onRaycastHit() {
        let pos = new THREE.Vector3();
        this.object.parent.getWorldPosition(pos);
        this.controls.zoomTo(pos.x, pos.y, pos.z);
    }
}

// class TeleportObject extends ObjectComponent {
//     constructor(object) {
//         super(object);
//     }
// }

class OculusController extends ObjectComponent {

    constructor(VRuser, renderer, id) {

        //constructor(object, hand, pointer) {
        super(new THREE.Object3D());

        const scope = this;

        this.valid = true;
        this.clicked = false;
        this.timer = 0;
        this.clickTime = 0.1;
        this.handClickTime = 0.5;
        this.enabledHandMove = true;

        this.controller = null;
        this.controllerGrip = null;
        this.controlInput = null;
        this.hand = null;
        this.pointer = null;


        this.whiteColor = new THREE.Color(0x0000ff);
        this.hitColor = new THREE.Color(0x22ff00);
        this.missColor = new THREE.Color(0xff0000);
        this.lineMaterial = new THREE.LineBasicMaterial({
            color: this.whiteColor
        });
        this.raycastLine = null;

        this.raycaster = null;
        this.hitObject = null;
        this.raycastPos = new THREE.Vector3();
        this.raycastDir = new THREE.Vector3();
        this.tempMatrix = new THREE.Matrix4();

        // this.lerpoPos = new THREE.Vector3();
        // this.lerpRot = new THREE.Vector3();

        this.camera = threevoxBuilder.extras.mainCamera;
        this.fwdDirection = new THREE.Vector3();

        this.gamePad = null;

        this.VRuser = VRuser;


        if (this.pointer != undefined && this.hand != undefined) {
            if (this.pointer.isPinched == undefined) {
                this.valid = false;
            }
        } else {
            this.valid = false;
        }

        createControllers(VRuser, renderer, id);

        function createControllers(VRuser, renderer, id) {
            const controllerModelFactory = new XRControllerModelFactory();


            //controller
            scope.controller = renderer.xr.getController(id);
            VRuser.add(scope.controller);


            //raycastline
            const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);

            scope.raycastLine = new THREE.Line(geometry, scope.lineMaterial);
            scope.raycastLine.name = 'line';
            scope.raycastLine.scale.z = 5;

            scope.controller.add(scope.raycastLine);

            //controller grip
            scope.controllerGrip = renderer.xr.getControllerGrip(id);
            scope.controlInput = controllerModelFactory.createControllerModel(scope.controllerGrip)
            scope.controllerGrip.add(scope.controlInput);
            VRuser.add(scope.controllerGrip);
            //console.log(scope.controllerGrip);

            //hand
            scope.hand = renderer.xr.getHand(id);
            scope.hand.add(new OculusHandModel(scope.hand));
            scope.pointer = new OculusHandPointerModel(scope.hand, scope.controller);
            scope.hand.add(scope.pointer);
            //console.log(scope.hand);

            scope.hand.traverse((o) => {
                o.layers.set(2);
            });
            scope.pointer.traverse((o) => {
                o.layers.set(2);
            });

            //raycaster
            scope.raycaster = new THREE.Raycaster();
            scope.raycaster.distance = 5;

            VRuser.add(scope.hand);
        }

    }

    tick() {
        //if (this.controlInput.motionController !== null)
        this.handleInputControls();
        //else

    }

    handleInputControls() {
        if (this.controlInput.motionController !== null) {
            if (this.controlInput.motionController.xrInputSource.hand !== null) {
                this.moveWithHandInput();
            } else {
                this.moveWithControllerInput();
            }
        }
    }

    moveWithControllerInput() {
        if (this.controlInput.motionController !== null) {

            //console.log(this.controlInput.motionController.xrInputSource);

            this.fwdDirection.z = -this.camera.matrixWorld.elements[0];
            this.fwdDirection.x = -this.camera.matrixWorld.elements[8];

            if (this.controlInput.motionController.xrInputSource.gamepad.axes[3] > 0.1 || this.controlInput.motionController.xrInputSource.gamepad.axes[3] < -0.1) {
                this.VRuser.position.add(this.fwdDirection.multiplyScalar(-this.controlInput.motionController.xrInputSource.gamepad.axes[3] * threevoxBuilder.clockDelta));
            }
            if (this.controlInput.motionController.xrInputSource.gamepad.axes[2] > 0.1 || this.controlInput.motionController.xrInputSource.gamepad.axes[2] < -0.1) {
                this.VRuser.rotation.y -= this.controlInput.motionController.xrInputSource.gamepad.axes[2] * threevoxBuilder.clockDelta * 0.3;
            }

            if (this.controlInput.motionController.xrInputSource.gamepad.buttons[0].pressed === true) {
                this.timer += threevoxBuilder.clockDelta;

                let intersections = this.checkIntersections();
                if (intersections.length > 0) {
                    this.raycastLine.scale.z = intersections[0].distance;
                    this.lineMaterial.color = this.hitColor;
                } else {
                    this.raycastLine.scale.z = 5;
                    this.lineMaterial.color = this.missColor;
                }

                if (this.clicked === false && this.timer > this.clickTime) {
                    this.clicked = true;
                }
                this.raycastLine.visible = true;
            } else {
                if (this.clicked === true) {
                    this.controlClick();
                }
                this.timer = 0;
                this.clicked = false;
                this.raycastLine.visible = false;
            }
        }
        //this.VRuser.position.add(camRotation);

    }

    moveWithHandInput() {
        this.raycastLine.visible = false;
        this.pointer.checkIntersections(threevoxBuilder.vrRaycastInteract);
        if (this.pointer.isPinched()) {
            this.timer += threevoxBuilder.clockDelta;
            this.pinch();
            if (this.clicked === false && this.timer > this.handClickTime) {
                this.handClick();
                this.clicked = true;
            }
        } else {
            this.timer = 0;
            this.clicked = false;
        }
    }
    pinch() {

    }

    controlClick() {

        // this.tempMatrix.identity().extractRotation(this.controller.matrixWorld);
        // this.raycaster.ray.origin.setFromMatrixPosition(this.controller.matrixWorld);
        // this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
        this.handleRaycastHit(this.checkIntersections());
        //return raycaster.intersectObjects(group.children);

    }
    handClick() {
        if (this.enabledHandMove) {
            this.handleRaycastHit(this.pointer.intersectObjects(threevoxBuilder.vrRaycastInteract))
        }
    }
    checkIntersections() {
        this.tempMatrix.identity().extractRotation(this.controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(this.controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
        return this.raycaster.intersectObjects(threevoxBuilder.vrRaycastInteract, true);
    }
    handleRaycastHit(hits) {
        console.log(hits);
        if (hits !== undefined) {
            if (hits.length !== undefined) {
                if (hits.length > 0) {
                    let action = false;
                    if (hits[0].object.userData.gameObject.userData.components !== undefined) {
                        hits[0].object.userData.gameObject.userData.components.forEach((c) => {
                            c.onRaycastHit();
                            action = true;
                        });
                    }
                    if (action === false) {
                        this.moveToPosition(hits[0].point);
                        //this.moveToPosition(this.pointer.cursorObject.getWorldPosition(tarPos));
                        // if (this.pointer.cursorObject !== null) {
                        //     let tarPos = new THREE.Vector3();

                        // }
                    }
                }
            }
        }
    }
    moveToPosition(position) {
        //console.log(threevoxBuilder.extras.camera);
        threevoxBuilder.extras.VRuser.position.set(position.x, position.y, position.z);
    }
    testHitSphere(point) {
        const _geometry = new THREE.SphereGeometry(15, 32, 16);
        const _material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const _sphere = new THREE.Mesh(_geometry, _material);
        threevoxBuilder.scene.add(_sphere);
        _sphere.scale.set(.01, .01, .01);
        _sphere.position.set(point.x, point.y, point.z);
        return _sphere;
    }
}


export { ThreevoxBuilder };