//import { OrbitControls } from '../controls/OrbitControls.js';
import { OrbitControls } from '../controls/OrbitControlsClickMove.js';
import { GLTFLoader } from '../loaders/GLTFLoaderExtras.js';
import { BuilderExtras } from './BuilderExtras.js';
import '../libs/hammer.min.js';
import * as THREE from '../../../build/three.module.js';
import { VRButton } from '../webxr/VRButton.js';
import { XRControllerModelFactory } from '../webxr/XRControllerModelFactory.js';
//stats
import Stats from '../libs/stats.module.js'

class PlanoVRBuilder {
    constructor(location) {

        const scope = this;
        window.builder = this;

        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.clockDelta;
        this.extras;

        let gltf_loader, main_loading_manager, renderer, container, scene, percentage, controls, raycaster, mouse, touchHammer;
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

        this.viewStats = false;

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

        raycaster = new THREE.Raycaster();
        for (var i = 0; i < 31; i++) {
            raycaster.layers.enable(i)
        }
        raycaster.layers.disable(2);
        mouse = new THREE.Vector2();

        //window._scene = scene;

        this.setPreferences = function() {
            createTags(window.builder.tags);
        }

        window.addEventListener('resize', onScreenResize, false);
        container = document.getElementById('container-3d');
        touchHammer = new Hammer(container);
        touchHammer.on('tap', hammerTap);
        percentage = document.getElementById('load-percentage');
        main_loading_manager = new THREE.LoadingManager();
        main_loading_manager.onLoad = function() {
            onLoad();

            document.getElementsByClassName('loading-screen')[0].style.display = 'none';
        };
        main_loading_manager.onProgress = function(url, itemsLoaded, itemsTotal) {
            if (itemsTotal > 2)
                percentage.innerHTML = Math.round(itemsLoaded / itemsTotal * 100) + '% loaded';
        };
        main_loading_manager.onError = function(url) {
            console.log('There was an error loading ' + url);
        };

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0xFFFFFF, 0);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 2;
        renderer.localClippingEnabled = true;
        container.appendChild(renderer.domElement);
        renderer.rect = renderer.domElement.getBoundingClientRect();
        renderer.localClippingEnabled = true;
        //xr
        renderer.xr.enabled = true;

        document.body.appendChild(VRButton.createButton(renderer));

        //buttons

        //stats
        let stats;
        if (this.viewStats === true) {
            stats = Stats()
            document.body.appendChild(stats.dom)
        }

        if (!iOS()) {
            setRenderDeviceRatio(1 / getDevicePixelRatio());
        }

        gltf_loader = new GLTFLoader(main_loading_manager);
        gltf_loader.load(location + '/gltf.gltf',
            function(obj) {
                scope.extras = new BuilderExtras(obj); // IMPROVE
                scope.scene.add(obj.scene);
                let pmGen = new THREE.PMREMGenerator(renderer);
                pmGen.compileCubemapShader();
                let cubeTextureLoader = new THREE.CubeTextureLoader().setPath(location + '/');
                // let envCube = cubeTextureLoader.load(obj.userData.environment, function() {
                //     scope.scene.environment = envCube;
                // });
                let envCube = cubeTextureLoader.load(obj.userData.environment, function() {
                    envCube = pmGen.fromCubemap(envCube);
                    pmGen.dispose();
                    envCube.needsUpdate = true;

                });
                scope.scene.environment = envCube;
                scope.scene.environment.encoding = THREE.sRGBEncoding;
                scope.scene.environment.mipmap

                onScreenResize();
            },
            function(error) {
                console.log('An error happened: ' + error)
            }
        );

        function SetupExtras(extras) {
            extras.gltf.scene.traverse((o) => {
                if (o.userData.doorObject !== undefined) {
                    //AddComponent(new DoorObject(o, extras.allNodes[o.userData.doorObject.pivot], -o.userData.doorObject.yRotateTo, 1))
                    AddComponent(new DoorObject(o, extras.allNodes[o.userData.doorObject.pivot], -o.userData.doorObject.yRotateTo, 1))
                }
                if (o.userData.lookAtCam !== undefined) {
                    AddComponent(new LookAtCam(o, extras.camera));
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
                    roofGroup.push[o];
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
            mouse.x = ((e.center.x - renderer.rect.left) / renderer.rect.width) * 2 - 1;
            mouse.y = -((e.center.y - renderer.rect.top) / renderer.rect.height) * 2 + 1;
            if (e.tapCount == 2) {
                multiClick();
            }
            if (e.tapCount == 1) {
                simpleClick();
            }
        }

        function castRay(_interactable) {

            //console.log(raycaster.layers);

            raycaster.setFromCamera(mouse, scope.extras.camera);
            const at_1 = raycaster.intersectObjects(_interactable.children, true);
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
            _sphere.scale.set(.01, .01, .01);
            _sphere.position.set(point.x, point.y, point.z);
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
                document.getElementById('first-person-view').style.display = "none";
                document.getElementById('default-3d-view').style.display = "block";
                loadCubemapTextures(fpsSkyboxTextures, location + "/", changeCubeMapTextures);
            } else {
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
            //update();
            animate();
        }

        function setupOrbitControls() {
            controls = new OrbitControls(scope.extras.camera, renderer.domElement, scope.onControlsChange);
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
            controls.update();
        }

        document.getElementById('first-person-view').onclick = function() {
            controls.zoomTo(initPos.x, initPos.y, initPos.z, 0);
        }
        document.getElementById('default-3d-view').onclick = function() {
            controls.zoomOutTo();
        }

        const appContainer = document.querySelector(".app-container");
        const fullScreen = document.getElementById('full-screen');
        const closeFullScreen = document.getElementById('close-full-screen');
        fullScreen.onclick = function() {
            toggleFullscreen(true);
        }
        closeFullScreen.onclick = function() {
            toggleFullscreen(false);
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

        const hightWalls = document.getElementById('high-walls');
        const lowWalls = document.getElementById("low-walls");
        hightWalls.onclick = function() {
            hightWalls.style.display = 'none';
            lowWalls.style.display = 'block';
            setHighWalls(true);

        }
        lowWalls.onclick = function() {
            hightWalls.style.display = 'block';
            lowWalls.style.display = 'none';
            setHighWalls(false);
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



        function setStencilMaterials() {
            for (var j = 0; j < clipObjects.length; j++) {
                let mesh = clipObjects[j].userData.mesh;
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

        function animate() {
            renderer.setAnimationLoop(update);
        }

        function update() {
            tick();
            scope.clockDelta = scope.clock.getDelta();
            renderer.render(scope.scene, scope.extras.camera);
            controls.update();
            if (scope.viewStats)
                stats.update();
        }

        function tick() {
            scope.extras.allComponents.forEach((c) => {
                c.tick();
            });

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
            scope.extras.camera.aspect = container.clientWidth / container.clientHeight;
            scope.extras.camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.rect = renderer.domElement.getBoundingClientRect();
        }

        function setRenderDeviceRatio(value) {
            renderer.setPixelRatio(window.devicePixelRatio * value);
            renderer.setSize(container.clientWidth, container.clientHeight);
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
                    this.rotateCounter -= window.builder.clockDelta / this.speed;
                    if (this.rotateCounter > 0) {
                        this.pivot.rotation.y = this.rotateCounter * this.yRotateTo;
                    } else {
                        this.pivot.rotation.y = 0;
                        this.isMoving = false;
                    }
                }
            } else {
                if (this.rotateCounter < 1) {
                    this.rotateCounter += window.builder.clockDelta / this.speed;
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
    }
    onRaycastHit() {
        let pos = new THREE.Vector3();
        this.object.parent.getWorldPosition(pos);
        this.controls.zoomTo(pos.x, pos.y, pos.z);
    }
}



export { PlanoVRBuilder };